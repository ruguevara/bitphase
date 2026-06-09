#ifndef _NES_MMC5_H_
#define _NES_MMC5_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct nes_mmc5
{
  enum
  { NES_MMC5_OPT_NONLINEAR_MIXER=0, NES_MMC5_OPT_PHASE_REFRESH, NES_MMC5_OPT_END };

  int option[NES_MMC5_OPT_END];
  int mask;
  int32_t sm[2][3]; // stereo panning
  // uint8_t ram[0x6000 - 0x5c00];
  // uint8_t reg[8];
  // uint8_t mreg[2];
  uint8_t pcm; // PCM channel
  bool pcm_mode; // PCM channel
  // NES_CPU* cpu; // PCM channel reads need CPU access

  uint32_t scounter[2];            // frequency divider
  uint32_t sphase[2];              // phase counter

  uint32_t duty[2];
  uint32_t volume[2];
  uint32_t freq[2];
  int32_t out[3];
  bool enable[2];

  bool envelope_disable[2];   // エンベロープ有効フラグ
  bool envelope_loop[2];      // エンベロープループ
  bool envelope_write[2];
  int envelope_div_period[2];
  int envelope_div[2];
  int envelope_counter[2];

  int length_counter[2];

  int frame_sequence_count;
} nes_mmc5_t;

void nes_mmc5_FrameSequence (nes_mmc5_t* s);
void nes_mmc5_TickFrameSequence (nes_mmc5_t* s, uint32_t clocks);

void nes_mmc5_Init (nes_mmc5_t* s);
void nes_mmc5_Reset (nes_mmc5_t* s);
void nes_mmc5_Tick (nes_mmc5_t* s, uint32_t clocks);
uint32_t nes_mmc5_Render (nes_mmc5_t* s, int32_t b[2]);
bool nes_mmc5_Write (nes_mmc5_t* s, uint32_t adr, uint32_t val);
bool nes_mmc5_Read (nes_mmc5_t* s, uint32_t adr, uint32_t* val);
void nes_mmc5_SetOption (nes_mmc5_t* s, int id, int b);
void nes_mmc5_SetMask (nes_mmc5_t* s, int m);
void nes_mmc5_SetStereoMix (nes_mmc5_t* s, int trk, int32_t mixl, int32_t mixr);

// void SetCPU(nes_mmc5_t* s, NES_CPU* cpu_);

#endif
