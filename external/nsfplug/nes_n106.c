#include <string.h>
#include "nes_n106.h"

void nes_n106_Init (nes_n106_t* s)
{
    s->option[NES_N106_OPT_SERIAL] = 0;
    s->option[NES_N106_OPT_PHASE_READ_ONLY] = 0;
    s->option[NES_N106_OPT_LIMIT_WAVELENGTH] = 0;
    for (int i=0; i < 8; ++i)
    {
        s->sm[0][i] = 128;
        s->sm[1][i] = 128;
    }
    nes_n106_Reset(s);
}

void nes_n106_SetStereoMix (nes_n106_t* s, int trk, int32_t mixl, int32_t mixr)
{
    if (trk < 0 || trk >= 8) return;
    trk = 7-trk; // displayed channels are inverted
    s->sm[0][trk] = mixl;
    s->sm[1][trk] = mixr;
}

void nes_n106_SetMask (nes_n106_t* s, int m)
{
    // bit reverse the mask,
    // N163 waves are displayed in reverse order
    s->mask = 0
        | ((m & (1<<0)) ? (1<<7) : 0)
        | ((m & (1<<1)) ? (1<<6) : 0)
        | ((m & (1<<2)) ? (1<<5) : 0)
        | ((m & (1<<3)) ? (1<<4) : 0)
        | ((m & (1<<4)) ? (1<<3) : 0)
        | ((m & (1<<5)) ? (1<<2) : 0)
        | ((m & (1<<6)) ? (1<<1) : 0)
        | ((m & (1<<7)) ? (1<<0) : 0);
}

void nes_n106_SetOption (nes_n106_t* s, int id, int val)
{
    if (id<NES_N106_OPT_END) s->option[id] = val;
}

void nes_n106_Reset (nes_n106_t* s)
{
    s->master_disable = false;
    memset(s->reg, 0, sizeof(s->reg));
    s->reg_select = 0;
    s->reg_advance = false;
    s->tick_channel = 0;
    s->tick_clock = 0;
    s->render_channel = 0;
    s->render_clock = 0;
    s->render_subclock = 0;

    for (int i=0; i<8; ++i) s->fout[i] = 0;

    nes_n106_Write(s, 0xE000, 0x00); // master disable off
    nes_n106_Write(s, 0xF800, 0x80); // select $00 with auto-increment
    for (unsigned int i=0; i<0x80; ++i) // set all regs to 0
    {
        nes_n106_Write(s, 0x4800, 0x00);
    }
    nes_n106_Write(s, 0xF800, 0x00); // select $00 without auto-increment
}

void nes_n106_Tick (nes_n106_t* s, uint32_t clocks)
{
    if (s->master_disable) return;

    int channels = nes_n106_get_channels(s);

    s->tick_clock += clocks;
    s->render_clock += clocks; // keep render in sync
    while (s->tick_clock > 0)
    {
        int channel = 7-s->tick_channel;

        uint32_t phase = nes_n106_get_phase(s, channel);
        uint32_t freq  = nes_n106_get_freq(s, channel);
        uint32_t len   = nes_n106_get_len(s, channel);
        uint32_t off   = nes_n106_get_off(s, channel);
        int32_t  vol   = nes_n106_get_vol(s, channel);

        // accumulate 24-bit phase
        phase = (phase + freq) & 0x00FFFFFF;

        // wrap phase if wavelength exceeded
        uint32_t hilen = len << 16;
        while (phase >= hilen) phase -= hilen;

        // write back phase
        nes_n106_set_phase(s, phase, channel);

        // fetch sample (note: N163 output is centred at 8, and inverted w.r.t 2A03)
        int32_t sample = 8 - nes_n106_get_sample(s, ((phase >> 16) + off) & 0xFF);
        s->fout[channel] = sample * vol;

        // cycle to next channel every 15 clocks
        s->tick_clock -= 15;
        ++s->tick_channel;
        if (s->tick_channel >= channels)
            s->tick_channel = 0;
    }
}

uint32_t nes_n106_Render (nes_n106_t* s, int32_t b[2])
{
    b[0] = 0;
    b[1] = 0;
    if (s->master_disable) return 2;

    int channels = nes_n106_get_channels(s);

    if (s->option[NES_N106_OPT_SERIAL]) // hardware accurate serial multiplexing
    {
        // this could be made more efficient than going clock-by-clock
        // but this way is simpler
        int clocks = s->render_clock;
        while (clocks > 0)
        {
            int c = 7-s->render_channel;
            if (0 == ((s->mask >> c) & 1))
            {
                b[0] += s->fout[c] * s->sm[0][c];
                b[1] += s->fout[c] * s->sm[1][c];
            }

            ++s->render_subclock;
            if (s->render_subclock >= 15) // each channel gets a 15-cycle slice
            {
                s->render_subclock = 0;
                ++s->render_channel;
                if (s->render_channel >= channels)
                    s->render_channel = 0;
            }
            --clocks;
        }

        // increase output level by 1 bits (7 bits already added from sm)
        b[0] <<= 1;
        b[1] <<= 1;

        // average the output
        if (s->render_clock > 0)
        {
            b[0] /= s->render_clock;
            b[1] /= s->render_clock;
        }
        s->render_clock = 0;
    }
    else // just mix all channels
    {
        for (int i = (8-channels); i<8; ++i)
        {
            if (0 == ((s->mask >> i) & 1))
            {
                b[0] += s->fout[i] * s->sm[0][i];
                b[1] += s->fout[i] * s->sm[1][i];
            }
        }

        // mix together, increase output level by 8 bits, roll off 7 bits from sm
        int32_t MIX[9] = { 256/1, 256/1, 256/2, 256/3, 256/4, 256/5, 256/6, 256/6, 256/6 };
        b[0] = (b[0] * MIX[channels]) >> 7;
        b[1] = (b[1] * MIX[channels]) >> 7;
        // when approximating the serial multiplex as a straight mix, once the
        // multiplex frequency gets below the nyquist frequency an average mix
        // begins to sound too quiet. To approximate this effect, I don't attenuate
        // any further after 6 channels are active.
    }

    // 8 bit approximation of master volume
    // max N163 vol vs max APU square
    // unfortunately, games have been measured as low as 3.4x and as high as 8.5x
    // with higher volumes on Erika, King of Kings, and Rolling Thunder
    // and lower volumes on others. Using 6.0x as a rough "one size fits all".
    const double MASTER_VOL = 6.0 * 1223.0;
    const double MAX_OUT = 15.0 * 15.0 * 256.0; // max digital value
    const int32_t GAIN = (int)((MASTER_VOL / MAX_OUT) * 256.0f);
    b[0] = (b[0] * GAIN) >> 8;
    b[1] = (b[1] * GAIN) >> 8;

    return 2;
}

bool nes_n106_Write (nes_n106_t* s, uint32_t adr, uint32_t val)
{
    if (adr == 0xE000) // master disable
    {
        s->master_disable = ((val & 0x40) != 0);
        return true;
    }
    else if (adr == 0xF800) // register select
    {
        s->reg_select = (val & 0x7F);
        s->reg_advance = (val & 0x80) != 0;
        return true;
    }
    else if (adr == 0x4800) // register write
    {
        if (s->option[NES_N106_OPT_PHASE_READ_ONLY]) // old emulators didn't know phase was stored here
        {
            int c = 15 - (s->reg_select/8);
            int r = s->reg_select & 7;
            if (c < nes_n106_get_channels(s) &&
                (r == 1 ||
                 r == 3 ||
                 r == 5))
            {
                if (s->reg_advance)
                    s->reg_select = (s->reg_select + 1) & 0x7F;
                return true;
            }
        }
        if (s->option[NES_N106_OPT_LIMIT_WAVELENGTH]) // old emulators ignored top 3 bits of length
        {
            int c = 15 - (s->reg_select/8);
            int r = s->reg_select & 7;
            if (c < nes_n106_get_channels(s) && r == 4)
            {
                val |= 0xE0;
            }
        }
        s->reg[s->reg_select] = val;
        if (s->reg_advance)
            s->reg_select = (s->reg_select + 1) & 0x7F;
        return true;
    }
    return false;
}

bool nes_n106_Read (nes_n106_t* s, uint32_t adr, uint32_t* val)
{
    if (adr == 0x4800) // register read
    {
        *val = s->reg[s->reg_select];
        if (s->reg_advance)
            s->reg_select = (s->reg_select + 1) & 0x7F;
        return true;
    }
    return false;
}

//
// register decoding/encoding functions
//

inline uint32_t nes_n106_get_phase (nes_n106_t* s, int channel)
{
    // 24-bit phase stored in channel regs 1/3/5
    channel = channel << 3;
    return (s->reg[0x41 + channel]      )
        +  (s->reg[0x43 + channel] << 8 )
        +  (s->reg[0x45 + channel] << 16);
}

inline uint32_t nes_n106_get_freq (nes_n106_t* s, int channel)
{
    // 19-bit frequency stored in channel regs 0/2/4
    channel = channel << 3;
    return ( s->reg[0x40 + channel]              )
        +  ( s->reg[0x42 + channel]         << 8 )
        +  ((s->reg[0x44 + channel] & 0x03) << 16);
}

inline uint32_t nes_n106_get_off (nes_n106_t* s, int channel)
{
    // 8-bit offset stored in channel reg 6
    channel = channel << 3;
    return s->reg[0x46 + channel];
}

inline uint32_t nes_n106_get_len (nes_n106_t* s, int channel)
{
    // 6-bit<<3 length stored obscurely in channel reg 4
    channel = channel << 3;
    return 256 - (s->reg[0x44 + channel] & 0xFC);
}

inline int32_t nes_n106_get_vol (nes_n106_t* s, int channel)
{
    // 4-bit volume stored in channel reg 7
    channel = channel << 3;
    return s->reg[0x47 + channel] & 0x0F;
}

inline int32_t nes_n106_get_sample (nes_n106_t* s, uint32_t index)
{
    // every sample becomes 2 samples in regs
    return (index&1) ?
        ((s->reg[index>>1] >> 4) & 0x0F) :
        ( s->reg[index>>1]       & 0x0F) ;
}

inline int nes_n106_get_channels (nes_n106_t* s)
{
    // 3-bit channel count stored in reg 0x7F
    return ((s->reg[0x7F] >> 4) & 0x07) + 1;
}

inline void nes_n106_set_phase (nes_n106_t* s, uint32_t phase, int channel)
{
    // 24-bit phase stored in channel regs 1/3/5
    channel = channel << 3;
    s->reg[0x41 + channel] =  phase        & 0xFF;
    s->reg[0x43 + channel] = (phase >> 8 ) & 0xFF;
    s->reg[0x45 + channel] = (phase >> 16) & 0xFF;
}
