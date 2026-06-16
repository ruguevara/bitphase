import { describe, expect, it } from 'vitest';
import {
	formatToneFrequencyHz,
	timerPeriodToFrequencyHz,
	tonePeriodToFrequencyHz
} from '@/lib/chips/ay/tone-frequency';

describe('tone-frequency', () => {
	it('converts AY tone period to Hz', () => {
		expect(tonePeriodToFrequencyHz(1773400, 1000)).toBeCloseTo(110.8375, 4);
	});

	it('returns null for silent period', () => {
		expect(tonePeriodToFrequencyHz(1773400, 0)).toBeNull();
	});

	it('converts hardware timer period to Hz', () => {
		expect(timerPeriodToFrequencyHz(1773400, 1000)).toBeCloseTo(221.675, 3);
	});

	it('formats Hz for display', () => {
		expect(formatToneFrequencyHz(440)).toBe('440.0 Hz');
		expect(formatToneFrequencyHz(1234)).toBe('1.23 kHz');
		expect(formatToneFrequencyHz(null)).toBe('—');
	});
});
