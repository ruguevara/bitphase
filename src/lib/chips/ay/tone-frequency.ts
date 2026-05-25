export function tonePeriodToFrequencyHz(chipClockHz: number, tonePeriod: number): number | null {
	const period = tonePeriod & 0xfff;
	if (period <= 0 || chipClockHz <= 0) {
		return null;
	}
	return chipClockHz / (16 * period);
}

export function timerPeriodToFrequencyHz(chipClockHz: number, periodTicks: number): number | null {
	const period = periodTicks & 0xffff;
	if (period <= 0 || chipClockHz <= 0) {
		return null;
	}
	return chipClockHz / (8 * period);
}

export function formatToneFrequencyHz(hz: number | null): string {
	if (hz === null || !Number.isFinite(hz) || hz <= 0) {
		return '—';
	}
	if (hz >= 1000) {
		return `${(hz / 1000).toFixed(2)} kHz`;
	}
	if (hz >= 100) {
		return `${hz.toFixed(1)} Hz`;
	}
	return `${hz.toFixed(2)} Hz`;
}
