import {
	AY_DAC_TABLE_FLOAT,
	YM_DAC_TABLE_FLOAT,
	volumeLevelToAmplitude as lutVolumeLevelToAmplitude
} from './ay-sample-lut';

export type { AyChipVariant } from './ay-sample-lut';
import type { AyChipVariant } from './ay-sample-lut';

export const SID_WAVEFORM_PREVIEW_BASE_VOLUME = 15;
export { AY_TIMER_WAVEFORM_MAX_LENGTH as SID_WAVEFORM_MAX_STEPS } from './instrument';

const AY_DAC_TABLE = AY_DAC_TABLE_FLOAT;
const YM_DAC_TABLE = YM_DAC_TABLE_FLOAT;

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
	return lutVolumeLevelToAmplitude(registerVolume, variant);
}

export { volumeLevelToAmplitude } from './ay-sample-lut';

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
