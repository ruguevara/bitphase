#ifndef _NES_VRC6_H_
#define _NES_VRC6_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct nes_vrc6
{
  enum
  {
    NES_VRC6_OPT_END
  };
  uint32_t counter[3]; // frequency divider
  uint32_t phase[3];   // phase counter
  uint32_t freq2[3];   // adjusted frequency
  int count14;       // saw 14-stage counter

  //int option[OPT_END];
  int mask;
  int32_t sm[2][3]; // stereo mix
  int duty[2];
  int volume[3];
  int enable[3];
  int gate[3];
  uint32_t freq[3];
  bool halt;
  int freq_shift;
  int32_t out[3];
} nes_vrc6_t;

void nes_vrc6_Init (nes_vrc6_t* s);
void nes_vrc6_Reset (nes_vrc6_t* s);
void nes_vrc6_Tick (nes_vrc6_t* s, uint32_t clocks);
uint32_t nes_vrc6_Render (nes_vrc6_t* s, int32_t b[2]);
bool nes_vrc6_Read (nes_vrc6_t* s, uint32_t adr, uint32_t* val);
bool nes_vrc6_Write (nes_vrc6_t* s, uint32_t adr, uint32_t val);
void nes_vrc6_SetOption (nes_vrc6_t* s, int id, int b);
void nes_vrc6_SetMask (nes_vrc6_t* s, int m);
void nes_vrc6_SetStereoMix (nes_vrc6_t* s, int trk, int32_t mixl, int32_t mixr);

#endif
