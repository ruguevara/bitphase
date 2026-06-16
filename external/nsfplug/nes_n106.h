#ifndef _NES_N106_H_
#define _NES_N106_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct nes_n106
{
  enum
  {
    NES_N106_OPT_SERIAL = 0,
    NES_N106_OPT_PHASE_READ_ONLY = 1,
    NES_N106_OPT_LIMIT_WAVELENGTH = 2,
    NES_N106_OPT_END
  };

  int mask;
  int32_t sm[2][8]; // stereo mix
  int32_t fout[8]; // current output
  int option[NES_N106_OPT_END];

  bool master_disable;
  uint32_t reg[0x80]; // all state is contained here
  unsigned int reg_select;
  bool reg_advance;
  int tick_channel;
  int tick_clock;
  int render_channel;
  int render_clock;
  int render_subclock;
} nes_n106_t;

// convenience functions to interact with regs
inline uint32_t nes_n106_get_phase (nes_n106_t* s, int channel);
inline uint32_t nes_n106_get_freq (nes_n106_t* s, int channel);
inline uint32_t nes_n106_get_off (nes_n106_t* s, int channel);
inline uint32_t nes_n106_get_len (nes_n106_t* s, int channel);
inline int32_t  nes_n106_get_vol (nes_n106_t* s, int channel);
inline int32_t  nes_n106_get_sample (nes_n106_t* s, uint32_t index);
inline int    nes_n106_get_channels (nes_n106_t* s);
// for storing back the phase after modifying
inline void   nes_n106_set_phase (nes_n106_t* s, uint32_t phase, int channel);

void nes_n106_Init (nes_n106_t* s);
void nes_n106_Reset (nes_n106_t* s);
void nes_n106_Tick (nes_n106_t* s, uint32_t clocks);
uint32_t nes_n106_Render (nes_n106_t* s, int32_t b[2]);
bool nes_n106_Write (nes_n106_t* s, uint32_t adr, uint32_t val);
bool nes_n106_Read (nes_n106_t* s, uint32_t adr, uint32_t* val);
void nes_n106_SetOption (nes_n106_t* s, int id, int b);
void nes_n106_SetMask (nes_n106_t* s, int m);
void nes_n106_SetStereoMix (nes_n106_t* s, int trk, int32_t mixl, int32_t mixr);

#endif
