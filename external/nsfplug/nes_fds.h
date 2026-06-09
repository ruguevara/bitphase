#ifndef _NES_FDS_H_
#define _NES_FDS_H_

#include <stdint.h>
#include <stdbool.h>

typedef struct nes_fds
{
    enum
    {
        NES_FDS_OPT_CUTOFF=0,
        NES_FDS_OPT_4085_RESET,
        NES_FDS_OPT_WRITE_PROTECT,
        NES_FDS_OPT_END
    };

    double rate, clock;
    int mask;
    int32_t sm[2]; // stereo mix
    int32_t fout; // current output
    int option[NES_FDS_OPT_END];

    bool master_io;
    uint32_t master_vol;
    uint32_t last_freq; // for trackinfo
    uint32_t last_vol;  // for trackinfo

    // two wavetables
    enum { TMOD=0, TWAV=1 };
    int32_t wave[2][64];
    uint32_t freq[2];
    uint32_t phase[2];
    bool wav_write;
    bool wav_halt;
    bool env_halt;
    bool mod_halt;
    uint32_t mod_pos;
    uint32_t mod_write_pos;

    // two ramp envelopes
    enum { EMOD=0, EVOL=1 };
    bool env_mode[2];
    bool env_disable[2];
    uint32_t env_timer[2];
    uint32_t env_speed[2];
    uint32_t env_out[2];
    uint32_t master_env_speed;

    // 1-pole RC lowpass filter
    int32_t rc_accum;
    int32_t rc_k;
    int32_t rc_l;
} nes_fds_t;

void nes_fds_Init (nes_fds_t* s);
void nes_fds_Reset (nes_fds_t* s);
void nes_fds_Tick (nes_fds_t* s, uint32_t clocks);
uint32_t nes_fds_Render (nes_fds_t* s, int32_t b[2]);
bool nes_fds_Write (nes_fds_t* s, uint32_t adr, uint32_t val);
bool nes_fds_Read (nes_fds_t* s, uint32_t adr, uint32_t* val);
void nes_fds_SetRate (nes_fds_t* s, double r);
void nes_fds_SetOption (nes_fds_t* s, int id, int b);
void nes_fds_SetMask(nes_fds_t* s, int m);
void nes_fds_SetStereoMix (nes_fds_t* s, int trk, int32_t mixl, int32_t mixr);

#endif
