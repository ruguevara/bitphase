import { describe, expect, it } from 'vitest';
import {
	clampInstrumentSampleRate,
	clampSamplePlaybackPosition,
	computeSamplePitchScale,
	defaultSampleRegionFields,
	instrumentHasSample,
	MAX_INSTRUMENT_SAMPLE_RATE,
	MIN_INSTRUMENT_SAMPLE_RATE,
	normalizeSamplePlaybackBounds,
	resolveSamplePitchReferencePeriod
} from '@/lib/chips/ay/sample-region';

describe('sample-region', () => {
	it('scales playback speed from fixed C-4 reference frequency and note period', () => {
		const referencePeriod = resolveSamplePitchReferencePeriod(1_773_400);
		expect(referencePeriod).toBeCloseTo(423.64, 1);
		expect(computeSamplePitchScale(referencePeriod, 411)).not.toBeCloseTo(
			computeSamplePitchScale(referencePeriod, 360),
			2
		);
		expect(computeSamplePitchScale(referencePeriod, referencePeriod / 2)).toBe(2);
		expect(computeSamplePitchScale(referencePeriod, referencePeriod * 2)).toBe(0.5);
	});

	it('clamps instrument sample rate for pitch tuning', () => {
		expect(clampInstrumentSampleRate(8_000)).toBe(8_000);
		expect(clampInstrumentSampleRate(500)).toBe(MIN_INSTRUMENT_SAMPLE_RATE);
		expect(clampInstrumentSampleRate(99_999)).toBe(MAX_INSTRUMENT_SAMPLE_RATE);
	});

	it('detects when an instrument has sample data', () => {
		expect(instrumentHasSample({ sampleData: [1, 2] })).toBe(true);
		expect(instrumentHasSample({ sampleData: [] })).toBe(false);
		expect(instrumentHasSample(null)).toBe(false);
	});

	it('defaults to the full sample buffer', () => {
		const bounds = normalizeSamplePlaybackBounds({ sampleData: [0, 1, 2, 3] });
		expect(bounds).toEqual({
			start: 0,
			end: 3,
			loopStart: 0,
			length: 4,
			dataLength: 4
		});
	});

	it('clamps start, end, and loop start inside the buffer', () => {
		const bounds = normalizeSamplePlaybackBounds({
			sampleData: new Array(10).fill(0),
			sampleStart: 8,
			sampleEnd: 99,
			sampleLoopStart: 2
		});
		expect(bounds?.start).toBe(8);
		expect(bounds?.end).toBe(9);
		expect(bounds?.loopStart).toBe(8);
	});

	it('migrates legacy sampleLength and sampleLoop fields', () => {
		const bounds = normalizeSamplePlaybackBounds({
			sampleData: [0, 1, 2, 3, 4],
			sampleStart: 1,
			sampleLength: 3,
			sampleLoop: 2
		});
		expect(bounds?.start).toBe(1);
		expect(bounds?.end).toBe(3);
		expect(bounds?.loopStart).toBe(2);
	});

	it('keeps loop start between play start and end', () => {
		const bounds = normalizeSamplePlaybackBounds({
			sampleData: [0, 1, 2, 3, 4],
			sampleStart: 1,
			sampleEnd: 3,
			sampleLoopStart: 2
		})!;
		expect(clampSamplePlaybackPosition(bounds, 99)).toBe(3);
		expect(defaultSampleRegionFields(8)).toEqual({
			sampleStart: 0,
			sampleEnd: 7,
			sampleLoopStart: 0,
			sampleLoopEnabled: true
		});
	});
});
