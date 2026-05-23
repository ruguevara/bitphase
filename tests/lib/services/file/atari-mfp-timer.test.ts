import { describe, expect, it } from 'vitest';
import {
	atariMfpFrequencyHzFromYmPeriod,
	calculateAtariMfpTimer
} from '@/lib/services/file/atari-mfp-timer';
import { timerPeriodTicksToFrequencyHz } from '@/lib/services/file/tmr-format';

describe('atari-mfp-timer', () => {
	it('maps YM period to MFP data and prescaler', () => {
		expect(calculateAtariMfpTimer(664, 2_000_000)).toEqual({ data: 204, prescalerIndex: 5 });
	});

	it('exports 2× tone-rate Hz for Atari MFP timer output', () => {
		const ymPeriod = 664;
		const aymFrequencyHz = 2_000_000;
		const toneHz = aymFrequencyHz / (16 * ymPeriod);
		const mfpHz = atariMfpFrequencyHzFromYmPeriod(ymPeriod, aymFrequencyHz);
		const chipSidHz = timerPeriodTicksToFrequencyHz(aymFrequencyHz, ymPeriod);

		expect(mfpHz).not.toBeNull();
		expect(mfpHz!).toBeCloseTo(toneHz * 2, 0);
		expect(chipSidHz / toneHz).toBeCloseTo(16, 0);
		expect(mfpHz!).toBeCloseTo(chipSidHz / 8, 0);
	});
});
