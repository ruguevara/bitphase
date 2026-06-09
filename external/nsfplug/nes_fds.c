#include <math.h>
#include <string.h>
#include "nes_fds.h"

const int RC_BITS = 12;
const double DEFAULT_RATE = 48000;

void nes_fds_Init (nes_fds_t* s)
{
    s->option[NES_FDS_OPT_CUTOFF] = 2000;
    s->option[NES_FDS_OPT_4085_RESET] = 0;
    s->option[NES_FDS_OPT_WRITE_PROTECT] = 0; // not used here, see nsfplay.cpp

    s->rc_k = 0;
    s->rc_l = (1<<RC_BITS);

    nes_fds_SetRate (s, DEFAULT_RATE);
    s->sm[0] = 128;
    s->sm[1] = 128;

    nes_fds_Reset(s);
}

void nes_fds_SetStereoMix(nes_fds_t* s, int trk, int32_t mixl, int32_t mixr)
{
    if (trk < 0) return;
    if (trk > 1) return;
    s->sm[0] = mixl;
    s->sm[1] = mixr;
}

void nes_fds_SetRate (nes_fds_t* s, double r)
{
    s->rate = r;

    // configure lowpass filter
    double cutoff = (double)(s->option[NES_FDS_OPT_CUTOFF]);
    double leak = 0.0;
    if (cutoff > 0)
        leak = exp(-2.0 * 3.14159 * cutoff / s->rate);
    s->rc_k = (int32_t)(leak * (double)(1<<RC_BITS));
    s->rc_l = (1<<RC_BITS) - s->rc_k;
}

void nes_fds_SetOption (nes_fds_t* s, int id, int val)
{
    if(id<NES_FDS_OPT_END) s->option[id] = val;

    // update cutoff immediately
    if (id == NES_FDS_OPT_CUTOFF) nes_fds_SetRate(s, s->rate);
}

void nes_fds_Reset (nes_fds_t* s)
{
    s->master_io = true;
    s->master_vol = 0;
    s->last_freq = 0;
    s->last_vol = 0;

    s->rc_accum = 0;

    for (int i=0; i<2; ++i)
    {
        memset(s->wave[i], 0, sizeof(s->wave[i]));
        s->freq[i] = 0;
        s->phase[i] = 0;
    }
    s->wav_write = false;
    s->wav_halt = true;
    s->env_halt = true;
    s->mod_halt = true;
    s->mod_pos = 0;
    s->mod_write_pos = 0;

    for (int i=0; i<2; ++i)
    {
        s->env_mode[i] = false;
        s->env_disable[i] = true;
        s->env_timer[i] = 0;
        s->env_speed[i] = 0;
        s->env_out[i] = 0;
    }
    s->master_env_speed = 0xFF;

    // NOTE: the FDS BIOS reset only does the following related to audio:
    //   $4023 = $00
    //   $4023 = $83 enables master_io
    //   $4080 = $80 output volume = 0, envelope disabled
    //   $408A = $E8 master envelope speed
    nes_fds_Write(s, 0x4023, 0x00);
    nes_fds_Write(s, 0x4023, 0x83);
    nes_fds_Write(s, 0x4080, 0x80);
    nes_fds_Write(s, 0x408A, 0xE8);

    // reset other stuff
    nes_fds_Write(s, 0x4082, 0x00); // wav freq 0
    nes_fds_Write(s, 0x4083, 0x80); // wav disable
    nes_fds_Write(s, 0x4084, 0x80); // mod strength 0
    nes_fds_Write(s, 0x4085, 0x00); // mod position 0
    nes_fds_Write(s, 0x4086, 0x00); // mod freq 0
    nes_fds_Write(s, 0x4087, 0x80); // mod disable
    nes_fds_Write(s, 0x4089, 0x00); // wav write disable, max global volume}
}

void nes_fds_Tick (nes_fds_t* s, uint32_t clocks)
{
    // clock envelopes
    if (!s->env_halt && !s->wav_halt && (s->master_env_speed != 0))
    {
        for (int i=0; i<2; ++i)
        {
            if (!s->env_disable[i])
            {
                s->env_timer[i] += clocks;
                uint32_t period = ((s->env_speed[i]+1) * s->master_env_speed) << 3;
                while (s->env_timer[i] >= period)
                {
                    // clock the envelope
                    if (s->env_mode[i])
                    {
                        if (s->env_out[i] < 32) ++s->env_out[i];
                    }
                    else
                    {
                        if (s->env_out[i] > 0 ) --s->env_out[i];
                    }
                    s->env_timer[i] -= period;
                }
            }
        }
    }

    // clock the mod table
    if (!s->mod_halt)
    {
        // advance phase, adjust for modulator
        uint32_t start_pos = s->phase[TMOD] >> 16;
        s->phase[TMOD] += (clocks * s->freq[TMOD]);
        uint32_t end_pos = s->phase[TMOD] >> 16;

        // wrap the phase to the 64-step table (+ 16 bit accumulator)
        s->phase[TMOD] = s->phase[TMOD] & 0x3FFFFF;

        // execute all clocked steps
        for (uint32_t p = start_pos; p < end_pos; ++p)
        {
            int32_t wv = s->wave[TMOD][p & 0x3F];
            if (wv == 4) // 4 resets mod position
                s->mod_pos = 0;
            else
            {
                const int32_t BIAS[8] = { 0, 1, 2, 4, 0, -4, -2, -1 };
                s->mod_pos += BIAS[wv];
                s->mod_pos &= 0x7F; // 7-bit clamp
            }
        }
    }

    // clock the wav table
    if (!s->wav_halt)
    {
        // complex mod calculation
        int32_t mod = 0;
        if (s->env_out[EMOD] != 0) // skip if modulator off
        {
            // convert mod_pos to 7-bit signed
            int32_t pos = (s->mod_pos < 64) ? s->mod_pos : (s->mod_pos-128);

            // multiply pos by gain,
            // shift off 4 bits but with odd "rounding" behaviour
            int32_t temp = pos * s->env_out[EMOD];
            int32_t rem = temp & 0x0F;
            temp >>= 4;
            if ((rem > 0) && ((temp & 0x80) == 0))
            {
                if (pos < 0) temp -= 1;
                else         temp += 2;
            }

            // wrap if range is exceeded
            while (temp >= 192) temp -= 256;
            while (temp <  -64) temp += 256;

            // multiply result by pitch,
            // shift off 6 bits, round to nearest
            temp = s->freq[TWAV] * temp;
            rem = temp & 0x3F;
            temp >>= 6;
            if (rem >= 32) temp += 1;

            mod = temp;
        }

        // advance wavetable position
        int32_t f = s->freq[TWAV] + mod;
        s->phase[TWAV] = s->phase[TWAV] + (clocks * f);
        s->phase[TWAV] = s->phase[TWAV] & 0x3FFFFF; // wrap

        // store for trackinfo
        s->last_freq = f;
    }

    // output volume caps at 32
    int32_t vol_out = s->env_out[EVOL];
    if (vol_out > 32) vol_out = 32;

    // final output
    if (!s->wav_write)
        s->fout = s->wave[TWAV][(s->phase[TWAV]>>16)&0x3F] * vol_out;

    // NOTE: during wav_halt, the unit still outputs (at phase 0)
    // and volume can affect it if the first sample is nonzero.
    // haven't worked out 100% of the conditions for volume to
    // effect (vol envelope does not seem to run, but am unsure)
    // but this implementation is very close to correct

    // store for trackinfo
    s->last_vol = vol_out;
}

uint32_t nes_fds_Render (nes_fds_t* s, int32_t b[2])
{
    // 8 bit approximation of master volume
    const double MASTER_VOL = 2.4 * 1223.0; // max FDS vol vs max APU square (arbitrarily 1223)
    const double MAX_OUT = 32.0f * 63.0f; // value that should map to master vol
    const int32_t MASTER[4] = {
        (int32_t)((MASTER_VOL / MAX_OUT) * 256.0 * 2.0f / 2.0f),
        (int32_t)((MASTER_VOL / MAX_OUT) * 256.0 * 2.0f / 3.0f),
        (int32_t)((MASTER_VOL / MAX_OUT) * 256.0 * 2.0f / 4.0f),
        (int32_t)((MASTER_VOL / MAX_OUT) * 256.0 * 2.0f / 5.0f) };

    int32_t v = s->fout * MASTER[s->master_vol] >> 8;

    // lowpass RC filter
    int32_t rc_out = ((s->rc_accum * s->rc_k) + (v * s->rc_l)) >> RC_BITS;
    s->rc_accum = rc_out;
    v = rc_out;

    // output mix
    int32_t m = s->mask ? 0 : v;
    b[0] = (m * s->sm[0]) >> 7;
    b[1] = (m * s->sm[1]) >> 7;
    return 2;
}

bool nes_fds_Write (nes_fds_t* s, uint32_t adr, uint32_t val)
{
    // $4023 master I/O enable/disable
    if (adr == 0x4023)
    {
        s->master_io = ((val & 2) != 0);
        return true;
    }

    if (!s->master_io)
        return false;
    if (adr < 0x4040 || adr > 0x408A)
        return false;

    if (adr < 0x4080) // $4040-407F wave table write
    {
        if (s->wav_write)
            s->wave[TWAV][adr - 0x4040] = val & 0x3F;
        return true;
    }

    switch (adr & 0x00FF)
    {
    case 0x80: // $4080 volume envelope
        s->env_disable[EVOL] = ((val & 0x80) != 0);
        s->env_mode[EVOL] = ((val & 0x40) != 0);
        s->env_timer[EVOL] = 0;
        s->env_speed[EVOL] = val & 0x3F;
        if (s->env_disable[EVOL])
            s->env_out[EVOL] = s->env_speed[EVOL];
        return true;
    case 0x81: // $4081 ---
        return false;
    case 0x82: // $4082 wave frequency low
        s->freq[TWAV] = (s->freq[TWAV] & 0xF00) | val;
        return true;
    case 0x83: // $4083 wave frequency high / enables
        s->freq[TWAV] = (s->freq[TWAV] & 0x0FF) | ((val & 0x0F) << 8);
        s->wav_halt = ((val & 0x80) != 0);
        s->env_halt = ((val & 0x40) != 0);
        if (s->wav_halt)
            s->phase[TWAV] = 0;
        if (s->env_halt)
        {
            s->env_timer[EMOD] = 0;
            s->env_timer[EVOL] = 0;
        }
        return true;
    case 0x84: // $4084 mod envelope
        s->env_disable[EMOD] = ((val & 0x80) != 0);
        s->env_mode[EMOD] = ((val & 0x40) != 0);
        s->env_timer[EMOD] = 0;
        s->env_speed[EMOD] = val & 0x3F;
        if (s->env_disable[EMOD])
            s->env_out[EMOD] = s->env_speed[EMOD];
        return true;
    case 0x85: // $4085 mod position
        s->mod_pos = val & 0x7F;
        // not hardware accurate., but prevents detune due to cycle inaccuracies
        // (notably in Bio Miracle Bokutte Upa)
        if (s->option[NES_FDS_OPT_4085_RESET])
            s->phase[TMOD] = s->mod_write_pos << 16;
        return true;
    case 0x86: // $4086 mod frequency low
        s->freq[TMOD] = (s->freq[TMOD] & 0xF00) | val;
        return true;
    case 0x87: // $4087 mod frequency high / enable
        s->freq[TMOD] = (s->freq[TMOD] & 0x0FF) | ((val & 0x0F) << 8);
        s->mod_halt = ((val & 0x80) != 0);
        if (s->mod_halt)
            s->phase[TMOD] = s->phase[TMOD] & 0x3F0000; // reset accumulator phase
        return true;
    case 0x88: // $4088 mod table write
        if (s->mod_halt)
        {
            // writes to current playback position (there is no direct way to set phase)
            s->wave[TMOD][(s->phase[TMOD] >> 16) & 0x3F] = val & 0x07;
            s->phase[TMOD] = (s->phase[TMOD] + 0x010000) & 0x3FFFFF;
            s->wave[TMOD][(s->phase[TMOD] >> 16) & 0x3F] = val & 0x07;
            s->phase[TMOD] = (s->phase[TMOD] + 0x010000) & 0x3FFFFF;
            s->mod_write_pos = s->phase[TMOD] >> 16; // used by OPT_4085_RESET
        }
        return true;
    case 0x89: // $4089 wave write enable, master volume
        s->wav_write = ((val & 0x80) != 0);
        s->master_vol = val & 0x03;
        return true;
    case 0x8A: // $408A envelope speed
        s->master_env_speed = val;
        // haven't tested whether this register resets phase on hardware,
        // but this ensures my inplementation won't spam envelope clocks
        // if this value suddenly goes low.
        s->env_timer[EMOD] = 0;
        s->env_timer[EVOL] = 0;
        return true;
    default:
        return false;
    }
    return false;
}

bool nes_fds_Read (nes_fds_t* s, uint32_t adr, uint32_t* val)
{
    if (adr >= 0x4040 && adr <= 0x407F)
    {
        // TODO: if wav_write is not enabled, the
        // read address may not be reliable? need
        // to test this on hardware.
        *val = s->wave[TWAV][adr - 0x4040];
        return true;
    }

    if (adr == 0x4090) // $4090 read volume envelope
    {
        *val = s->env_out[EVOL] | 0x40;
        return true;
    }

    if (adr == 0x4092) // $4092 read mod envelope
    {
        *val = s->env_out[EMOD] | 0x40;
        return true;
    }

    return false;
}

void nes_mmc5_SetMask(nes_fds_t* s, int m)
{
  s->mask = m&1;
}
