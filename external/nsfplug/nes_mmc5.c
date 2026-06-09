#include "nes_mmc5.h"
#include <stdint.h>

int32_t square_table[32];
int32_t pcm_table[256];

static int32_t calc_sqr (nes_mmc5_t* s, int i, uint32_t clocks);

void nes_mmc5_Init (nes_mmc5_t* s)
{
  s->option[NES_MMC5_OPT_NONLINEAR_MIXER] = true;
  s->option[NES_MMC5_OPT_PHASE_REFRESH] = true;
  s->frame_sequence_count = 0;

  // square nonlinear mix, same as 2A03
  square_table[0] = 0;
  for(int i=1;i<32;i++)
      square_table[i]=(int32_t)((8192.0*95.88)/(8128.0/i+100));

  // 2A03 style nonlinear pcm mix with double the bits
  //pcm_table[0] = 0;
  //int32_t wd = 22638;
  //for(int d=1;d<256; ++d)
  //    pcm_table[d] = (int32_t)((8192.0*159.79)/(100.0+1.0/((double)d/wd)));

  // linear pcm mix (actual hardware seems closer to this)
  pcm_table[0] = 0;
  double pcm_scale = 32.0;
  for (int d=1; d<256; ++d)
      pcm_table[d] = (int32_t)((double)d * pcm_scale);

  // stereo mix
  for(int c=0;c<2;++c)
      for(int t=0;t<3;++t)
          s->sm[c][t] = 128;
  nes_mmc5_Reset(s);
}

void nes_mmc5_Reset (nes_mmc5_t* s)
{
  int i;

  s->scounter[0] = 0;
  s->scounter[1] = 0;
  s->sphase[0] = 0;
  s->sphase[1] = 0;

  s->envelope_div[0] = 0;
  s->envelope_div[1] = 0;
  s->length_counter[0] = 0;
  s->length_counter[1] = 0;
  s->envelope_counter[0] = 0;
  s->envelope_counter[1] = 0;
  s->frame_sequence_count = 0;

  s->freq[0] = 0;
  s->freq[1] = 0;
  s->enable[0] = false;
  s->enable[1] = false;

  for (i = 0; i < 8; i++)
    nes_mmc5_Write (s, 0x5000 + i, 0);

  nes_mmc5_Write(s, 0x5015, 0);

  for (i = 0; i < 3; ++i)
      s->out[i] = 0;

  s->mask = 0;
  s->pcm = 0; // PCM channel
  s->pcm_mode = false; // write mode
}

void nes_mmc5_SetOption (nes_mmc5_t* s, int id, int val)
{
  if(id<NES_MMC5_OPT_END) s->option[id] = val;
}

void nes_mmc5_FrameSequence (nes_mmc5_t* s)
{
  // 240hz clock
  for (int i=0; i < 2; ++i)
  {
      bool divider = false;
      if (s->envelope_write[i])
      {
          s->envelope_write[i] = false;
          s->envelope_counter[i] = 15;
          s->envelope_div[i] = 0;
      }
      else
      {
          ++s->envelope_div[i];
          if (s->envelope_div[i] > s->envelope_div_period[i])
          {
              divider = true;
              s->envelope_div[i] = 0;
          }
      }
      if (divider)
      {
          if (s->envelope_loop[i] && s->envelope_counter[i] == 0)
              s->envelope_counter[i] = 15;
          else if (s->envelope_counter[i] > 0)
              --s->envelope_counter[i];
      }
  }

  // MMC5 length counter is clocked at 240hz, unlike 2A03
  for (int i=0; i < 2; ++i)
  {
      if (!s->envelope_loop[i] && (s->length_counter[i] > 0))
          --s->length_counter[i];
  }
}

int32_t calc_sqr (nes_mmc5_t* s, int i, uint32_t clocks)
{
  static const int16_t sqrtbl[4][16] = {
    {0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0},
    {1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1}
  };

  s->scounter[i] += clocks;
  while (s->scounter[i] > s->freq[i])
  {
      s->sphase[i] = (s->sphase[i] + 1) & 15;
      s->scounter[i] -= (s->freq[i] + 1);
  }

  int32_t ret = 0;
  if (s->length_counter[i] > 0)
  {
      // note MMC5 does not silence the highest 8 frequencies like APU,
      // because this is done by the sweep unit.

      int v = s->envelope_disable[i] ? s->volume[i] : s->envelope_counter[i];
      ret = sqrtbl[s->duty[i]][s->sphase[i]] ? v : 0;
  }

  return ret;
}

void nes_mmc5_TickFrameSequence (nes_mmc5_t* s, uint32_t clocks)
{
    s->frame_sequence_count += clocks;
    while (s->frame_sequence_count > 7458)
    {
        nes_mmc5_FrameSequence(s);
        s->frame_sequence_count -= 7458;
    }
}

void nes_mmc5_Tick (nes_mmc5_t* s, uint32_t clocks)
{
  s->out[0] = calc_sqr(s, 0, clocks);
  s->out[1] = calc_sqr(s, 1, clocks);
  s->out[2] = s->pcm;
}

uint32_t nes_mmc5_Render (nes_mmc5_t* s, int32_t b[2])
{
  s->out[0] = (s->mask & 1) ? 0 : s->out[0];
  s->out[1] = (s->mask & 2) ? 0 : s->out[1];
  s->out[2] = (s->mask & 4) ? 0 : s->out[2];

  int32_t m[3];

  if(s->option[NES_MMC5_OPT_NONLINEAR_MIXER])
  {
      // squares nonlinear
      int32_t voltage = square_table[s->out[0] + s->out[1]];
      m[0] = s->out[0] << 6;
      m[1] = s->out[1] << 6;
      int32_t ref = m[0] + m[1];
      if (ref > 0)
      {
          m[0] = (m[0] * voltage) / ref;
          m[1] = (m[1] * voltage) / ref;
      }
      else
      {
          m[0] = voltage;
          m[1] = voltage;
      }

      // pcm nonlinear
      m[2] = pcm_table[s->out[2]];
  }
  else
  {
      // squares
      m[0] = s->out[0] << 6;
      m[1] = s->out[1] << 6;

      // pcm channel
      m[2] = s->out[2] << 5;
  }

  // note polarity is flipped on output

  b[0]  = m[0] * -s->sm[0][0];
  b[0] += m[1] * -s->sm[0][1];
  b[0] += m[2] * -s->sm[0][2];
  b[0] >>= 7;

  b[1]  = m[0] * -s->sm[1][0];
  b[1] += m[1] * -s->sm[1][1];
  b[1] += m[2] * -s->sm[1][2];
  b[1] >>= 7;

  return 2;
}

bool nes_mmc5_Write (nes_mmc5_t* s, uint32_t adr, uint32_t val)
{
  int ch;

  static const uint8_t length_table[32] = {
      0x0A, 0xFE,
      0x14, 0x02,
      0x28, 0x04,
      0x50, 0x06,
      0xA0, 0x08,
      0x3C, 0x0A,
      0x0E, 0x0C,
      0x1A, 0x0E,
      0x0C, 0x10,
      0x18, 0x12,
      0x30, 0x14,
      0x60, 0x16,
      0xC0, 0x18,
      0x48, 0x1A,
      0x10, 0x1C,
      0x20, 0x1E
  };

  // if ((0x5c00 <= adr) && (adr < 0x5ff0))
  // {
  //   s->ram[adr & 0x3ff] = val;
  //   return true;
  // }
  // else if ((0x5000 <= adr) && (adr < 0x5008))
  // {
  //   s->reg[adr & 0x7] = val;
  // }

  switch (adr)
  {
  case 0x5000:
  case 0x5004:
    ch = (adr >> 2) & 1;
    s->volume[ch] = val & 15;
    s->envelope_disable[ch] = (val >> 4) & 1;
    s->envelope_loop[ch] = (val >> 5) & 1;
    s->envelope_div_period[ch] = (val & 15);
    s->duty[ch] = (val >> 6) & 3;
    break;

  case 0x5002:
  case 0x5006:
    ch = (adr >> 2) & 1;
    s->freq[ch] = val + (s->freq[ch] & 0x700);
    if (s->scounter[ch] > s->freq[ch]) s->scounter[ch] = s->freq[ch];
    break;

  case 0x5003:
  case 0x5007:
    ch = (adr >> 2) & 1;
    s->freq[ch] = (s->freq[ch] & 0xff) + ((val & 7) << 8);
    if (s->scounter[ch] > s->freq[ch]) s->scounter[ch] = s->freq[ch];
    // phase reset
    if (s->option[NES_MMC5_OPT_PHASE_REFRESH])
      s->sphase[ch] = 0;
    s->envelope_write[ch] = true;
    if (s->enable[ch])
    {
      s->length_counter[ch] = length_table[(val >> 3) & 0x1f];
    }
    break;

  // PCM channel control
  case 0x5010:
    s->pcm_mode = ((val & 1) != 0); // 0 = write, 1 = read
    break;

  // PCM channel control
  case 0x5011:
    if (!s->pcm_mode)
    {
        val &= 0xFF;
        if (val != 0) s->pcm = val;
    }
    break;

  case 0x5015:
    s->enable[0] = (val & 1) ? true : false;
    s->enable[1] = (val & 2) ? true : false;
    if (!s->enable[0])
        s->length_counter[0] = 0;
    if (!s->enable[1])
        s->length_counter[1] = 0;
    break;

  // case 0x5205:
  //   s->mreg[0] = val;
  //   break;

  // case 0x5206:
  //   s->mreg[1] = val;
  //   break;

  default:
    return false;

  }
  return true;
}

bool nes_mmc5_Read (nes_mmc5_t* s, uint32_t adr, uint32_t* val)
{
  // // in PCM read mode, reads from $8000-$C000 automatically load the PCM output
  // if (pcm_mode && (0x8000 <= adr) && (adr < 0xC000) && cpu)
  // {
  //     pcm_mode = false; // prevent recursive entry
  //     uint32_t pcm_read;
  //     s->cpu->Read(adr, pcm_read);
  //     pcm_read &= 0xFF;
  //     if (pcm_read != 0)
  //         pcm = pcm_read;
  //     pcm_mode = true;
  // }

  // if ((0x5000 <= adr) && (adr < 0x5008))
  // {
  //     *val = s->reg[adr&0x7];
  //     return true;
  // }
  // else if(adr == 0x5015)
  if(adr == 0x5015)
  {
      *val = (s->enable[1]?2:0)|(s->enable[0]?1:0);
      return true;
  }

  // if ((0x5c00 <= adr) && (adr < 0x5ff0))
  // {
  //   *val = ram[adr & 0x3ff];
  //   return true;
  // }
  // else if (adr == 0x5205)
  // {
  //   *val = (s->mreg[0] * s->mreg[1]) & 0xff;
  //   return true;
  // }
  // else if (adr == 0x5206)
  // {
  //   *val = (s->mreg[0] * s->mreg[1]) >> 8;
  //   return true;
  // }

  return false;
}

void nes_mmc5_SetStereoMix(nes_mmc5_t* s, int trk, int32_t mixl, int32_t mixr)
{
    if (trk < 0) return;
    if (trk > 2) return;
    s->sm[0][trk] = mixl;
    s->sm[1][trk] = mixr;
}

// // pcm read mode requires CPU read access
// void nes_mmc5_SetCPU(nes_mmc5_t* s, NES_CPU* cpu_)
// {
//     s->cpu = cpu_;
// }

void nes_mmc5_SetMask(nes_mmc5_t* s, int m)
{
  s->mask = m;
}
