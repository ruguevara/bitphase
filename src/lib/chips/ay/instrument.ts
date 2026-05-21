import type { Instrument } from '../../models/song';

export type AyTimerRow = {
	sid: boolean;
};

export type AySidPeriodMode = 'auto' | 'manual';

export type AyInstrumentFields = {
	timerRows: AyTimerRow[];
	timerWaveform: number[];
	timerWaveformLoop: number;
	sidPeriodMode: AySidPeriodMode;
	sidPeriod: number;
	sidPeriodDetune: number;
};

export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 3;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];

type ExtendedInstrument = Instrument & {
	timerRows?: AyTimerRow[];
	timerWaveform?: number[];
	timerWaveformLoop?: number;
	sidPeriodMode?: AySidPeriodMode;
	sidPeriod?: number;
	sidPeriodDetune?: number;
};

export function createDefaultAyTimerRow(): AyTimerRow {
	return { sid: false };
}

export function resolveAySidPeriodMode(instrument: Instrument): AySidPeriodMode {
	const extended = instrument as ExtendedInstrument;
	if (extended.sidPeriodMode === 'auto' || extended.sidPeriodMode === 'manual') {
		return extended.sidPeriodMode;
	}
	return extended.sidPeriod !== undefined ? 'manual' : 'auto';
}

export function computeSidPeriod(tonePeriod: number, fields: AyInstrumentFields): number {
	if (fields.sidPeriodMode === 'manual') {
		return Math.max(1, fields.sidPeriod & 0xffff);
	}
	if (tonePeriod > 0) {
		const detune = fields.sidPeriodDetune | 0;
		return Math.max(1, ((tonePeriod + detune) & 0xffff) || 1);
	}
	return Math.max(1, fields.sidPeriod & 0xffff);
}

export function normalizeAyInstrumentFields(instrument: Instrument): AyInstrumentFields {
	const rowCount = Math.max(instrument.rows.length, 1);
	const extended = instrument as ExtendedInstrument;
	let timerRows = extended.timerRows;
	if (!timerRows) {
		timerRows = instrument.rows.map(() => createDefaultAyTimerRow());
	}
	while (timerRows.length < rowCount) {
		timerRows.push(createDefaultAyTimerRow());
	}
	if (timerRows.length > rowCount) {
		timerRows.length = rowCount;
	}

	let timerWaveform = extended.timerWaveform;
	if (!timerWaveform || timerWaveform.length === 0) {
		timerWaveform = [...DEFAULT_AY_TIMER_WAVEFORM];
	}

	const timerWaveformLoop = extended.timerWaveformLoop ?? 0;
	const sidPeriodMode = resolveAySidPeriodMode(instrument);
	const sidPeriod = extended.sidPeriod ?? DEFAULT_AY_SID_PERIOD;
	const sidPeriodDetune = extended.sidPeriodDetune ?? DEFAULT_AY_SID_PERIOD_DETUNE;

	return {
		timerRows,
		timerWaveform,
		timerWaveformLoop,
		sidPeriodMode,
		sidPeriod: Math.max(1, sidPeriod & 0xffff),
		sidPeriodDetune
	};
}

export function syncAyInstrumentTimerRows(instrument: Instrument, rowCount: number): AyTimerRow[] {
	const fields = normalizeAyInstrumentFields(instrument);
	const timerRows = [...fields.timerRows];
	while (timerRows.length < rowCount) {
		timerRows.push(createDefaultAyTimerRow());
	}
	if (timerRows.length > rowCount) {
		timerRows.length = rowCount;
	}
	(instrument as ExtendedInstrument).timerRows = timerRows;
	return timerRows;
}

export function copyAyInstrumentFields(
	source: Instrument & Partial<AyInstrumentFields>,
	target: Instrument & Partial<AyInstrumentFields>
): void {
	if (source.timerRows) {
		target.timerRows = source.timerRows.map((row) => ({ ...row }));
	}
	if (source.timerWaveform) {
		target.timerWaveform = [...source.timerWaveform];
	}
	if (source.timerWaveformLoop !== undefined) {
		target.timerWaveformLoop = source.timerWaveformLoop;
	}
	if (source.sidPeriodMode !== undefined) {
		target.sidPeriodMode = source.sidPeriodMode;
	}
	if (source.sidPeriod !== undefined) {
		target.sidPeriod = source.sidPeriod;
	}
	if (source.sidPeriodDetune !== undefined) {
		target.sidPeriodDetune = source.sidPeriodDetune;
	}
}
