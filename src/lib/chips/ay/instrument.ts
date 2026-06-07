import type { Instrument } from '../../models/song';
import { isValidInstrumentSampleByteLength } from '../../utils/audio-sample-decode';
import { normalizeSamplePlaybackBounds } from './sample-region';

export type AySidPeriodMode = 'auto' | 'manual';
export type AyFmOffsetMode = 'semitone' | 'period';

export type AyTimerRow = {
	sid: boolean;
	syncbuzzer?: boolean;
	fm?: boolean;
	fmOffsetMode?: AyFmOffsetMode;
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
	timerPwmReverseSweep: boolean;
	sampleData?: number[];
	sampleRate?: number;
	sampleStart?: number;
	sampleEnd?: number;
	sampleLoopStart?: number;
	sampleLength?: number;
	sampleLoopEnabled?: boolean;
	sampleLoop?: number;
};

export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 1;
export const DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE = 0;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];
export const DEFAULT_AY_SYNCBUZZER_WAVEFORM = [8];
export const DEFAULT_AY_FM_WAVEFORM = [0, 7];
export const DEFAULT_AY_FM_PERIOD_WAVEFORM = [0, 16, 0, -16];
export const AY_FM_SEMITONE_MIN = -127;
export const AY_FM_SEMITONE_MAX = 128;
export const AY_FM_PERIOD_OFFSET_MIN = -4095;
export const AY_FM_PERIOD_OFFSET_MAX = 4095;
export const AY_TIMER_PWM_DUTY_MIN = 0;
export const AY_TIMER_PWM_DUTY_MAX = 50;
export const AY_TIMER_PWM_PERCENT_MAX_DIGITS = 2;
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
	timerPwmReverseSweep?: boolean;
	sampleData?: number[];
	sampleRate?: number;
	sampleStart?: number;
	sampleEnd?: number;
	sampleLoopStart?: number;
	sampleLength?: number;
	sampleLoopEnabled?: boolean;
	sampleLoop?: number;
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
		fm: false,
		timerWaveform: [...DEFAULT_AY_TIMER_WAVEFORM],
		timerWaveformLoop: 0
	};
}

export function resolveAyFmOffsetMode(row: AyTimerRow | undefined): AyFmOffsetMode {
	return row?.fmOffsetMode === 'period' ? 'period' : 'semitone';
}

export function defaultAyFmWaveform(mode: AyFmOffsetMode): number[] {
	return mode === 'period' ? [...DEFAULT_AY_FM_PERIOD_WAVEFORM] : [...DEFAULT_AY_FM_WAVEFORM];
}

export function clampFmSemitone(value: number): number {
	return Math.max(AY_FM_SEMITONE_MIN, Math.min(AY_FM_SEMITONE_MAX, value | 0));
}

export function clampFmPeriodOffset(value: number): number {
	return Math.max(AY_FM_PERIOD_OFFSET_MIN, Math.min(AY_FM_PERIOD_OFFSET_MAX, value | 0));
}

export function clampFmWaveformValue(value: number, mode: AyFmOffsetMode): number {
	return mode === 'period' ? clampFmPeriodOffset(value) : clampFmSemitone(value);
}

export function normalizeFmWaveform(
	waveform: readonly number[],
	mode: AyFmOffsetMode = 'semitone'
): number[] {
	return waveform
		.map((value) => clampFmWaveformValue(value, mode))
		.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH);
}

export function effectiveRowFmWaveform(row: AyTimerRow | undefined): number[] {
	if (!row?.fm) {
		return [...DEFAULT_AY_FM_WAVEFORM];
	}
	const mode = resolveAyFmOffsetMode(row);
	const waveform = row.timerWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeFmWaveform(waveform, mode);
	}
	return defaultAyFmWaveform(mode);
}

export function isDefaultFmTimerWaveform(waveform: readonly number[]): boolean {
	return (
		waveform.length === DEFAULT_AY_FM_WAVEFORM.length &&
		waveform.every(
			(value, index) => clampFmSemitone(value) === clampFmSemitone(DEFAULT_AY_FM_WAVEFORM[index]!)
		)
	);
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

export function isPatternEnvelopeShapeSet(envelopeShape: number): boolean {
	return envelopeShape !== 0 && envelopeShape !== 15;
}

export function isDefaultSidTimerWaveform(waveform: readonly number[]): boolean {
	return (
		waveform.length === DEFAULT_AY_TIMER_WAVEFORM.length &&
		waveform.every((value, index) => (value & 0xf) === (DEFAULT_AY_TIMER_WAVEFORM[index]! & 0xf))
	);
}

export function resolveSyncbuzzerWaveform(
	timerRow: AyTimerRow | undefined,
	patternShapeOverride: boolean,
	patternEnvelopeShape: number
): number[] {
	if (patternShapeOverride) {
		return [patternEnvelopeShape & 0xf];
	}
	return effectiveRowTimerWaveform(timerRow).map((value) => value & 0xf);
}

export function rowSupportsTimerPwm(row: AyTimerRow | undefined): boolean {
	if (!row || (!row.sid && !row.syncbuzzer && !row.fm)) {
		return false;
	}
	const waveform = row.fm ? effectiveRowFmWaveform(row) : effectiveRowTimerWaveform(row);
	return waveform.length === 2;
}

export function rowUsesSyncbuzzerPwmDuty(row: AyTimerRow | undefined): boolean {
	return !!row?.syncbuzzer && rowSupportsTimerPwm(row);
}

export function instrumentSupportsTimerPwm(fields: AyInstrumentFields): boolean {
	return fields.timerRows.some(
		(row) => (row.sid || row.syncbuzzer || row.fm) && rowSupportsTimerPwm(row)
	);
}

export function normalizeInstrumentTimerPwmFields(
	source: Partial<Pick<AyInstrumentFields, 'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'>>
): Pick<AyInstrumentFields, 'timerPwmDuty' | 'timerPwmSweepMin' | 'timerPwmSweep'> {
	const timerPwmDuty = clampTimerPwmDuty(source.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY);
	const timerPwmSweep = clampTimerPwmSweep(source.timerPwmSweep ?? DEFAULT_AY_TIMER_PWM_SWEEP);
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
	return clampTimerPwmSweep(fields.timerPwmSweep ?? DEFAULT_AY_TIMER_PWM_SWEEP);
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
	maxDuty: number,
	reverseSweep = false
): { duty: number; direction: number } {
	const min = clampTimerPwmSweepMin(minDuty, maxDuty);
	const max = clampTimerPwmDuty(maxDuty);

	if (sweepSpeed <= 0 || min >= max) {
		return { duty: max, direction: 1 };
	}

	if (currentDuty < 0) {
		return reverseSweep
			? { duty: max, direction: -1 }
			: { duty: min, direction: 1 };
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

export function clampTimerPwmSweep(sweep: number): number {
	return Math.max(0, Math.min(AY_TIMER_PWM_DUTY_MAX, sweep | 0));
}

export function sanitizeTimerPwmPercentInput(
	raw: string,
	max: number,
	maxDigits = AY_TIMER_PWM_PERCENT_MAX_DIGITS
): string {
	const digits = raw.replace(/\D/g, '').slice(0, maxDigits);
	if (digits === '') {
		return '';
	}
	const parsed = Number.parseInt(digits, 10);
	if (!Number.isFinite(parsed)) {
		return '';
	}
	if (parsed > max) {
		return String(max);
	}
	return digits;
}

export function sanitizeTimerPwmSweepInput(
	raw: string,
	max: number,
	asHex: boolean,
	maxDigits = AY_TIMER_PWM_PERCENT_MAX_DIGITS
): string {
	const digits = asHex
		? raw.replace(/[^0-9a-fA-F]/g, '').slice(0, maxDigits)
		: raw.replace(/\D/g, '').slice(0, maxDigits);
	if (digits === '') {
		return '';
	}
	const parsed = asHex ? Number.parseInt(digits, 16) : Number.parseInt(digits, 10);
	if (!Number.isFinite(parsed)) {
		return '';
	}
	if (parsed > max) {
		return asHex ? max.toString(16).toUpperCase() : String(max);
	}
	return asHex ? digits.toUpperCase() : digits;
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
		return { ...row, syncbuzzer: false, fm: false };
	}
	if (row.syncbuzzer) {
		return { ...row, sid: false, fm: false };
	}
	if (row.fm) {
		return { ...row, sid: false, syncbuzzer: false };
	}
	return row;
}

function normalizeTimerRow(row: LegacyTimerRow | undefined): AyTimerRow {
	const defaults = createDefaultAyTimerRow();
	const fm = row?.fm ?? defaults.fm ?? false;
	const fmOffsetMode = resolveAyFmOffsetMode(row);
	const normalized: AyTimerRow = {
		sid: row?.sid ?? defaults.sid,
		syncbuzzer: row?.syncbuzzer ?? defaults.syncbuzzer,
		fm,
		fmOffsetMode,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		timerWaveform: row?.timerWaveform?.length
			? fm
				? normalizeFmWaveform(row.timerWaveform, fmOffsetMode)
				: row.timerWaveform.map((value) => value & 0xf).slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			: fm
				? defaultAyFmWaveform(fmOffsetMode)
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
	if (fmOffsetMode === 'period') {
		normalized.fmOffsetMode = 'period';
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
		timerPwmPreserveOnNewNote: extended.timerPwmPreserveOnNewNote === true,
		timerPwmReverseSweep: extended.timerPwmReverseSweep === true
	};
}

export function formatAyTimerWaveform(waveform: readonly number[], asHex: boolean): string {
	return waveform
		.map((value) => (asHex ? (value & 0xf).toString(16).toUpperCase() : String(value & 0xf)))
		.join(' ');
}

export function formatAyFmWaveform(
	waveform: readonly number[],
	asHex: boolean,
	mode: AyFmOffsetMode = 'semitone'
): string {
	return waveform
		.map((value) => {
			const clamped = clampFmWaveformValue(value, mode);
			if (asHex) {
				const sign = clamped < 0 ? '-' : '';
				return sign + Math.abs(clamped).toString(16).toUpperCase();
			}
			return String(clamped);
		})
		.join(' ');
}

export function isIncompleteSignedNumericToken(part: string): boolean {
	return part === '-' || part === '+' || /^-0+$/.test(part);
}

function parseFmWaveformToken(part: string, asHex: boolean): number | null {
	if (isIncompleteSignedNumericToken(part)) {
		return null;
	}
	if (asHex) {
		let sign = 1;
		let temp = part;
		if (temp.startsWith('-')) {
			sign = -1;
			temp = temp.substring(1);
		}
		if (temp.length === 0 || (sign < 0 && /^0+$/.test(temp))) {
			return null;
		}
		if (!/^[0-9a-fA-F]+$/.test(temp)) {
			return null;
		}
		return sign * parseInt(temp, 16);
	}
	if (!/^-?\d+$/.test(part)) {
		return null;
	}
	return parseInt(part, 10);
}

export function parseAyFmWaveformPartial(
	text: string,
	asHex: boolean,
	mode: AyFmOffsetMode = 'semitone'
): number[] | null {
	if (!text.trim()) {
		return null;
	}
	const min = mode === 'period' ? AY_FM_PERIOD_OFFSET_MIN : AY_FM_SEMITONE_MIN;
	const max = mode === 'period' ? AY_FM_PERIOD_OFFSET_MAX : AY_FM_SEMITONE_MAX;
	const parts = text.trimEnd().split(/\s+/).filter((part) => part.length > 0);
	const values: number[] = [];
	for (const part of parts) {
		const parsed = parseFmWaveformToken(part, asHex);
		if (parsed === null || parsed < min || parsed > max) {
			break;
		}
		values.push(parsed);
		if (values.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			break;
		}
	}
	return values.length > 0 ? values : null;
}

export function parseAyFmWaveform(
	text: string,
	asHex: boolean,
	mode: AyFmOffsetMode = 'semitone'
): number[] | null {
	const values = parseAyFmWaveformPartial(text, asHex, mode);
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
		const parsed = parseFmWaveformToken(parts[index], asHex);
		if (parsed === null || parsed !== values[index]) {
			return null;
		}
	}
	return values;
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
	extended.timerPwmReverseSweep = fields.timerPwmReverseSweep;
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
	target.timerPwmReverseSweep = normalized.timerPwmReverseSweep;
	if (
		source.sampleData?.length &&
		isValidInstrumentSampleByteLength(source.sampleData.length)
	) {
		target.sampleData = source.sampleData.map((value) => value & 0xff);
		target.sampleRate = source.sampleRate;
		const bounds = normalizeSamplePlaybackBounds({
			sampleData: target.sampleData,
			sampleStart: source.sampleStart,
			sampleEnd: source.sampleEnd,
			sampleLoopStart: source.sampleLoopStart,
			sampleLength: source.sampleLength,
			sampleLoop: source.sampleLoop
		});
		if (bounds) {
			target.sampleStart = bounds.start;
			target.sampleEnd = bounds.end;
			target.sampleLoopStart = bounds.loopStart;
		}
		target.sampleLoopEnabled = source.sampleLoopEnabled !== false;
		delete target.sampleLength;
		delete target.sampleLoop;
	} else {
		delete target.sampleData;
		delete target.sampleRate;
		delete target.sampleStart;
		delete target.sampleEnd;
		delete target.sampleLoopStart;
		delete target.sampleLength;
		delete target.sampleLoopEnabled;
		delete target.sampleLoop;
	}
}
