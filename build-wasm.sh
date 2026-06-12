#!/bin/bash

# Source Emscripten environment if EMSDK is set
if [ -n "$EMSDK" ]; then
    source "$EMSDK/emsdk_env.sh"
fi

if ! command -v emcc &> /dev/null; then
    if [ -f public/ayumi.wasm ]; then
        echo "Warning: emcc not found, reusing existing public/ayumi.wasm (may be stale if external/ayumi changed)."
        exit 0
    fi
    echo "Error: emcc not found and no prebuilt public/ayumi.wasm. Install Emscripten (e.g. 'brew install emscripten') or set EMSDK."
    exit 1
fi

emcc external/ayumi/ayumi.c \
    -o public/ayumi.wasm \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_ayumi_configure", "_ayumi_set_pan", "_ayumi_set_tone", "_ayumi_set_noise", "_ayumi_set_mixer", "_ayumi_set_volume", "_ayumi_set_timer_effect", "_ayumi_set_timer_effect_slot", "_ayumi_set_timer_effect_waveform", "_ayumi_timer_effect_reset", "_ayumi_get_timer_effect_active_period", "_ayumi_get_registers", "_ayumi_struct_size", "_ayumi_set_envelope", "_ayumi_set_envelope_shape", "_ayumi_process", "_ayumi_remove_dc", "_malloc", "_free"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=16777216 \
    -s ENVIRONMENT='web' \
    -s STANDALONE_WASM=1 \
    --no-entry
