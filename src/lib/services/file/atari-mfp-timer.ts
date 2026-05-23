export const ATARI_MFP_FREQUENCY_HZ = 2_457_600;
export const ATARI_MFP_PRESCALERS = [1, 4, 10, 16, 50, 64, 100, 200] as const;
export const ATARI_MFP_OUTPUT_FREQUENCY_MULTIPLIER = 2;

export type AtariMfpTimer = {
	data: number;
	prescalerIndex: number;
};

export function atariMfpClockRatio(aymFrequencyHz: number, mfpFrequencyHz = ATARI_MFP_FREQUENCY_HZ): number {
	return mfpFrequencyHz / (aymFrequencyHz / 16);
}

export function calculateAtariMfpTimer(
	ymPeriod: number,
	aymFrequencyHz: number,
	mfpFrequencyHz = ATARI_MFP_FREQUENCY_HZ
): AtariMfpTimer {
	if (ymPeriod <= 0) {
		return { data: 0, prescalerIndex: 0 };
	}

	const clockRatio = atariMfpClockRatio(aymFrequencyHz, mfpFrequencyHz);

	let prescalerIndex: number;
	if (ymPeriod < (256 * 4) / clockRatio) prescalerIndex = 1;
	else if (ymPeriod < (256 * 10) / clockRatio) prescalerIndex = 2;
	else if (ymPeriod < (256 * 16) / clockRatio) prescalerIndex = 3;
	else if (ymPeriod < (256 * 50) / clockRatio) prescalerIndex = 4;
	else if (ymPeriod < (256 * 64) / clockRatio) prescalerIndex = 5;
	else if (ymPeriod < (256 * 100) / clockRatio) prescalerIndex = 6;
	else prescalerIndex = 7;

	const prescaler = ATARI_MFP_PRESCALERS[prescalerIndex]!;
	const dataRegister = (ymPeriod * clockRatio) / prescaler;
	const data = dataRegister + 0.5 >= 256 ? 0 : Math.floor(dataRegister + 0.5);

	return { data, prescalerIndex };
}

export function atariMfpFrequencyHzFromYmPeriod(
	ymPeriod: number,
	aymFrequencyHz: number,
	mfpFrequencyHz = ATARI_MFP_FREQUENCY_HZ
): number | null {
	if (ymPeriod <= 0 || aymFrequencyHz <= 0) {
		return null;
	}

	const { data, prescalerIndex } = calculateAtariMfpTimer(ymPeriod, aymFrequencyHz, mfpFrequencyHz);
	const prescaler = ATARI_MFP_PRESCALERS[prescalerIndex]!;
	const effectiveCount = data === 0 ? 256 : data;
	return (
		(mfpFrequencyHz / (prescaler * effectiveCount)) * ATARI_MFP_OUTPUT_FREQUENCY_MULTIPLIER
	);
}
