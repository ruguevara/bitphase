import { describe, it, expect, vi } from 'vitest';
import {
	applySoftwarePwmPhaseStep,
	hasSoftwarePwmChannels,
	processAyumiOneOutputSample
} from '../../public/ayumi-render-sample.js';
import AyumiEngine from '../../public/ayumi-engine.js';
import AYChipRegisterState from '../../public/ay-chip-register-state.js';
import VirtualChannelMixer from '../../public/virtual-channel-mixer.js';

describe('ayumi-render-sample', () => {
	it('hasSoftwarePwmChannels is false when none active', () => {
		expect(hasSoftwarePwmChannels({ channelPwmActive: [false, false, false] })).toBe(false);
	});

	it('applySoftwarePwmPhaseStep sets pwm channel volume from phase', () => {
		const state = {
			channelPwmActive: [true, false, false],
			channelPwmPhase: [0],
			channelPwmPeriodReg: [-1],
			channelPwmVolumeHigh: [10],
			aymFrequency: 1773400
		};
		const registerState = new AYChipRegisterState(3);
		registerState.channels[0].tone = 100;

		applySoftwarePwmPhaseStep(state, registerState, 44100, 8, 1773400);

		expect(typeof registerState.channels[0].volume).toBe('number');
		expect(state.channelPwmPhase[0]).toBeGreaterThanOrEqual(0);
		expect(state.channelPwmPhase[0]).toBeLessThan(1);
	});

	it('processAyumiOneOutputSample calls ayumi_process when no pwm', () => {
		const mockWasm = {
			ayumi_process: vi.fn()
		};
		const engine = new AyumiEngine(mockWasm as never, 1);
		const registerState = new AYChipRegisterState(3);
		const state = { channelPwmActive: [false, false, false] };
		const mixer = new VirtualChannelMixer();

		processAyumiOneOutputSample(mockWasm as never, 1, engine, registerState, state, mixer, 44100);

		expect(mockWasm.ayumi_process).toHaveBeenCalledWith(1);
	});
});
