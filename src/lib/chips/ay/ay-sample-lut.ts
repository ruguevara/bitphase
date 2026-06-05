import type { WaveformPeak } from '../../utils/audio-sample-decode';

export type AyChipVariant = 'AY' | 'YM';

export const AY_DAC_TABLE_FLOAT: readonly number[] = [
	0.0, 0.0, 0.00999465934234, 0.00999465934234, 0.0144502937362, 0.0144502937362,
	0.0210574502174, 0.0210574502174, 0.0307011520562, 0.0307011520562, 0.0455481803616,
	0.0455481803616, 0.0644998855573, 0.0644998855573, 0.107362478065, 0.107362478065,
	0.126588845655, 0.126588845655, 0.20498970016, 0.20498970016, 0.292210269322,
	0.292210269322, 0.372838941024, 0.372838941024, 0.492530708782, 0.492530708782,
	0.635324635691, 0.635324635691, 0.805584802014, 0.805584802014, 1.0, 1.0
];

export const YM_DAC_TABLE_FLOAT: readonly number[] = [
	0.0, 0.0, 0.00465400167849, 0.00772106507973, 0.0109559777218, 0.0139620050355,
	0.0169985503929, 0.0200198367285, 0.024368657969, 0.029694056611, 0.0350652323186,
	0.0403906309606, 0.0485389486534, 0.0583352407111, 0.0680552376593, 0.0777752346075,
	0.0925154497597, 0.111085679408, 0.129747463188, 0.148485542077, 0.17666895552,
	0.211551079576, 0.246387426566, 0.281101701381, 0.333730067903, 0.400427252613,
	0.467383840696, 0.53443198291, 0.635172045472, 0.75800717174, 0.879926756695, 1.0
];

const PREVIEW_BUCKET_COUNT = 2048;

export function buildDacTableUint8(dacTableFloat: readonly number[]): Uint8Array {
	const table = new Uint8Array(16);
	for (let i = 0; i < 16; i++) {
		table[i] = Math.round((dacTableFloat[i * 2 + 1] ?? 0) * 255);
	}
	return table;
}

export function buildSampleLookupLut(dacTableUint8: Uint8Array): Uint8Array {
	const lookup = new Uint8Array(256);
	let volume = 0;
	for (let i = 0; i < 256; i++) {
		if (i > dacTableUint8[volume]) {
			volume = Math.min(15, volume + 1);
		}
		lookup[i] = volume;
	}
	return lookup;
}

export const SAMPLE_DAC_TABLE_AY = buildDacTableUint8(AY_DAC_TABLE_FLOAT);
export const SAMPLE_DAC_TABLE_YM = buildDacTableUint8(YM_DAC_TABLE_FLOAT);
export const SAMPLE_LOOKUP_AY = buildSampleLookupLut(SAMPLE_DAC_TABLE_AY);
export const SAMPLE_LOOKUP_YM = buildSampleLookupLut(SAMPLE_DAC_TABLE_YM);

function dacTableFloat(variant: AyChipVariant): readonly number[] {
	return variant === 'YM' ? YM_DAC_TABLE_FLOAT : AY_DAC_TABLE_FLOAT;
}

function sampleLookupTable(variant: AyChipVariant): Uint8Array {
	return variant === 'YM' ? SAMPLE_LOOKUP_YM : SAMPLE_LOOKUP_AY;
}

export function mapUint8SampleToVolumeLevel(
	sampleValue: number,
	variant: AyChipVariant
): number {
	const index = Math.max(0, Math.min(255, Math.round(sampleValue)));
	return sampleLookupTable(variant)[index];
}

export function volumeLevelToAmplitude(volumeLevel: number, variant: AyChipVariant): number {
	if (volumeLevel <= 0) {
		return 0;
	}
	const table = dacTableFloat(variant);
	return table[(volumeLevel & 0xf) * 2 + 1] ?? 0;
}

export function mapUint8SampleToAmplitude(sampleValue: number, variant: AyChipVariant): number {
	const volume = mapUint8SampleToVolumeLevel(sampleValue, variant);
	return volumeLevelToAmplitude(volume, variant);
}

export function convertUint8MonoToVolumeLevels(
	data: Uint8Array,
	variant: AyChipVariant
): Uint8Array {
	const lookup = sampleLookupTable(variant);
	const out = new Uint8Array(data.length);
	for (let i = 0; i < data.length; i++) {
		out[i] = lookup[data[i]];
	}
	return out;
}

export function sampleByteToDisplayFloat(sampleValue: number, variant: AyChipVariant): number {
	const amplitude = mapUint8SampleToAmplitude(sampleValue, variant);
	return amplitude * 2 - 1;
}

export function buildWaveformPeaksFromUint8MonoWithLut(
	data: Uint8Array,
	variant: AyChipVariant,
	bucketCount: number = PREVIEW_BUCKET_COUNT
): WaveformPeak[] {
	const length = data.length;
	if (length === 0 || bucketCount < 1) {
		return [];
	}

	const peaks: WaveformPeak[] = Array.from({ length: bucketCount }, () => ({
		min: Number.POSITIVE_INFINITY,
		max: Number.NEGATIVE_INFINITY
	}));
	const samplesPerBucket = length / bucketCount;

	for (let i = 0; i < length; i++) {
		const value = sampleByteToDisplayFloat(data[i], variant);
		const bucketIndex = Math.min(bucketCount - 1, Math.floor(i / samplesPerBucket));
		const bucket = peaks[bucketIndex];
		if (value < bucket.min) bucket.min = value;
		if (value > bucket.max) bucket.max = value;
	}

	for (const bucket of peaks) {
		if (!Number.isFinite(bucket.min) || !Number.isFinite(bucket.max)) {
			bucket.min = 0;
			bucket.max = 0;
		}
	}

	let peakAbs = 0;
	for (const bucket of peaks) {
		peakAbs = Math.max(peakAbs, Math.abs(bucket.min), Math.abs(bucket.max));
	}
	if (peakAbs < 1e-8) {
		return peaks;
	}
	const scale = 1 / peakAbs;
	for (const bucket of peaks) {
		bucket.min *= scale;
		bucket.max *= scale;
	}

	return peaks;
}
