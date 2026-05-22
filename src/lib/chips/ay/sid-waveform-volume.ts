export type AyChipVariant = 'AY' | 'YM';

export const SID_WAVEFORM_PREVIEW_BASE_VOLUME = 15;
export { AY_TIMER_WAVEFORM_MAX_LENGTH as SID_WAVEFORM_MAX_STEPS } from './instrument';

const AY_DAC_TABLE = [
	0.0, 0.0, 0.00999465934234, 0.00999465934234, 0.0144502937362, 0.0144502937362,
	0.0210574502174, 0.0210574502174, 0.0307011520562, 0.0307011520562, 0.0455481803616,
	0.0455481803616, 0.0644998855573, 0.0644998855573, 0.107362478065, 0.107362478065,
	0.126588845655, 0.126588845655, 0.20498970016, 0.20498970016, 0.292210269322,
	0.292210269322, 0.372838941024, 0.372838941024, 0.492530708782, 0.492530708782,
	0.635324635691, 0.635324635691, 0.805584802014, 0.805584802014, 1.0, 1.0
];

const YM_DAC_TABLE = [
	0.0, 0.0, 0.00465400167849, 0.00772106507973, 0.0109559777218, 0.0139620050355,
	0.0169985503929, 0.0200198367285, 0.024368657969, 0.029694056611, 0.0350652323186,
	0.0403906309606, 0.0485389486534, 0.0583352407111, 0.0680552376593, 0.0777752346075,
	0.0925154497597, 0.111085679408, 0.129747463188, 0.148485542077, 0.17666895552,
	0.211551079576, 0.246387426566, 0.281101701381, 0.333730067903, 0.400427252613,
	0.467383840696, 0.53443198291, 0.635172045472, 0.75800717174, 0.879926756695, 1.0
];

export function resolveAyChipVariant(value: unknown): AyChipVariant {
	return value === 'YM' ? 'YM' : 'AY';
}

function dacTable(variant: AyChipVariant): readonly number[] {
	return variant === 'YM' ? YM_DAC_TABLE : AY_DAC_TABLE;
}

export function sidRegisterVolume(waveformStep: number, baseVolume: number): number {
	const w = waveformStep & 0xf;
	if (w === 0) {
		return 0;
	}
	return Math.min(15, Math.floor((w * baseVolume + 14) / 15));
}

export function registerVolumeToAmplitude(
	registerVolume: number,
	variant: AyChipVariant
): number {
	if (registerVolume <= 0) {
		return 0;
	}
	const table = dacTable(variant);
	const index = (registerVolume & 0xf) * 2 + 1;
	return table[index] ?? 0;
}

export function sidStepToAmplitude(
	waveformStep: number,
	baseVolume: number,
	variant: AyChipVariant
): number {
	return registerVolumeToAmplitude(sidRegisterVolume(waveformStep, baseVolume), variant);
}

export function amplitudeToNearestSidStep(
	amplitude: number,
	baseVolume: number,
	variant: AyChipVariant
): number {
	const target = Math.max(0, Math.min(1, amplitude));
	let bestStep = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (let step = 0; step <= 15; step++) {
		const stepAmplitude = sidStepToAmplitude(step, baseVolume, variant);
		const distance = Math.abs(stepAmplitude - target);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestStep = step;
		}
	}
	return bestStep;
}

export function sidWaveformStepAmplitudes(
	waveform: readonly number[],
	baseVolume: number,
	variant: AyChipVariant
): number[] {
	return waveform.map((step) => sidStepToAmplitude(step, baseVolume, variant));
}
