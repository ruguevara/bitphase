import { describe, it, expect } from 'vitest';
import {
	computeAutoEnvelopePeriod,
	getAutoEnvelopeDivisor
} from '../../../../src/lib/chips/ay/auto-envelope';

describe('getAutoEnvelopeDivisor', () => {
	it('returns 16 for shapes 8 and 12', () => {
		expect(getAutoEnvelopeDivisor(8)).toBe(16);
		expect(getAutoEnvelopeDivisor(12)).toBe(16);
	});

	it('returns 32 for shapes 10 and 14', () => {
		expect(getAutoEnvelopeDivisor(10)).toBe(32);
		expect(getAutoEnvelopeDivisor(14)).toBe(32);
	});

	it('returns null for non-auto-envelope shapes', () => {
		expect(getAutoEnvelopeDivisor(0)).toBeNull();
		expect(getAutoEnvelopeDivisor(13)).toBeNull();
		expect(getAutoEnvelopeDivisor(15)).toBeNull();
	});
});

describe('computeAutoEnvelopePeriod', () => {
	it('matches the engine formula round(baseTone * num / (den * divisor))', () => {
		// baseTone 1000, ratio 1/1, shape 8 (divisor 16) => round(1000/16) = 63
		expect(computeAutoEnvelopePeriod(1000, 8, 0x11)).toBe(63);
		// baseTone 1000, ratio 2/1, shape 10 (divisor 32) => round(2000/32) = 63
		expect(computeAutoEnvelopePeriod(1000, 10, 0x21)).toBe(63);
		// baseTone 1280, ratio 1/2, shape 8 (divisor 16) => round(1280/(2*16)) = 40
		expect(computeAutoEnvelopePeriod(1280, 8, 0x12)).toBe(40);
	});

	it('returns null when the ratio nibbles are zero', () => {
		expect(computeAutoEnvelopePeriod(1000, 8, 0x00)).toBeNull();
		expect(computeAutoEnvelopePeriod(1000, 8, 0x10)).toBeNull();
		expect(computeAutoEnvelopePeriod(1000, 8, 0x01)).toBeNull();
	});

	it('returns null for unsupported shapes', () => {
		expect(computeAutoEnvelopePeriod(1000, 0, 0x11)).toBeNull();
	});

	it('returns null for non-positive base tone', () => {
		expect(computeAutoEnvelopePeriod(0, 8, 0x11)).toBeNull();
	});
});
