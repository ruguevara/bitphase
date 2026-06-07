import { describe, it, expect } from 'vitest';
import { sanitizeInstrumentForWorklet } from '@/lib/chips/ay/processor';
import { Instrument } from '@/lib/models/song';
import { MAX_INSTRUMENT_SAMPLE_BYTES } from '@/lib/utils/audio-sample-decode';

describe('sanitizeInstrumentForWorklet', () => {
	it('includes pwm fields for preview playback', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		const extended = instrument as Instrument & {
			timerRows?: { sid: boolean; timerWaveform?: number[] }[];
			timerPwmDuty?: number;
			timerPwmSweepMin?: number;
			timerPwmSweep?: number;
			timerPwmPreserveOnNewNote?: boolean;
			timerPwmReverseSweep?: boolean;
		};
		extended.timerRows = [{ sid: true, timerWaveform: [15, 0] }];
		extended.timerPwmDuty = 25;
		extended.timerPwmSweepMin = 5;
		extended.timerPwmSweep = 3;
		extended.timerPwmPreserveOnNewNote = true;
		extended.timerPwmReverseSweep = true;

		const sanitized = sanitizeInstrumentForWorklet(instrument);

		expect(sanitized.timerPwmDuty).toBe(25);
		expect(sanitized.timerPwmSweepMin).toBe(5);
		expect(sanitized.timerPwmSweep).toBe(3);
		expect(sanitized.timerPwmPreserveOnNewNote).toBe(true);
		expect(sanitized.timerPwmReverseSweep).toBe(true);
		expect(sanitized.timerRows?.[0]?.timerWaveform).toEqual([15, 0]);
	});

	it('includes sample data for worklet playback', () => {
		const instrument = new Instrument('02', []);
		const extended = instrument as Instrument & { sampleData?: number[]; sampleRate?: number };
		extended.sampleData = [0, 128, 255];
		extended.sampleRate = 22_050;

		const sanitized = sanitizeInstrumentForWorklet(instrument);

		expect(sanitized.sampleData).toEqual([0, 128, 255]);
		expect(sanitized.sampleRate).toBe(22_050);
		expect(sanitized.sampleStart).toBe(0);
		expect(sanitized.sampleEnd).toBe(2);
		expect(sanitized.sampleLoopStart).toBe(0);
		expect(sanitized.sampleLoopEnabled).toBe(true);
	});

	it('preserves sampleLoopEnabled false for the worklet', () => {
		const instrument = new Instrument('04', []);
		const extended = instrument as Instrument & {
			sampleData?: number[];
			sampleLoopEnabled?: boolean;
		};
		extended.sampleData = [1, 2, 3];
		extended.sampleLoopEnabled = false;

		const sanitized = sanitizeInstrumentForWorklet(instrument);

		expect(sanitized.sampleLoopEnabled).toBe(false);
	});

	it('omits oversized 8-bit mono sample data for the worklet', () => {
		const instrument = new Instrument('03', []);
		const extended = instrument as Instrument & { sampleData?: number[] };
		extended.sampleData = Array.from({ length: MAX_INSTRUMENT_SAMPLE_BYTES + 50 }, () => 64);

		const sanitized = sanitizeInstrumentForWorklet(instrument);

		expect(sanitized.sampleData).toBeUndefined();
	});
});
