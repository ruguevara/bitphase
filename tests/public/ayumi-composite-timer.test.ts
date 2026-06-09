import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
	TIMER_LAYER_ENVELOPE_SHAPE,
	TIMER_LAYER_TONE
} from '../../public/ay-timer-effect-constants.js';

type AyumiWasm = {
	memory: WebAssembly.Memory;
	malloc: (size: number) => number;
	free: (ptr: number) => void;
	ayumi_struct_size: () => number;
	ayumi_configure: (
		ptr: number,
		isYm: number,
		clockRate: number,
		sampleRate: number,
		isStereo: number
	) => number;
	ayumi_set_timer_effect: (
		ptr: number,
		channel: number,
		enabled: number,
		layers: number,
		pwmMode: number,
		period: number,
		periodLow: number,
		baseVolume: number,
		baseTonePeriod: number,
		baseEnvelopePeriod: number,
		fmOffsetMode: number
	) => void;
	ayumi_set_timer_effect_waveform: (
		ptr: number,
		channel: number,
		layer: number,
		valuesPtr: number,
		length: number,
		loop: number
	) => void;
	ayumi_process: (ptr: number) => void;
	ayumi_get_registers: (ptr: number, outPtr: number) => void;
};

async function loadAyumiWasm(): Promise<AyumiWasm> {
	const wasmPath = path.join(process.cwd(), 'public/ayumi.wasm');
	const wasm = readFileSync(wasmPath);
	const { instance } = await WebAssembly.instantiate(wasm, {
		env: { emscripten_notify_memory_growth: () => {} }
	});
	return instance.exports as AyumiWasm;
}

describe('ayumi composite timer per-layer lengths', () => {
	it('keeps a single-step sync envelope shape when combined with two-step fm', async () => {
		const wasm = await loadAyumiWasm();
		const ayumiPtr = wasm.malloc(wasm.ayumi_struct_size());
		wasm.ayumi_configure(ayumiPtr, 1, 2_000_000, 44_100, 0);

		const layers = TIMER_LAYER_ENVELOPE_SHAPE | TIMER_LAYER_TONE;
		wasm.ayumi_set_timer_effect(ayumiPtr, 0, 1, layers, 0, 1, 1, 0, 100, 100, 1, 0);

		const waveformPtr = wasm.malloc(8);
		const heap = new Int32Array(wasm.memory.buffer);
		const waveformOffset = waveformPtr >> 2;

		heap[waveformOffset] = 8;
		wasm.ayumi_set_timer_effect_waveform(
			ayumiPtr,
			0,
			TIMER_LAYER_ENVELOPE_SHAPE,
			waveformPtr,
			1,
			0
		);

		heap[waveformOffset] = 0;
		heap[waveformOffset + 1] = 7;
		wasm.ayumi_set_timer_effect_waveform(ayumiPtr, 0, TIMER_LAYER_TONE, waveformPtr, 2, 0);

		const registersPtr = wasm.malloc(14);
		const shapes = new Set<number>();
		for (let i = 0; i < 5_000; i += 1) {
			wasm.ayumi_process(ayumiPtr);
		}
		for (let i = 0; i < 100; i += 1) {
			wasm.ayumi_process(ayumiPtr);
			wasm.ayumi_get_registers(ayumiPtr, registersPtr);
			const registers = new Uint8Array(wasm.memory.buffer, registersPtr, 14);
			shapes.add(registers[13]!);
		}

		expect(shapes).toEqual(new Set([8]));

		wasm.free(waveformPtr);
		wasm.free(registersPtr);
		wasm.free(ayumiPtr);
	});
});
