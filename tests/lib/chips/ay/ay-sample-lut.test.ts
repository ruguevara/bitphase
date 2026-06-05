import { describe, expect, it } from 'vitest';
import {
	AY_DAC_TABLE_FLOAT,
	buildDacTableUint8,
	buildSampleLookupLut,
	buildWaveformPeaksFromUint8MonoWithLut,
	mapUint8SampleToVolumeLevel,
	SAMPLE_DAC_TABLE_AY,
	SAMPLE_DAC_TABLE_YM,
	SAMPLE_LOOKUP_AY,
	SAMPLE_LOOKUP_YM,
	YM_DAC_TABLE_FLOAT
} from '@/lib/chips/ay/ay-sample-lut';

describe('ay-sample-lut', () => {
	it('builds 16-entry DAC tables from float curves', () => {
		const ay = buildDacTableUint8(AY_DAC_TABLE_FLOAT);
		const ym = buildDacTableUint8(YM_DAC_TABLE_FLOAT);
		expect(ay).toHaveLength(16);
		expect(ym).toHaveLength(16);
		expect(ay[0]).toBe(0);
		expect(ay[15]).toBe(255);
		expect(ym[15]).toBe(255);
	});

	it('matches precomputed DAC and lookup tables', () => {
		expect(SAMPLE_DAC_TABLE_AY).toEqual(buildDacTableUint8(AY_DAC_TABLE_FLOAT));
		expect(SAMPLE_DAC_TABLE_YM).toEqual(buildDacTableUint8(YM_DAC_TABLE_FLOAT));
		expect(SAMPLE_LOOKUP_AY).toEqual(buildSampleLookupLut(SAMPLE_DAC_TABLE_AY));
		expect(SAMPLE_LOOKUP_YM).toEqual(buildSampleLookupLut(SAMPLE_DAC_TABLE_YM));
	});

	it('maps sample bytes to monotonic 4-bit volume levels', () => {
		expect(mapUint8SampleToVolumeLevel(0, 'AY')).toBe(0);
		expect(mapUint8SampleToVolumeLevel(255, 'AY')).toBe(15);
		expect(SAMPLE_LOOKUP_AY[0]).toBeLessThanOrEqual(SAMPLE_LOOKUP_AY[255]);
		for (let i = 1; i < 256; i++) {
			expect(SAMPLE_LOOKUP_AY[i]).toBeGreaterThanOrEqual(SAMPLE_LOOKUP_AY[i - 1]);
		}
	});

	it('produces different AY and YM lookup tables', () => {
		let differs = false;
		for (let i = 0; i < 256; i++) {
			if (SAMPLE_LOOKUP_AY[i] !== SAMPLE_LOOKUP_YM[i]) {
				differs = true;
				break;
			}
		}
		expect(differs).toBe(true);
	});

	it('builds waveform peaks from LUT-mapped samples', () => {
		const data = new Uint8Array([0, 128, 255]);
		const peaks = buildWaveformPeaksFromUint8MonoWithLut(data, 'AY', 1);
		expect(peaks).toHaveLength(1);
		expect(peaks[0].max).toBeGreaterThanOrEqual(peaks[0].min);
	});
});
