import { describe, it, expect, vi, beforeEach } from 'vitest';
import AyumiEngine from '../../public/ayumi-engine.js';
import AYChipRegisterState from '../../public/ay-chip-register-state.js';

describe('AyumiEngine', () => {
	let mockWasm: {
		ayumi_set_tone: ReturnType<typeof vi.fn>;
		ayumi_set_volume: ReturnType<typeof vi.fn>;
		ayumi_set_mixer: ReturnType<typeof vi.fn>;
		ayumi_set_noise: ReturnType<typeof vi.fn>;
		ayumi_set_envelope: ReturnType<typeof vi.fn>;
		ayumi_set_envelope_shape: ReturnType<typeof vi.fn>;
		ayumi_process: ReturnType<typeof vi.fn>;
		ayumi_remove_dc: ReturnType<typeof vi.fn>;
	};
	let mockPtr: number;

	beforeEach(() => {
		mockPtr = 12345;
		mockWasm = {
			ayumi_set_tone: vi.fn(),
			ayumi_set_volume: vi.fn(),
			ayumi_set_mixer: vi.fn(),
			ayumi_set_noise: vi.fn(),
			ayumi_set_envelope: vi.fn(),
			ayumi_set_envelope_shape: vi.fn(),
			ayumi_process: vi.fn(),
			ayumi_remove_dc: vi.fn()
		};
	});

	describe('constructor', () => {
		it('stores wasmModule and ayumiPtr', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			expect(engine.wasmModule).toBe(mockWasm);
			expect(engine.ayumiPtr).toBe(mockPtr);
		});

		it('has lastState as AYChipRegisterState', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			expect(engine.lastState).toBeInstanceOf(AYChipRegisterState);
		});
	});

	describe('applyRegisterState', () => {
		it('does nothing when wasmModule is null', () => {
			const engine = new AyumiEngine(null as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[0].tone = 500;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_tone).not.toHaveBeenCalled();
		});

		it('does nothing when ayumiPtr is null', () => {
			const engine = new AyumiEngine(mockWasm as any, null);
			const state = new AYChipRegisterState();
			state.channels[0].tone = 500;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_tone).not.toHaveBeenCalled();
		});

		it('calls ayumi_set_tone when channel tone differs from lastState', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[0].tone = 500;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_tone).toHaveBeenCalledWith(mockPtr, 0, 500);
		});

		it('calls ayumi_set_volume when channel volume differs', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[1].volume = 10;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_volume).toHaveBeenCalledWith(mockPtr, 1, 10);
		});

		it('calls ayumi_set_mixer when mixer differs', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[0].mixer.tone = true;
			state.channels[0].mixer.noise = true;
			state.channels[0].mixer.envelope = false;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_mixer).toHaveBeenCalledWith(mockPtr, 0, 0, 0, 0);
		});

		it('calls ayumi_set_noise when state.noise differs', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.noise = 5;
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_noise).toHaveBeenCalledWith(mockPtr, 5);
		});

		it('does not call set_tone again for same tone (lastState updated)', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[0].tone = 500;
			engine.applyRegisterState(state);
			mockWasm.ayumi_set_tone.mockClear();
			engine.applyRegisterState(state);
			expect(mockWasm.ayumi_set_tone).not.toHaveBeenCalled();
		});
	});

	describe('PCM slot exports', () => {
		it('hasPcmSlotExports is true when begin/output/finish exist', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			mockWasm.ayumi_begin_output_frame = vi.fn();
			mockWasm.ayumi_output_inner_slot = vi.fn();
			mockWasm.ayumi_finish_output_frame = vi.fn();
			expect(engine.hasPcmSlotExports()).toBe(true);
		});

		it('hasPcmSlotExports is false when begin is missing', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			mockWasm.ayumi_begin_output_frame = undefined as any;
			mockWasm.ayumi_output_inner_slot = vi.fn();
			mockWasm.ayumi_finish_output_frame = vi.fn();
			expect(engine.hasPcmSlotExports()).toBe(false);
		});

		it('calls ayumi_begin_output_frame when defined', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			mockWasm.ayumi_begin_output_frame = vi.fn();
			engine.beginOutputFrame();
			expect(mockWasm.ayumi_begin_output_frame).toHaveBeenCalledWith(mockPtr);
		});
	});

	describe('process', () => {
		it('calls ayumi_process when wasm and ptr set', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			engine.process();
			expect(mockWasm.ayumi_process).toHaveBeenCalledWith(mockPtr);
		});

		it('does nothing when wasmModule null', () => {
			const engine = new AyumiEngine(null as any, mockPtr);
			engine.process();
			expect(mockWasm.ayumi_process).not.toHaveBeenCalled();
		});
	});

	describe('removeDC', () => {
		it('calls ayumi_remove_dc when wasm and ptr set', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			engine.removeDC();
			expect(mockWasm.ayumi_remove_dc).toHaveBeenCalledWith(mockPtr);
		});
	});

	describe('reset', () => {
		it('resets lastState', () => {
			const engine = new AyumiEngine(mockWasm as any, mockPtr);
			const state = new AYChipRegisterState();
			state.channels[0].tone = 500;
			engine.applyRegisterState(state);
			engine.reset();
			expect(engine.lastState.channels[0].tone).toBe(0);
		});
	});
});
