export function getAutoEnvelopeDivisor(envelopeShape: number): number | null {
	switch (envelopeShape) {
		case 8:
		case 12:
			return 16;
		case 10:
		case 14:
			return 32;
		default:
			return null;
	}
}

export function computeAutoEnvelopePeriod(
	baseTone: number,
	envelopeShape: number,
	parameter: number
): number | null {
	if (baseTone <= 0) return null;
	const numerator = (parameter >> 4) & 0xf;
	const denominator = parameter & 0xf;
	if (numerator <= 0 || denominator <= 0) return null;
	const divisor = getAutoEnvelopeDivisor(envelopeShape);
	if (divisor === null) return null;
	return Math.round((baseTone * numerator) / (denominator * divisor));
}
