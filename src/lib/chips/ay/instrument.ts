import type { Instrument } from '../../models/song';

export type AySidPeriodMode = 'auto' | 'manual';

export type AyTimerRow = {
	sid: boolean;
	syncbuzzer?: boolean;
	sidPeriodMode?: AySidPeriodMode;
	detune?: number;
	period?: number;
	semitone?: number;
	timerWaveform?: number[];
	timerWaveformLoop?: number;
};

export type AyInstrumentFields = {
	timerRows: AyTimerRow[];
	timerPwmDuty: number;
	timerPwmSweepMin: number;
	timerPwmSweep: number;
	timerPwmPreserveOnNewNote: boolean;
};

export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 1;
export const DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE = 0;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];
export const AY_TIMER_PWM_DUTY_MIN = 0;
export const AY_TIMER_PWM_DUTY_MAX = 50;
export const DEFAULT_AY_TIMER_PWM_DUTY = 50;
export const DEFAULT_AY_TIMER_PWM_SWEEP_MIN = 0;
export const DEFAULT_AY_TIMER_PWM_SWEEP = 0;
export const TIMER_PWM_SWEEP_UNINITIALIZED = -1;
export const AY_TIMER_WAVEFORM_MIN_LENGTH = 1;
export const AY_TIMER_WAVEFORM_MAX_LENGTH = 32;
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

type ExtendedInstrument = Instrument & {
	timerRows?: AyTimerRow[];
	timerPwmDuty?: number;
	timerPwmSweepMin?: number;
	timerPwmSweep?: number;
	timerPwmPreserveOnNewNote?: boolean;
};

type LegacyTimerRow = AyTimerRow & {
	timerPwmDuty?: number;
	timerPwmSweepMin?: number;
	timerPwmSweep?: number;
};

export function createDefaultInstrumentTimerPwmFields(): Pick<
	AyInstrumentFields,
	'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'
> {
	return {
		timerPwmDuty: DEFAULT_AY_TIMER_PWM_DUTY,
		timerPwmSweepMin: DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		timerPwmSweep: DEFAULT_AY_TIMER_PWM_SWEEP
	};
}

export function createDefaultAyTimerRow(): AyTimerRow {
	return {
		sid: false,
		syncbuzzer: false,
		timerWaveform: [...DEFAULT_AY_TIMER_WAVEFORM],
		timerWaveformLoop: 0
	};
}

export function effectiveRowTimerWaveform(row: AyTimerRow | undefined): number[] {
	const waveform = row?.timerWaveform;
	if (waveform && waveform.length > 0) {
		return waveform;
	}
	return [...DEFAULT_AY_TIMER_WAVEFORM];
}

export function effectiveRowTimerWaveformLoop(row: AyTimerRow | undefined): number {
	return row?.timerWaveformLoop ?? 0;
}

export function isClassicSidTimerWaveform(waveform: readonly number[]): boolean {
	return waveform.length === 2 && (waveform[0] & 0xf) === 15 && (waveform[1] & 0xf) === 0;
}

export function rowSupportsTimerPwm(row: AyTimerRow | undefined): boolean {
	if (!row || row.syncbuzzer) {
		return false;
	}
	return isClassicSidTimerWaveform(effectiveRowTimerWaveform(row));
}

export function instrumentSupportsTimerPwm(fields: AyInstrumentFields): boolean {
	return fields.timerRows.some((row) => rowSupportsTimerPwm(row));
}

export function normalizeInstrumentTimerPwmFields(
	source: Partial<Pick<AyInstrumentFields, 'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'>>
): Pick<AyInstrumentFields, 'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'> {
	const timerPwmDuty = clampTimerPwmDuty(source.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY);
	const timerPwmSweep = Math.max(0, (source.timerPwmSweep ?? DEFAULT_AY_TIMER_PWM_SWEEP) | 0);
	return {
		timerPwmDuty,
		timerPwmSweepMin:
			timerPwmSweep <= 0
				? DEFAULT_AY_TIMER_PWM_SWEEP_MIN
				: clampTimerPwmSweepMin(
						source.timerPwmSweepMin ?? DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
						timerPwmDuty
					),
		timerPwmSweep
	};
}

export function effectiveInstrumentTimerPwmDuty(fields: AyInstrumentFields): number {
	return fields.timerPwmDuty;
}

export function effectiveInstrumentTimerPwmSweep(fields: AyInstrumentFields): number {
	return fields.timerPwmSweep;
}

export function effectiveInstrumentTimerPwmSweepMin(fields: AyInstrumentFields): number {
	return fields.timerPwmSweepMin;
}

export function effectiveRowTimerPwmDuty(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined
): number {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_DUTY;
	}
	return clampTimerPwmDuty(fields.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY);
}

export function effectiveRowTimerPwmSweep(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined
): number {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP;
	}
	return Math.max(0, (fields.timerPwmSweep ?? DEFAULT_AY_TIMER_PWM_SWEEP) | 0);
}

export function effectiveRowTimerPwmSweepMin(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined
): number {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_MIN;
	}
	return clampTimerPwmSweepMin(
		fields.timerPwmSweepMin ?? DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		fields.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY
	);
}

export function clampTimerPwmSweepMin(min: number, maxDuty: number): number {
	const clampedMax = clampTimerPwmDuty(maxDuty);
	return Math.max(AY_TIMER_PWM_DUTY_MIN, Math.min(clampedMax, min | 0));
}

export function advanceTimerPwmSweep(
	currentDuty: number,
	direction: number,
	sweepSpeed: number,
	minDuty: number,
	maxDuty: number
): { duty: number; direction: number } {
	const min = clampTimerPwmSweepMin(minDuty, maxDuty);
	const max = clampTimerPwmDuty(maxDuty);

	if (sweepSpeed <= 0 || min >= max) {
		return { duty: max, direction: 1 };
	}

	if (currentDuty < 0) {
		return { duty: min, direction: 1 };
	}

	let duty = currentDuty + sweepSpeed * direction;
	let nextDirection = direction;

	if (duty >= max) {
		duty = max;
		nextDirection = -1;
	} else if (duty <= min) {
		duty = min;
		nextDirection = 1;
	}

	return { duty, direction: nextDirection };
}

export function resolveAyTimerRowSidPeriodMode(row: AyTimerRow | undefined): AySidPeriodMode {
	return row?.sidPeriodMode === 'manual' ? 'manual' : 'auto';
}

export function effectiveRowToneDetune(row: AyTimerRow | undefined): number {
	return row?.semitone ?? DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE;
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
		const semitone = effectiveRowToneDetune(timerRow) | 0;
		const transposeFactor = Math.pow(2, -semitone / 12);
		return Math.max(1, (Math.round(tonePeriod * transposeFactor) + detune) & 0xffff || 1);
	}
	return effectiveRowPeriod(timerRow);
}

export function computeSidPeriod(tonePeriod: number, timerRow?: AyTimerRow): number {
	return computeTimerEffectPeriod(tonePeriod, timerRow);
}

export function clampTimerPwmDuty(duty: number): number {
	return Math.max(AY_TIMER_PWM_DUTY_MIN, Math.min(AY_TIMER_PWM_DUTY_MAX, duty | 0));
}

export function computeTimerPwmPeriods(
	basePeriod: number,
	dutyPercent: number
): { highPeriod: number; lowPeriod: number } {
	const duty = clampTimerPwmDuty(dutyPercent) / 100;
	const cyclePeriod = Math.max(2, basePeriod * 2);
	const highPeriod = Math.max(1, Math.round(cyclePeriod * duty));
	const lowPeriod = Math.max(1, Math.round(cyclePeriod * (1 - duty)));
	return { highPeriod, lowPeriod };
}

export function computeTimerPwmLowPeriod(basePeriod: number, dutyPercent: number): number {
	return computeTimerPwmPeriods(basePeriod, dutyPercent).lowPeriod;
}

export function isTimerWaveformLowPhase(stepValue: number): boolean {
	return (stepValue & 0xf) === 0;
}

export function timerPwmStepPeriod(
	stepValue: number,
	highPeriod: number,
	lowPeriod: number
): number {
	return isTimerWaveformLowPhase(stepValue) ? lowPeriod : highPeriod;
}

export function resolveExclusiveTimerEffects(row: AyTimerRow): AyTimerRow {
	if (row.sid) {
		return { ...row, syncbuzzer: false };
	}
	if (row.syncbuzzer) {
		return { ...row, sid: false };
	}
	return row;
}

function normalizeTimerRow(row: LegacyTimerRow | undefined): AyTimerRow {
	const defaults = createDefaultAyTimerRow();
	const normalized: AyTimerRow = {
		sid: row?.sid ?? defaults.sid,
		syncbuzzer: row?.syncbuzzer ?? defaults.syncbuzzer,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		timerWaveform: row?.timerWaveform?.length
			? row.timerWaveform.map((value) => value & 0xf).slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			: [...defaults.timerWaveform!],
		timerWaveformLoop: row?.timerWaveformLoop ?? defaults.timerWaveformLoop!
	};
	if (row?.detune !== undefined) {
		normalized.detune = row.detune;
	}
	if (row?.semitone !== undefined) {
		normalized.semitone = row.semitone;
	}
	if (row?.period !== undefined) {
		normalized.period = Math.max(1, row.period & 0xffff);
	}
	return resolveExclusiveTimerEffects(normalized);
}

function resolveInstrumentTimerPwmFields(
	extended: ExtendedInstrument,
	sourceRows: LegacyTimerRow[]
): Pick<AyInstrumentFields, 'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'> {
	if (
		extended.timerPwmDuty !== undefined ||
		extended.timerPwmSweepMin !== undefined ||
		extended.timerPwmSweep !== undefined
	) {
		return normalizeInstrumentTimerPwmFields(extended);
	}

	const legacyRow = sourceRows.find(
		(row) =>
			row?.timerPwmDuty !== undefined ||
			row?.timerPwmSweepMin !== undefined ||
			row?.timerPwmSweep !== undefined
	);
	if (legacyRow) {
		return normalizeInstrumentTimerPwmFields(legacyRow);
	}

	return createDefaultInstrumentTimerPwmFields();
}

export function normalizeAyInstrumentFields(instrument: Instrument): AyInstrumentFields {
	const rowCount = Math.max(instrument.rows.length, 1);
	const extended = instrument as ExtendedInstrument;
	const sourceRows = extended.timerRows ?? [];
	const timerRows = Array.from({ length: rowCount }, (_, index) =>
		normalizeTimerRow(sourceRows[index])
	);

	return {
		timerRows,
		...resolveInstrumentTimerPwmFields(extended, sourceRows),
		timerPwmPreserveOnNewNote: extended.timerPwmPreserveOnNewNote === true
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
	const extended = instrument as ExtendedInstrument;
	extended.timerRows = timerRows;
	extended.timerPwmDuty = fields.timerPwmDuty;
	extended.timerPwmSweepMin = fields.timerPwmSweepMin;
	extended.timerPwmSweep = fields.timerPwmSweep;
	extended.timerPwmPreserveOnNewNote = fields.timerPwmPreserveOnNewNote;
	return timerRows;
}

export function copyAyInstrumentFields(
	source: Instrument & Partial<AyInstrumentFields>,
	target: Instrument & Partial<AyInstrumentFields>
): void {
	const normalized = normalizeAyInstrumentFields(source as Instrument);
	if (source.timerRows) {
		target.timerRows = normalized.timerRows.map((row) => ({
			...row,
			timerWaveform: row.timerWaveform ? [...row.timerWaveform] : undefined
		}));
	}
	target.timerPwmDuty = normalized.timerPwmDuty;
	target.timerPwmSweepMin = normalized.timerPwmSweepMin;
	target.timerPwmSweep = normalized.timerPwmSweep;
	target.timerPwmPreserveOnNewNote = normalized.timerPwmPreserveOnNewNote;
}
