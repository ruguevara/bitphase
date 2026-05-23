import type { Instrument } from '../../models/song';

export type AySidPeriodMode = 'auto' | 'manual';

export type AyTimerRow = {
	sid: boolean;
	syncbuzzer?: boolean;
	sidPeriodMode?: AySidPeriodMode;
	detune?: number;
	period?: number;
};

export type AyInstrumentFields = {
	timerRows: AyTimerRow[];
	timerWaveform: number[];
	timerWaveformLoop: number;
};

export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 1;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];
export const AY_TIMER_WAVEFORM_MAX_LENGTH = 32;
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

type ExtendedInstrument = Instrument & {
	timerRows?: AyTimerRow[];
	timerWaveform?: number[];
	timerWaveformLoop?: number;
	sidPeriodMode?: AySidPeriodMode;
	sidPeriod?: number;
	sidPeriodDetune?: number;
};

type LegacyInstrumentDefaults = {
	sidPeriodMode: AySidPeriodMode;
	sidPeriod: number;
	sidPeriodDetune: number;
};

export function createDefaultAyTimerRow(): AyTimerRow {
	return { sid: false, syncbuzzer: false };
}

export function resolveLegacyInstrumentDefaults(instrument: Instrument): LegacyInstrumentDefaults {
	const extended = instrument as ExtendedInstrument;
	const sidPeriodMode =
		extended.sidPeriodMode === 'auto' || extended.sidPeriodMode === 'manual'
			? extended.sidPeriodMode
			: extended.sidPeriod !== undefined
				? 'manual'
				: 'auto';
	return {
		sidPeriodMode,
		sidPeriod: Math.max(1, (extended.sidPeriod ?? DEFAULT_AY_SID_PERIOD) & 0xffff),
		sidPeriodDetune: extended.sidPeriodDetune ?? DEFAULT_AY_SID_PERIOD_DETUNE
	};
}

export function resolveAyTimerRowSidPeriodMode(row: AyTimerRow | undefined): AySidPeriodMode {
	return row?.sidPeriodMode === 'manual' ? 'manual' : 'auto';
}

export function effectiveRowDetune(row: AyTimerRow | undefined): number {
	return row?.detune ?? DEFAULT_AY_SID_PERIOD_DETUNE;
}

export function effectiveRowPeriod(row: AyTimerRow | undefined): number {
	return Math.max(1, (row?.period ?? DEFAULT_AY_SID_PERIOD) & 0xffff);
}

export function computeTimerEffectPeriod(tonePeriod: number, timerRow?: AyTimerRow): number {
	if (resolveAyTimerRowSidPeriodMode(timerRow) === 'manual') {
		return effectiveRowPeriod(timerRow);
	}
	if (tonePeriod > 0) {
		const detune = effectiveRowDetune(timerRow) | 0;
		const tonePeriodWithDetune = ((tonePeriod + detune) & 0xffff) || 1;
		return Math.max(
			1,
			Math.round(
				(AY_TONE_REGISTER_PRESCALER * tonePeriodWithDetune) / AY_AUTO_TIMER_TONE_MULTIPLIER
			)
		);
	}
	return effectiveRowPeriod(timerRow);
}

export function computeSidPeriod(tonePeriod: number, timerRow?: AyTimerRow): number {
	return computeTimerEffectPeriod(tonePeriod, timerRow);
}

export function resolveExclusiveTimerEffects(row: AyTimerRow): AyTimerRow {
	if (row.sid && row.syncbuzzer) {
		return { ...row, syncbuzzer: false };
	}
	return row;
}

function normalizeTimerRow(
	row: AyTimerRow | undefined,
	legacy: LegacyInstrumentDefaults
): AyTimerRow {
	const sid = row?.sid ?? false;
	const sidPeriodMode =
		row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
			? row.sidPeriodMode
			: legacy.sidPeriodMode;
	const normalized: AyTimerRow = { sid, syncbuzzer: row?.syncbuzzer ?? false, sidPeriodMode };
	if (row?.detune !== undefined) {
		normalized.detune = row.detune;
	} else if (legacy.sidPeriodDetune !== DEFAULT_AY_SID_PERIOD_DETUNE) {
		normalized.detune = legacy.sidPeriodDetune;
	}
	if (row?.period !== undefined) {
		normalized.period = Math.max(1, row.period & 0xffff);
	} else if (legacy.sidPeriodMode === 'manual' && legacy.sidPeriod !== DEFAULT_AY_SID_PERIOD) {
		normalized.period = legacy.sidPeriod;
	}
	return resolveExclusiveTimerEffects(normalized);
}

export function normalizeAyInstrumentFields(instrument: Instrument): AyInstrumentFields {
	const rowCount = Math.max(instrument.rows.length, 1);
	const extended = instrument as ExtendedInstrument;
	const legacy = resolveLegacyInstrumentDefaults(instrument);
	let timerRows = extended.timerRows;
	if (!timerRows) {
		timerRows = instrument.rows.map(() => createDefaultAyTimerRow());
	}
	timerRows = timerRows.map((row) => normalizeTimerRow(row, legacy));
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

	return {
		timerRows,
		timerWaveform,
		timerWaveformLoop
	};
}

export function formatAyTimerWaveform(waveform: readonly number[], asHex: boolean): string {
	return waveform
		.map((value) => (asHex ? (value & 0xf).toString(16).toUpperCase() : String(value & 0xf)))
		.join(' ');
}

function parseWaveformToken(part: string, asHex: boolean): number | null {
	if (asHex) {
		if (!/^[0-9a-fA-F]+$/.test(part)) {
			return null;
		}
		return parseInt(part, 16);
	}
	if (!/^\d+$/.test(part)) {
		return null;
	}
	return parseInt(part, 10);
}

export function parseAyTimerWaveformPartial(text: string, asHex: boolean): number[] | null {
	if (!text.trim()) {
		return null;
	}
	const parts = text.trimEnd().split(/\s+/).filter((part) => part.length > 0);
	const values: number[] = [];
	for (const part of parts) {
		const parsed = parseWaveformToken(part, asHex);
		if (parsed === null || parsed < 0 || parsed > 15) {
			break;
		}
		values.push(parsed);
		if (values.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			break;
		}
	}
	return values.length > 0 ? values : null;
}

export function parseAyTimerWaveform(text: string, asHex: boolean): number[] | null {
	const values = parseAyTimerWaveformPartial(text, asHex);
	if (!values) {
		return null;
	}
	const trimmed = text.trim();
	if (!trimmed) {
		return null;
	}
	const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
	if (parts.length !== values.length) {
		return null;
	}
	for (let index = 0; index < parts.length; index++) {
		const parsed = parseWaveformToken(parts[index], asHex);
		if (parsed === null || parsed !== values[index]) {
			return null;
		}
	}
	return values;
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
}
