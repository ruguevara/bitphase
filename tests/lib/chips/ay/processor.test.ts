import { describe, it, expect } from 'vitest';
import { sanitizeInstrumentForWorklet } from '@/lib/chips/ay/processor';
import { Instrument } from '@/lib/models/song';

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
		};
		extended.timerRows = [{ sid: true, timerWaveform: [15, 0] }];
		extended.timerPwmDuty = 25;
		extended.timerPwmSweepMin = 5;
		extended.timerPwmSweep = 3;
		extended.timerPwmPreserveOnNewNote = true;

		const sanitized = sanitizeInstrumentForWorklet(instrument);

		expect(sanitized.timerPwmDuty).toBe(25);
		expect(sanitized.timerPwmSweepMin).toBe(5);
		expect(sanitized.timerPwmSweep).toBe(3);
		expect(sanitized.timerPwmPreserveOnNewNote).toBe(true);
		expect(sanitized.timerRows?.[0]?.timerWaveform).toEqual([15, 0]);
	});
});
