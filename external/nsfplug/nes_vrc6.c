#include "nes_vrc6.h"

static int16_t calc_sqr (nes_vrc6_t* s, int i, uint32_t clocks);
static int16_t calc_saw (nes_vrc6_t* s, uint32_t clocks);

void nes_vrc6_Init (nes_vrc6_t* s)
{
  s->halt = false;
  s->freq_shift = 0;

  for(int c=0;c<2;++c)
      for(int t=0;t<3;++t)
          s->sm[c][t] = 128;
  nes_vrc6_Reset(s);
}

void nes_vrc6_SetStereoMix(nes_vrc6_t* s, int trk, int32_t mixl, int32_t mixr)
{
    if (trk < 0) return;
    if (trk > 2) return;
    s->sm[0][trk] = mixl;
    s->sm[1][trk] = mixr;
}

void nes_vrc6_SetOption (nes_vrc6_t* s, int id, int val)
{
  if(id<NES_VRC6_OPT_END)
  {
    //option[id] = val;
  }
}

void nes_vrc6_Reset (nes_vrc6_t* s)
{
  s->freq[0] = 0;
  s->freq[1] = 0;
  s->freq[2] = 0;
  s->counter[0] = 0;
  s->counter[1] = 0;
  s->counter[2] = 0;
  s->enable[0] = 0;
  s->enable[1] = 0;
  s->enable[2] = 0;
  nes_vrc6_Write (s, 0x9003, 0);
  for (int i = 0; i < 3; i++)
  {
    nes_vrc6_Write (s, 0x9000 + i, 0);
    nes_vrc6_Write (s, 0xa000 + i, 0);
    nes_vrc6_Write (s, 0xb000 + i, 0);
  }
  s->count14 = 0;
  s->mask = 0;
  s->phase[0] = 0;
  s->phase[1] = 0;
  s->phase[2] = 0;
}

int16_t calc_sqr (nes_vrc6_t* s, int i, uint32_t clocks)
{
  static const int16_t sqrtbl[8][16] = {
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1},
    {0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1}
  };

  if (!s->enable[i])
    return 0;

  if (!s->halt)
  {
    s->counter[i] += clocks;
    while(s->counter[i] > s->freq2[i])
    {
        s->phase[i] = (s->phase[i] + 1) & 15;
        s->counter[i] -= (s->freq2[i] + 1);
    }
  }

  return (s->gate[i]
    || sqrtbl[s->duty[i]][s->phase[i]])? s->volume[i] : 0;
}

int16_t calc_saw (nes_vrc6_t* s, uint32_t clocks)
{
  if (!s->enable[2])
    return 0;

  if (!s->halt)
  {
    s->counter[2] += clocks;
    while(s->counter[2] > s->freq2[2])
    {
        s->counter[2] -= (s->freq2[2] + 1);

        // accumulate saw
        ++s->count14;
        if (s->count14 >= 14)
        {
          s->count14 = 0;
          s->phase[2] = 0;
        }
        else if (0 == (s->count14 & 1)) // only accumulate on even ticks
        {
          s->phase[2] = (s->phase[2] + s->volume[2]) & 0xFF; // note 8-bit wrapping behaviour
        }
    }
  }

  // only top 5 bits of saw are output
  return s->phase[2] >> 3;
}

void nes_vrc6_Tick (nes_vrc6_t* s, uint32_t clocks)
{
  s->out[0] = calc_sqr(s, 0, clocks);
  s->out[1] = calc_sqr(s, 1, clocks);
  s->out[2] = calc_saw(s, clocks);
}

uint32_t nes_vrc6_Render (nes_vrc6_t* s, int32_t b[2])
{
  int32_t m[3];
  m[0] = s->out[0];
  m[1] = s->out[1];
  m[2] = s->out[2];

  // note: signal is inverted compared to 2A03

  m[0] = (s->mask & 1) ? 0 : -m[0];
  m[1] = (s->mask & 2) ? 0 : -m[1];
  m[2] = (s->mask & 4) ? 0 : -m[2];

  b[0]  = m[0] * s->sm[0][0];
  b[0] += m[1] * s->sm[0][1];
  b[0] += m[2] * s->sm[0][2];
  //b[0] >>= (7 - 7);

  b[1]  = m[0] * s->sm[1][0];
  b[1] += m[1] * s->sm[1][1];
  b[1] += m[2] * s->sm[1][2];
  //b[1] >>= (7 - 7);

  // master volume adjustment
  const int32_t MASTER = (int32_t)(256.0 * 1223.0 / 1920.0);
  b[0] = (b[0] * MASTER) >> 8;
  b[1] = (b[1] * MASTER) >> 8;

  return 2;
}

bool nes_vrc6_Write (nes_vrc6_t* s, uint32_t adr, uint32_t val)
{
  int ch, cmap[4] = { 0, 0, 1, 2 };

  switch (adr)
  {
  case 0x9000:
  case 0xa000:
    ch = cmap[(adr >> 12) & 3];
    s->volume[ch] = val & 15;
    s->duty[ch] = (val >> 4) & 7;
    s->gate[ch] = (val >> 7) & 1;
    break;
  case 0xb000:
    s->volume[2] = val & 63;
    break;

  case 0x9001:
  case 0xa001:
  case 0xb001:
    ch = cmap[(adr >> 12) & 3];
    s->freq[ch] = (s->freq[ch] & 0xf00) | val;
    s->freq2[ch] = (s->freq[ch] >> s->freq_shift);
    if (s->counter[ch] > s->freq2[ch]) s->counter[ch] = s->freq2[ch];
    break;

  case 0x9002:
  case 0xa002:
  case 0xb002:
    ch = cmap[(adr >> 12) & 3];
    s->freq[ch] = ((val & 0xf) << 8) + (s->freq[ch] & 0xff);
    s->freq2[ch] = (s->freq[ch] >> s->freq_shift);
    if (s->counter[ch] > s->freq2[ch]) s->counter[ch] = s->freq2[ch];
    if (!s->enable[ch]) // if enable is being turned on, phase should be reset
    {
      if (ch == 2)
      {
        s->count14 = 0; // reset saw
      }
      s->phase[ch] = 0;
    }
    s->enable[ch] = (val >> 7) & 1;
    break;

  case 0x9003:
    s->halt = val & 1;
    s->freq_shift =
        (val & 4) ? 8 :
        (val & 2) ? 4 :
        0;
    s->freq2[0] = (s->freq[0] >> s->freq_shift);
    s->freq2[1] = (s->freq[1] >> s->freq_shift);
    s->freq2[2] = (s->freq[2] >> s->freq_shift);
    if (s->counter[0] > s->freq2[0]) s->counter[0] = s->freq2[0];
    if (s->counter[1] > s->freq2[1]) s->counter[1] = s->freq2[1];
    if (s->counter[2] > s->freq2[2]) s->counter[2] = s->freq2[2];
    break;

  default:
    return false;

  }

  return true;
}

bool nes_vrc6_Read (nes_vrc6_t* s, uint32_t adr, uint32_t* val)
{
  return false;
}
