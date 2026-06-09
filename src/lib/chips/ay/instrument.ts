import type { Instrument } from '../../models/song';
import { isValidInstrumentSampleByteLength } from '../../utils/audio-sample-decode';
import { normalizeSamplePlaybackBounds } from './sample-region';

export type AySidPeriodMode = 'auto' | 'manual';
export type AyFmOffsetMode = 'semitone' | 'period';

export type AyTimerRow = {
	sid: boolean;
	syncbuzzer?: boolean;
	fm?: boolean;
	envfm?: boolean;
	fmOffsetMode?: AyFmOffsetMode;
	sidPeriodMode?: AySidPeriodMode;
	detune?: number;
	period?: number;
	semitone?: number;
	timerWaveform?: number[];
	fmTimerWaveform?: number[];
	envFmTimerWaveform?: number[];
	timerWaveformLoop?: number;
};

export type AyTimerPwmScope = 'sidSync' | 'fm' | 'efm';

export const AY_TIMER_PWM_SCOPES: readonly AyTimerPwmScope[] = ['sidSync', 'fm', 'efm'];

export type AyTimerPwmScopeFields = {
	duty: number;
	sweepMin: number;
	sweep: number;
	sweepShape: AyTimerPwmSweepShape;
	automationTrigger: AyTimerPwmAutomationTrigger;
	reverseSweep: boolean;
};

export type AyInstrumentFields = {
	timerRows: AyTimerRow[];
	timerPwmSidSyncDuty: number;
	timerPwmSidSyncSweepMin: number;
	timerPwmSidSyncSweep: number;
	timerPwmSidSyncSweepShape: AyTimerPwmSweepShape;
	timerPwmSidSyncAutomationTrigger: AyTimerPwmAutomationTrigger;
	timerPwmSidSyncReverseSweep: boolean;
	timerPwmFmDuty: number;
	timerPwmFmSweepMin: number;
	timerPwmFmSweep: number;
	timerPwmFmSweepShape: AyTimerPwmSweepShape;
	timerPwmFmAutomationTrigger: AyTimerPwmAutomationTrigger;
	timerPwmFmReverseSweep: boolean;
	timerPwmEfmDuty: number;
	timerPwmEfmSweepMin: number;
	timerPwmEfmSweep: number;
	timerPwmEfmSweepShape: AyTimerPwmSweepShape;
	timerPwmEfmAutomationTrigger: AyTimerPwmAutomationTrigger;
	timerPwmEfmReverseSweep: boolean;
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
export const DEFAULT_AY_ENV_FM_WAVEFORM = [-1, 1];
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
export const DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE = 'tri' as const;
export const AY_TIMER_PWM_SWEEP_PHASE_PERIOD = 1000;
export const TIMER_PWM_SWEEP_UNINITIALIZED = -1;
export const DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ = 50;

export function effectiveTimerPwmSweepPerInterrupt(
	sweepSpeed: number,
	intFrequency: number
): number {
	const hz =
		intFrequency > 0 ? intFrequency : DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ;
	return (sweepSpeed * DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ) / hz;
}

export type AyTimerPwmSweepShape =
	| 'tri'
	| 'sin'
	| 'rampdn'
	| 'ramup'
	| 'expdn'
	| 'expup'
	| 'square';

export const AY_TIMER_PWM_SWEEP_SHAPES: readonly AyTimerPwmSweepShape[] = [
	'tri',
	'sin',
	'rampdn',
	'ramup',
	'expdn',
	'expup',
	'square'
];

export type AyTimerPwmAutomationTrigger = 'once' | 'free' | 'retrigger';

export const AY_TIMER_PWM_AUTOMATION_TRIGGERS: readonly AyTimerPwmAutomationTrigger[] = [
	'once',
	'free',
	'retrigger'
];

export const DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER: AyTimerPwmAutomationTrigger = 'retrigger';
export const AY_TIMER_WAVEFORM_MIN_LENGTH = 1;
export const AY_TIMER_WAVEFORM_MAX_LENGTH = 32;
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

type LegacyTimerPwmFields = {
	timerPwmDuty?: number;
	timerPwmSweepMin?: number;
	timerPwmSweep?: number;
	timerPwmSweepShape?: AyTimerPwmSweepShape;
	timerPwmReverseSweep?: boolean;
};

type ExtendedInstrument = Instrument &
	Partial<AyInstrumentFields> &
	LegacyTimerPwmFields & {
	timerRows?: AyTimerRow[];
	sampleData?: number[];
	sampleRate?: number;
	sampleStart?: number;
	sampleEnd?: number;
	sampleLoopStart?: number;
	sampleLength?: number;
	sampleLoopEnabled?: boolean;
	sampleLoop?: number;
};

type LegacyTimerRow = AyTimerRow & LegacyTimerPwmFields;

const TIMER_PWM_SCOPE_FIELD_NAMES: Record<
	AyTimerPwmScope,
	{
		duty: keyof AyInstrumentFields;
		sweepMin: keyof AyInstrumentFields;
		sweep: keyof AyInstrumentFields;
		sweepShape: keyof AyInstrumentFields;
		automationTrigger: keyof AyInstrumentFields;
		reverseSweep: keyof AyInstrumentFields;
	}
> = {
	sidSync: {
		duty: 'timerPwmSidSyncDuty',
		sweepMin: 'timerPwmSidSyncSweepMin',
		sweep: 'timerPwmSidSyncSweep',
		sweepShape: 'timerPwmSidSyncSweepShape',
		automationTrigger: 'timerPwmSidSyncAutomationTrigger',
		reverseSweep: 'timerPwmSidSyncReverseSweep'
	},
	fm: {
		duty: 'timerPwmFmDuty',
		sweepMin: 'timerPwmFmSweepMin',
		sweep: 'timerPwmFmSweep',
		sweepShape: 'timerPwmFmSweepShape',
		automationTrigger: 'timerPwmFmAutomationTrigger',
		reverseSweep: 'timerPwmFmReverseSweep'
	},
	efm: {
		duty: 'timerPwmEfmDuty',
		sweepMin: 'timerPwmEfmSweepMin',
		sweep: 'timerPwmEfmSweep',
		sweepShape: 'timerPwmEfmSweepShape',
		automationTrigger: 'timerPwmEfmAutomationTrigger',
		reverseSweep: 'timerPwmEfmReverseSweep'
	}
};

export function timerPwmScopeLabel(scope: AyTimerPwmScope): string {
	if (scope === 'sidSync') {
		return 'SID/SYNC';
	}
	if (scope === 'fm') {
		return 'FM';
	}
	return 'EFM';
}

export function normalizeTimerPwmAutomationTrigger(value: unknown): AyTimerPwmAutomationTrigger {
	if (value === 'once' || value === 'free' || value === 'retrigger') {
		return value;
	}
	return DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER;
}

export function timerPwmAutomationTriggerLabel(
	trigger: AyTimerPwmAutomationTrigger
): string {
	switch (trigger) {
		case 'once':
			return 'Once';
		case 'free':
			return 'Free';
		case 'retrigger':
			return 'Retrigger';
	}
}

export function shouldResetTimerPwmScopeOnNewNote(
	trigger: AyTimerPwmAutomationTrigger
): boolean {
	return trigger !== 'free';
}

export function createDefaultTimerPwmScopeFields(): AyTimerPwmScopeFields {
	return {
		duty: DEFAULT_AY_TIMER_PWM_DUTY,
		sweepMin: DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		sweep: DEFAULT_AY_TIMER_PWM_SWEEP,
		sweepShape: DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE,
		automationTrigger: DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER,
		reverseSweep: false
	};
}

export function createDefaultInstrumentTimerPwmFields(): Pick<
	AyInstrumentFields,
	| 'timerPwmSidSyncDuty'
	| 'timerPwmSidSyncSweepMin'
	| 'timerPwmSidSyncSweep'
	| 'timerPwmSidSyncSweepShape'
	| 'timerPwmSidSyncAutomationTrigger'
	| 'timerPwmSidSyncReverseSweep'
	| 'timerPwmFmDuty'
	| 'timerPwmFmSweepMin'
	| 'timerPwmFmSweep'
	| 'timerPwmFmSweepShape'
	| 'timerPwmFmAutomationTrigger'
	| 'timerPwmFmReverseSweep'
	| 'timerPwmEfmDuty'
	| 'timerPwmEfmSweepMin'
	| 'timerPwmEfmSweep'
	| 'timerPwmEfmSweepShape'
	| 'timerPwmEfmAutomationTrigger'
	| 'timerPwmEfmReverseSweep'
> {
	const defaults = createDefaultTimerPwmScopeFields();
	return {
		timerPwmSidSyncDuty: defaults.duty,
		timerPwmSidSyncSweepMin: defaults.sweepMin,
		timerPwmSidSyncSweep: defaults.sweep,
		timerPwmSidSyncSweepShape: defaults.sweepShape,
		timerPwmSidSyncAutomationTrigger: defaults.automationTrigger,
		timerPwmSidSyncReverseSweep: defaults.reverseSweep,
		timerPwmFmDuty: defaults.duty,
		timerPwmFmSweepMin: defaults.sweepMin,
		timerPwmFmSweep: defaults.sweep,
		timerPwmFmSweepShape: defaults.sweepShape,
		timerPwmFmAutomationTrigger: defaults.automationTrigger,
		timerPwmFmReverseSweep: defaults.reverseSweep,
		timerPwmEfmDuty: defaults.duty,
		timerPwmEfmSweepMin: defaults.sweepMin,
		timerPwmEfmSweep: defaults.sweep,
		timerPwmEfmSweepShape: defaults.sweepShape,
		timerPwmEfmAutomationTrigger: defaults.automationTrigger,
		timerPwmEfmReverseSweep: defaults.reverseSweep
	};
}

export function timerPwmFieldsForScope(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): AyTimerPwmScopeFields {
	const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
	return {
		duty: fields[names.duty] as number,
		sweepMin: fields[names.sweepMin] as number,
		sweep: fields[names.sweep] as number,
		sweepShape: fields[names.sweepShape] as AyTimerPwmSweepShape,
		automationTrigger: fields[names.automationTrigger] as AyTimerPwmAutomationTrigger,
		reverseSweep: fields[names.reverseSweep] as boolean
	};
}

export function createDefaultAyTimerRow(): AyTimerRow {
	return {
		sid: false,
		syncbuzzer: false,
		fm: false,
		envfm: false,
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

export function defaultAyEnvFmWaveform(mode: AyFmOffsetMode): number[] {
	return mode === 'period' ? [...DEFAULT_AY_ENV_FM_WAVEFORM] : [...DEFAULT_AY_FM_WAVEFORM];
}

export function normalizeEnvFmWaveform(
	waveform: readonly number[],
	mode: AyFmOffsetMode = 'period'
): number[] {
	return normalizeFmWaveform(waveform, mode);
}

export type AyTimerWaveformEditLayer = 'sid' | 'syncbuzzer' | 'fm' | 'envfm';

export const AY_TIMER_WAVEFORM_EDIT_LAYER_LABELS: Record<AyTimerWaveformEditLayer, string> = {
	sid: 'SID',
	syncbuzzer: 'Sync',
	fm: 'FM',
	envfm: 'EFM'
};

export function rowTimerWaveformEditLayers(row: AyTimerRow | undefined): AyTimerWaveformEditLayer[] {
	if (!row) {
		return [];
	}
	const layers: AyTimerWaveformEditLayer[] = [];
	if (row.sid) {
		layers.push('sid');
	}
	if (row.syncbuzzer) {
		layers.push('syncbuzzer');
	}
	if (row.fm) {
		layers.push('fm');
	}
	if (row.envfm) {
		layers.push('envfm');
	}
	return layers;
}

export function resolveTimerWaveformEditLayer(
	row: AyTimerRow | undefined,
	preferred: AyTimerWaveformEditLayer | undefined
): AyTimerWaveformEditLayer {
	const available = rowTimerWaveformEditLayers(row);
	if (available.length === 0) {
		return 'sid';
	}
	if (preferred && available.includes(preferred)) {
		return preferred;
	}
	return available[0]!;
}

export function rowEffectiveWaveformForEditLayer(
	row: AyTimerRow | undefined,
	layer: AyTimerWaveformEditLayer
): number[] {
	if (layer === 'sid' || layer === 'syncbuzzer') {
		return effectiveRowTimerWaveform(row);
	}
	if (layer === 'fm') {
		return effectiveRowFmWaveform(row);
	}
	return effectiveRowEnvFmWaveform(row);
}

export function resolveTimerWaveformStorageField(
	row: AyTimerRow | undefined,
	layer: AyTimerWaveformEditLayer
): 'timerWaveform' | 'fmTimerWaveform' | 'envFmTimerWaveform' {
	if (layer === 'sid' || layer === 'syncbuzzer') {
		return 'timerWaveform';
	}
	if (layer === 'fm') {
		return rowHasSidOrSyncbuzzer(row) ? 'fmTimerWaveform' : 'timerWaveform';
	}
	return rowHasSidOrSyncbuzzer(row) || row?.fm ? 'envFmTimerWaveform' : 'timerWaveform';
}

export function timerWaveformEditLayerTitle(layer: AyTimerWaveformEditLayer): string {
	if (layer === 'sid') {
		return 'SID volume steps';
	}
	if (layer === 'syncbuzzer') {
		return 'Syncbuzzer envelope shapes';
	}
	if (layer === 'fm') {
		return 'FM tone offsets';
	}
	return 'Env FM envelope value offsets';
}

export function rowHasSidOrSyncbuzzer(row: AyTimerRow | undefined): boolean {
	return !!(row?.sid || row?.syncbuzzer);
}

export function effectiveRowEnvFmWaveform(row: AyTimerRow | undefined): number[] {
	if (!row?.envfm) {
		return defaultAyEnvFmWaveform('period');
	}
	const mode = resolveAyFmOffsetMode(row);
	if (rowHasSidOrSyncbuzzer(row) || row.fm) {
		const waveform = row.envFmTimerWaveform;
		if (waveform && waveform.length > 0) {
			return normalizeEnvFmWaveform(waveform, mode);
		}
		return defaultAyEnvFmWaveform(mode);
	}
	const waveform = row.timerWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeEnvFmWaveform(waveform, mode);
	}
	return defaultAyEnvFmWaveform(mode);
}

export function effectiveRowFmWaveform(row: AyTimerRow | undefined): number[] {
	if (!row?.fm) {
		return [...DEFAULT_AY_FM_WAVEFORM];
	}
	const mode = resolveAyFmOffsetMode(row);
	if (rowHasSidOrSyncbuzzer(row)) {
		const waveform = row.fmTimerWaveform;
		if (waveform && waveform.length > 0) {
			return normalizeFmWaveform(waveform, mode);
		}
		return defaultAyFmWaveform(mode);
	}
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
	patternEnvelopeShape: number
): number[] {
	const steps = effectiveRowTimerWaveform(timerRow).map((value) => value & 0xf);
	if (!isPatternEnvelopeShapeSet(patternEnvelopeShape)) {
		return steps;
	}
	const patternShape = patternEnvelopeShape & 0xf;
	return steps.map((step) => (step === 0 ? patternShape : step));
}

export function rowTimerPwmReferenceWaveform(row: AyTimerRow | undefined): number[] {
	if (row?.sid || row?.syncbuzzer) {
		return effectiveRowTimerWaveform(row);
	}
	if (row?.fm) {
		return effectiveRowFmWaveform(row);
	}
	if (row?.envfm) {
		return effectiveRowEnvFmWaveform(row);
	}
	return effectiveRowTimerWaveform(row);
}

export function rowScopeSupportsTimerPwm(
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): boolean {
	if (!row) {
		return false;
	}
	if (scope === 'sidSync') {
		return !!(row.sid || row.syncbuzzer) && effectiveRowTimerWaveform(row).length === 2;
	}
	if (scope === 'fm') {
		return !!row.fm && effectiveRowFmWaveform(row).length === 2;
	}
	return !!row.envfm && effectiveRowEnvFmWaveform(row).length === 2;
}

export function rowSupportsTimerPwm(row: AyTimerRow | undefined): boolean {
	return AY_TIMER_PWM_SCOPES.some((scope) => rowScopeSupportsTimerPwm(row, scope));
}

export function rowUsesSyncbuzzerPwmDuty(row: AyTimerRow | undefined): boolean {
	return !!row?.syncbuzzer && rowScopeSupportsTimerPwm(row, 'sidSync');
}

export function instrumentScopeSupportsTimerPwm(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): boolean {
	return fields.timerRows.some((row) => rowScopeSupportsTimerPwm(row, scope));
}

export function instrumentSupportsTimerPwm(fields: AyInstrumentFields): boolean {
	return AY_TIMER_PWM_SCOPES.some((scope) => instrumentScopeSupportsTimerPwm(fields, scope));
}

export function resolveRowPrimaryTimerPwmScope(options: {
	sidPwmSupported: boolean;
	syncbuzzerPwmSupported: boolean;
	fmPwmSupported: boolean;
	envfmPwmSupported: boolean;
}): AyTimerPwmScope | null {
	if (options.sidPwmSupported || options.syncbuzzerPwmSupported) {
		return 'sidSync';
	}
	if (options.fmPwmSupported) {
		return 'fm';
	}
	if (options.envfmPwmSupported) {
		return 'efm';
	}
	return null;
}

export function normalizeTimerPwmScopeFields(
	source: Partial<AyTimerPwmScopeFields>
): AyTimerPwmScopeFields {
	const duty = clampTimerPwmDuty(source.duty ?? DEFAULT_AY_TIMER_PWM_DUTY);
	const sweep = clampTimerPwmSweep(source.sweep ?? DEFAULT_AY_TIMER_PWM_SWEEP);
	return {
		duty,
		sweepMin:
			sweep <= 0
				? DEFAULT_AY_TIMER_PWM_SWEEP_MIN
				: clampTimerPwmSweepMin(source.sweepMin ?? DEFAULT_AY_TIMER_PWM_SWEEP_MIN, duty),
		sweep,
		sweepShape: normalizeTimerPwmSweepShape(source.sweepShape),
		automationTrigger: normalizeTimerPwmAutomationTrigger(source.automationTrigger),
		reverseSweep: source.reverseSweep === true
	};
}

export function normalizeInstrumentTimerPwmScopeFields(
	source: Partial<AyInstrumentFields>,
	scope: AyTimerPwmScope
): AyTimerPwmScopeFields {
	const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
	return normalizeTimerPwmScopeFields({
		duty: source[names.duty] as number | undefined,
		sweepMin: source[names.sweepMin] as number | undefined,
		sweep: source[names.sweep] as number | undefined,
		sweepShape: source[names.sweepShape] as AyTimerPwmSweepShape | undefined,
		automationTrigger: source[names.automationTrigger] as AyTimerPwmAutomationTrigger | undefined,
		reverseSweep: source[names.reverseSweep] as boolean | undefined
	});
}

export function normalizeAllInstrumentTimerPwmFields(
	source: Partial<AyInstrumentFields>
): Pick<
	AyInstrumentFields,
	| 'timerPwmSidSyncDuty'
	| 'timerPwmSidSyncSweepMin'
	| 'timerPwmSidSyncSweep'
	| 'timerPwmSidSyncSweepShape'
	| 'timerPwmSidSyncAutomationTrigger'
	| 'timerPwmSidSyncReverseSweep'
	| 'timerPwmFmDuty'
	| 'timerPwmFmSweepMin'
	| 'timerPwmFmSweep'
	| 'timerPwmFmSweepShape'
	| 'timerPwmFmAutomationTrigger'
	| 'timerPwmFmReverseSweep'
	| 'timerPwmEfmDuty'
	| 'timerPwmEfmSweepMin'
	| 'timerPwmEfmSweep'
	| 'timerPwmEfmSweepShape'
	| 'timerPwmEfmAutomationTrigger'
	| 'timerPwmEfmReverseSweep'
> {
	const sidSync = normalizeInstrumentTimerPwmScopeFields(source, 'sidSync');
	const fm = normalizeInstrumentTimerPwmScopeFields(source, 'fm');
	const efm = normalizeInstrumentTimerPwmScopeFields(source, 'efm');
	return {
		timerPwmSidSyncDuty: sidSync.duty,
		timerPwmSidSyncSweepMin: sidSync.sweepMin,
		timerPwmSidSyncSweep: sidSync.sweep,
		timerPwmSidSyncSweepShape: sidSync.sweepShape,
		timerPwmSidSyncAutomationTrigger: sidSync.automationTrigger,
		timerPwmSidSyncReverseSweep: sidSync.reverseSweep,
		timerPwmFmDuty: fm.duty,
		timerPwmFmSweepMin: fm.sweepMin,
		timerPwmFmSweep: fm.sweep,
		timerPwmFmSweepShape: fm.sweepShape,
		timerPwmFmAutomationTrigger: fm.automationTrigger,
		timerPwmFmReverseSweep: fm.reverseSweep,
		timerPwmEfmDuty: efm.duty,
		timerPwmEfmSweepMin: efm.sweepMin,
		timerPwmEfmSweep: efm.sweep,
		timerPwmEfmSweepShape: efm.sweepShape,
		timerPwmEfmAutomationTrigger: efm.automationTrigger,
		timerPwmEfmReverseSweep: efm.reverseSweep
	};
}

export function effectiveScopeTimerPwmDuty(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): number {
	return timerPwmFieldsForScope(fields, scope).duty;
}

export function effectiveScopeTimerPwmSweep(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): number {
	return timerPwmFieldsForScope(fields, scope).sweep;
}

export function effectiveScopeTimerPwmSweepMin(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): number {
	return timerPwmFieldsForScope(fields, scope).sweepMin;
}

export function effectiveScopeTimerPwmSweepShape(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): AyTimerPwmSweepShape {
	return timerPwmFieldsForScope(fields, scope).sweepShape;
}

export function effectiveScopeTimerPwmAutomationTrigger(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): AyTimerPwmAutomationTrigger {
	return timerPwmFieldsForScope(fields, scope).automationTrigger;
}

export function effectiveScopeTimerPwmReverseSweep(
	fields: AyInstrumentFields,
	scope: AyTimerPwmScope
): boolean {
	return timerPwmFieldsForScope(fields, scope).reverseSweep;
}

export function effectiveRowTimerPwmDuty(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): number {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_DUTY;
	}
	return effectiveScopeTimerPwmDuty(fields, scope);
}

export function effectiveRowTimerPwmSweep(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): number {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP;
	}
	return effectiveScopeTimerPwmSweep(fields, scope);
}

export function effectiveRowTimerPwmSweepMin(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): number {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_MIN;
	}
	return effectiveScopeTimerPwmSweepMin(fields, scope);
}

export function effectiveRowTimerPwmSweepShape(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): AyTimerPwmSweepShape {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE;
	}
	return effectiveScopeTimerPwmSweepShape(fields, scope);
}

export function effectiveRowTimerPwmAutomationTrigger(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): AyTimerPwmAutomationTrigger {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER;
	}
	return effectiveScopeTimerPwmAutomationTrigger(fields, scope);
}

export function effectiveRowTimerPwmReverseSweep(
	fields: AyInstrumentFields,
	row: AyTimerRow | undefined,
	scope: AyTimerPwmScope
): boolean {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return false;
	}
	return effectiveScopeTimerPwmReverseSweep(fields, scope);
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

export function advanceTimerPwmSweepLinearOnce(
	currentDuty: number,
	direction: number,
	sweepSpeed: number,
	minDuty: number,
	maxDuty: number,
	reverseSweep = false,
	hasTurned = false,
	onceComplete = false
): {
	sweepState: number;
	direction: number;
	duty: number;
	hasTurned: boolean;
	onceComplete: boolean;
} {
	const min = clampTimerPwmSweepMin(minDuty, maxDuty);
	const max = clampTimerPwmDuty(maxDuty);
	const startDuty = reverseSweep ? max : min;

	if (onceComplete) {
		const duty = currentDuty < 0 ? startDuty : clampTimerPwmDuty(currentDuty);
		return {
			sweepState: duty,
			direction: reverseSweep ? -1 : 1,
			duty,
			hasTurned: true,
			onceComplete: true
		};
	}

	if (sweepSpeed <= 0 || min >= max) {
		return { sweepState: max, direction: 1, duty: max, hasTurned: false, onceComplete: true };
	}

	if (currentDuty < 0) {
		const initialDirection = reverseSweep ? -1 : 1;
		return {
			sweepState: startDuty,
			direction: initialDirection,
			duty: startDuty,
			hasTurned: false,
			onceComplete: false
		};
	}

	const advanced = advanceTimerPwmSweep(
		currentDuty,
		direction,
		sweepSpeed,
		minDuty,
		maxDuty,
		reverseSweep
	);

	const oppositeDuty = reverseSweep ? min : max;
	const turnedAtOpposite =
		advanced.duty === oppositeDuty && direction !== advanced.direction;
	const nextHasTurned = hasTurned || turnedAtOpposite;

	const returnedToStart =
		nextHasTurned &&
		advanced.duty === startDuty &&
		direction !== advanced.direction;

	return {
		sweepState: advanced.duty,
		direction: advanced.direction,
		duty: advanced.duty,
		hasTurned: nextHasTurned,
		onceComplete: returnedToStart
	};
}

export function normalizeTimerPwmSweepShape(value: unknown): AyTimerPwmSweepShape {
	if (typeof value === 'string') {
		if ((AY_TIMER_PWM_SWEEP_SHAPES as readonly string[]).includes(value)) {
			return value as AyTimerPwmSweepShape;
		}
		if (value === 'rampup') {
			return 'ramup';
		}
	}
	return DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE;
}

export function timerPwmSweepShapeLabel(shape: AyTimerPwmSweepShape): string {
	switch (shape) {
		case 'tri':
			return 'Triangle';
		case 'sin':
			return 'Sine';
		case 'rampdn':
			return 'Ramp down';
		case 'ramup':
			return 'Ramp up';
		case 'expdn':
			return 'Exp down';
		case 'expup':
			return 'Exp up';
		case 'square':
			return 'Square';
	}
}

export function sampleTimerPwmSweepShape(shape: AyTimerPwmSweepShape, phase: number): number {
	const t = Math.max(0, Math.min(1, phase));
	switch (shape) {
		case 'tri':
			return t < 0.5 ? t * 2 : 2 - t * 2;
		case 'sin':
			return (1 - Math.cos(t * Math.PI * 2)) / 2;
		case 'ramup':
			return t;
		case 'rampdn':
			return 1 - t;
		case 'expup': {
			if (t <= 0) {
				return 0;
			}
			const expMax = Math.expm1(2);
			return Math.expm1(t * 2) / expMax;
		}
		case 'expdn': {
			if (t >= 1) {
				return 0;
			}
			const expMax = Math.expm1(2);
			return Math.expm1(2 * (1 - t)) / expMax;
		}
		case 'square':
			return t < 0.5 ? 1 : 0;
	}
}

export function advanceTimerPwmSweepPhase(
	currentPhase: number,
	sweepSpeed: number,
	minDuty: number,
	maxDuty: number,
	shape: AyTimerPwmSweepShape,
	reverseSweep = false
): { phase: number; duty: number } {
	const min = clampTimerPwmSweepMin(minDuty, maxDuty);
	const max = clampTimerPwmDuty(maxDuty);
	const period = AY_TIMER_PWM_SWEEP_PHASE_PERIOD;

	if (sweepSpeed <= 0 || min >= max) {
		return { phase: 0, duty: max };
	}

	let phase = currentPhase;
	if (phase < 0) {
		phase = reverseSweep ? Math.floor(period / 2) : 0;
	}

	phase = (phase + sweepSpeed) % period;
	let normalized = phase / period;
	if (reverseSweep) {
		normalized = (normalized + 0.5) % 1;
	}

	const factor = sampleTimerPwmSweepShape(shape, normalized);
	const duty = Math.round(min + (max - min) * factor);
	return { phase, duty: clampTimerPwmDuty(duty) };
}

export function advanceTimerPwmSweepPhaseOnce(
	currentPhase: number,
	sweepSpeed: number,
	minDuty: number,
	maxDuty: number,
	shape: AyTimerPwmSweepShape,
	reverseSweep = false,
	onceComplete = false
): { phase: number; duty: number; onceComplete: boolean } {
	const min = clampTimerPwmSweepMin(minDuty, maxDuty);
	const max = clampTimerPwmDuty(maxDuty);
	const period = AY_TIMER_PWM_SWEEP_PHASE_PERIOD;

	if (sweepSpeed <= 0 || min >= max) {
		return { phase: 0, duty: max, onceComplete: true };
	}

	let phase = currentPhase;
	if (phase < 0) {
		phase = reverseSweep ? Math.floor(period / 2) : 0;
	}

	const computeDuty = (samplePhase: number): number => {
		let normalized = samplePhase / period;
		if (reverseSweep) {
			normalized = (normalized + 0.5) % 1;
		}
		const factor = sampleTimerPwmSweepShape(shape, normalized);
		return clampTimerPwmDuty(Math.round(min + (max - min) * factor));
	};

	if (onceComplete) {
		const holdPhase = Math.min(phase, period - 1);
		return {
			phase: holdPhase,
			duty: computeDuty(holdPhase),
			onceComplete: true
		};
	}

	const nextPhase = phase + sweepSpeed;
	if (nextPhase >= period) {
		const holdPhase = period - 1;
		return {
			phase: holdPhase,
			duty: computeDuty(holdPhase),
			onceComplete: true
		};
	}

	return {
		phase: nextPhase,
		duty: computeDuty(nextPhase),
		onceComplete: false
	};
}

export function advanceTimerPwmSweepWithShape(
	currentSweepState: number,
	direction: number,
	sweepSpeed: number,
	minDuty: number,
	maxDuty: number,
	shape: AyTimerPwmSweepShape,
	reverseSweep = false,
	automationTrigger: AyTimerPwmAutomationTrigger = DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER,
	onceComplete = false,
	hasTurned = false
): { sweepState: number; direction: number; duty: number; onceComplete: boolean; hasTurned: boolean } {
	if (automationTrigger === 'once') {
		if (shape === 'tri') {
			const advanced = advanceTimerPwmSweepLinearOnce(
				currentSweepState,
				direction,
				sweepSpeed,
				minDuty,
				maxDuty,
				reverseSweep,
				hasTurned,
				onceComplete
			);
			return {
				sweepState: advanced.sweepState,
				direction: advanced.direction,
				duty: advanced.duty,
				onceComplete: advanced.onceComplete,
				hasTurned: advanced.hasTurned
			};
		}

		const advanced = advanceTimerPwmSweepPhaseOnce(
			currentSweepState,
			sweepSpeed,
			minDuty,
			maxDuty,
			shape,
			reverseSweep,
			onceComplete
		);
		return {
			sweepState: advanced.phase,
			direction: 1,
			duty: advanced.duty,
			onceComplete: advanced.onceComplete,
			hasTurned: false
		};
	}

	if (shape === 'tri') {
		const advanced = advanceTimerPwmSweep(
			currentSweepState,
			direction,
			sweepSpeed,
			minDuty,
			maxDuty,
			reverseSweep
		);
		return {
			sweepState: advanced.duty,
			direction: advanced.direction,
			duty: advanced.duty,
			onceComplete: false,
			hasTurned: false
		};
	}

	const advanced = advanceTimerPwmSweepPhase(
		currentSweepState,
		sweepSpeed,
		minDuty,
		maxDuty,
		shape,
		reverseSweep
	);
	return {
		sweepState: advanced.phase,
		direction: 1,
		duty: advanced.duty,
		onceComplete: false,
		hasTurned: false
	};
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
	if (row.sid && row.syncbuzzer) {
		return { ...row, syncbuzzer: false };
	}
	return row;
}

function normalizeTimerRow(row: LegacyTimerRow | undefined): AyTimerRow {
	const defaults = createDefaultAyTimerRow();
	const sid = row?.sid ?? defaults.sid;
	const syncbuzzer = row?.syncbuzzer ?? defaults.syncbuzzer ?? false;
	const fm = row?.fm ?? defaults.fm ?? false;
	const envfm = row?.envfm ?? defaults.envfm ?? false;
	const fmOffsetMode = resolveAyFmOffsetMode(row);
	const hasSidOrSync = sid || syncbuzzer;
	const normalized: AyTimerRow = {
		sid,
		syncbuzzer,
		fm,
		envfm,
		fmOffsetMode,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		timerWaveformLoop: row?.timerWaveformLoop ?? defaults.timerWaveformLoop!
	};
	if (hasSidOrSync) {
		normalized.timerWaveform = row?.timerWaveform?.length
			? syncbuzzer && !sid
				? row.timerWaveform.map((value) => value & 0xf).slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
				: row.timerWaveform.map((value) => value & 0xf).slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			: syncbuzzer
				? [...DEFAULT_AY_SYNCBUZZER_WAVEFORM]
				: [...defaults.timerWaveform!];
		if (fm && row?.fmTimerWaveform?.length) {
			normalized.fmTimerWaveform = normalizeFmWaveform(row.fmTimerWaveform, fmOffsetMode);
		}
		if (envfm && row?.envFmTimerWaveform?.length) {
			normalized.envFmTimerWaveform = normalizeEnvFmWaveform(row.envFmTimerWaveform, fmOffsetMode);
		}
	} else if (fm && !envfm) {
		normalized.timerWaveform = row?.timerWaveform?.length
			? normalizeFmWaveform(row.timerWaveform, fmOffsetMode)
			: defaultAyFmWaveform(fmOffsetMode);
	} else if (envfm && !fm) {
		normalized.timerWaveform = row?.timerWaveform?.length
			? normalizeEnvFmWaveform(row.timerWaveform, fmOffsetMode)
			: defaultAyEnvFmWaveform(fmOffsetMode);
	} else if (fm && envfm) {
		normalized.timerWaveform = row?.timerWaveform?.length
			? normalizeFmWaveform(row.timerWaveform, fmOffsetMode)
			: defaultAyFmWaveform(fmOffsetMode);
		if (row?.envFmTimerWaveform?.length) {
			normalized.envFmTimerWaveform = normalizeEnvFmWaveform(row.envFmTimerWaveform, fmOffsetMode);
		}
	} else {
		normalized.timerWaveform = row?.timerWaveform?.length
			? row.timerWaveform.map((value) => value & 0xf).slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			: [...defaults.timerWaveform!];
	}
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

function hasScopedTimerPwmFields(source: Partial<AyInstrumentFields>): boolean {
	return AY_TIMER_PWM_SCOPES.some((scope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return (
			source[names.duty] !== undefined ||
			source[names.sweepMin] !== undefined ||
			source[names.sweep] !== undefined ||
			source[names.sweepShape] !== undefined ||
			source[names.automationTrigger] !== undefined ||
			source[names.reverseSweep] !== undefined
		);
	});
}

function hasScopedTimerPwmSweepShapeFields(source: Partial<AyInstrumentFields>): boolean {
	return AY_TIMER_PWM_SCOPES.some((scope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return source[names.sweepShape] !== undefined;
	});
}

function hasScopedTimerPwmReverseFields(source: Partial<AyInstrumentFields>): boolean {
	return AY_TIMER_PWM_SCOPES.some((scope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return source[names.reverseSweep] !== undefined;
	});
}

type ResolvedInstrumentTimerPwmFields = ReturnType<typeof createDefaultInstrumentTimerPwmFields>;

function expandLegacyTimerPwmFields(
	legacy: AyTimerPwmScopeFields,
	targetScope: AyTimerPwmScope | 'all'
): ResolvedInstrumentTimerPwmFields {
	const defaults = createDefaultInstrumentTimerPwmFields();
	const applyScope = (scope: AyTimerPwmScope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return {
			[names.duty]: legacy.duty,
			[names.sweepMin]: legacy.sweepMin,
			[names.sweep]: legacy.sweep,
			[names.sweepShape]: legacy.sweepShape,
			[names.automationTrigger]: legacy.automationTrigger,
			[names.reverseSweep]: legacy.reverseSweep
		};
	};
	if (targetScope === 'all') {
		return {
			...defaults,
			...applyScope('sidSync'),
			...applyScope('fm'),
			...applyScope('efm')
		};
	}
	return {
		...defaults,
		...applyScope(targetScope)
	};
}

function applyLegacyTimerPwmBehaviorFields(
	pwmFields: ResolvedInstrumentTimerPwmFields,
	extended: ExtendedInstrument
): ResolvedInstrumentTimerPwmFields {
	let result = { ...pwmFields };
	if (extended.timerPwmSweepShape !== undefined && !hasScopedTimerPwmSweepShapeFields(extended)) {
		const legacyShape = normalizeTimerPwmSweepShape(extended.timerPwmSweepShape);
		result = {
			...result,
			timerPwmSidSyncSweepShape: legacyShape,
			timerPwmFmSweepShape: legacyShape,
			timerPwmEfmSweepShape: legacyShape
		};
	}
	if (extended.timerPwmReverseSweep !== undefined && !hasScopedTimerPwmReverseFields(extended)) {
		const reverse = extended.timerPwmReverseSweep === true;
		result = {
			...result,
			timerPwmSidSyncReverseSweep: reverse,
			timerPwmFmReverseSweep: reverse,
			timerPwmEfmReverseSweep: reverse
		};
	}
	return result;
}

function resolveInstrumentTimerPwmFields(
	extended: ExtendedInstrument,
	sourceRows: LegacyTimerRow[]
): ResolvedInstrumentTimerPwmFields {
	let pwmFields: ResolvedInstrumentTimerPwmFields;

	if (hasScopedTimerPwmFields(extended)) {
		pwmFields = normalizeAllInstrumentTimerPwmFields(extended);
	} else if (
		extended.timerPwmDuty !== undefined ||
		extended.timerPwmSweepMin !== undefined ||
		extended.timerPwmSweep !== undefined ||
		extended.timerPwmSweepShape !== undefined ||
		extended.timerPwmReverseSweep !== undefined
	) {
		pwmFields = expandLegacyTimerPwmFields(
			normalizeTimerPwmScopeFields({
				duty: extended.timerPwmDuty,
				sweepMin: extended.timerPwmSweepMin,
				sweep: extended.timerPwmSweep,
				sweepShape: extended.timerPwmSweepShape,
				reverseSweep: extended.timerPwmReverseSweep
			}),
			'all'
		);
	} else {
		const legacyRow = sourceRows.find(
			(row) =>
				row?.timerPwmDuty !== undefined ||
				row?.timerPwmSweepMin !== undefined ||
				row?.timerPwmSweep !== undefined
		);
		if (legacyRow) {
			pwmFields = expandLegacyTimerPwmFields(
				normalizeTimerPwmScopeFields({
					duty: legacyRow.timerPwmDuty,
					sweepMin: legacyRow.timerPwmSweepMin,
					sweep: legacyRow.timerPwmSweep
				}),
				'sidSync'
			);
		} else {
			pwmFields = createDefaultInstrumentTimerPwmFields();
		}
	}

	return applyLegacyTimerPwmBehaviorFields(pwmFields, extended);
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
		...resolveInstrumentTimerPwmFields(extended, sourceRows)
	};
}

export function formatAyTimerWaveform(waveform: readonly number[], asHex: boolean): string {
	return waveform
		.map((value) => (asHex ? (value & 0xf).toString(16).toUpperCase() : String(value & 0xf)))
		.join(' ');
}

export function formatAyEnvFmWaveform(
	waveform: readonly number[],
	asHex: boolean,
	mode: AyFmOffsetMode = 'period'
): string {
	return formatAyFmWaveform(waveform, asHex, mode);
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

export function parseAyEnvFmWaveformPartial(
	text: string,
	asHex: boolean,
	mode: AyFmOffsetMode = 'period'
): number[] | null {
	return parseAyFmWaveformPartial(text, asHex, mode);
}

export function parseAyEnvFmWaveform(
	text: string,
	asHex: boolean,
	mode: AyFmOffsetMode = 'period'
): number[] | null {
	return parseAyFmWaveform(text, asHex, mode);
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
	extended.timerPwmSidSyncDuty = fields.timerPwmSidSyncDuty;
	extended.timerPwmSidSyncSweepMin = fields.timerPwmSidSyncSweepMin;
	extended.timerPwmSidSyncSweep = fields.timerPwmSidSyncSweep;
	extended.timerPwmSidSyncSweepShape = fields.timerPwmSidSyncSweepShape;
	extended.timerPwmSidSyncAutomationTrigger = fields.timerPwmSidSyncAutomationTrigger;
	extended.timerPwmSidSyncReverseSweep = fields.timerPwmSidSyncReverseSweep;
	extended.timerPwmFmDuty = fields.timerPwmFmDuty;
	extended.timerPwmFmSweepMin = fields.timerPwmFmSweepMin;
	extended.timerPwmFmSweep = fields.timerPwmFmSweep;
	extended.timerPwmFmSweepShape = fields.timerPwmFmSweepShape;
	extended.timerPwmFmAutomationTrigger = fields.timerPwmFmAutomationTrigger;
	extended.timerPwmFmReverseSweep = fields.timerPwmFmReverseSweep;
	extended.timerPwmEfmDuty = fields.timerPwmEfmDuty;
	extended.timerPwmEfmSweepMin = fields.timerPwmEfmSweepMin;
	extended.timerPwmEfmSweep = fields.timerPwmEfmSweep;
	extended.timerPwmEfmSweepShape = fields.timerPwmEfmSweepShape;
	extended.timerPwmEfmAutomationTrigger = fields.timerPwmEfmAutomationTrigger;
	extended.timerPwmEfmReverseSweep = fields.timerPwmEfmReverseSweep;
	delete extended.timerPwmDuty;
	delete extended.timerPwmSweepMin;
	delete extended.timerPwmSweep;
	delete extended.timerPwmSweepShape;
	delete extended.timerPwmReverseSweep;
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
			timerWaveform: row.timerWaveform ? [...row.timerWaveform] : undefined,
			fmTimerWaveform: row.fmTimerWaveform ? [...row.fmTimerWaveform] : undefined,
			envFmTimerWaveform: row.envFmTimerWaveform ? [...row.envFmTimerWaveform] : undefined
		}));
	}
	target.timerPwmSidSyncDuty = normalized.timerPwmSidSyncDuty;
	target.timerPwmSidSyncSweepMin = normalized.timerPwmSidSyncSweepMin;
	target.timerPwmSidSyncSweep = normalized.timerPwmSidSyncSweep;
	target.timerPwmSidSyncSweepShape = normalized.timerPwmSidSyncSweepShape;
	target.timerPwmSidSyncAutomationTrigger = normalized.timerPwmSidSyncAutomationTrigger;
	target.timerPwmSidSyncReverseSweep = normalized.timerPwmSidSyncReverseSweep;
	target.timerPwmFmDuty = normalized.timerPwmFmDuty;
	target.timerPwmFmSweepMin = normalized.timerPwmFmSweepMin;
	target.timerPwmFmSweep = normalized.timerPwmFmSweep;
	target.timerPwmFmSweepShape = normalized.timerPwmFmSweepShape;
	target.timerPwmFmAutomationTrigger = normalized.timerPwmFmAutomationTrigger;
	target.timerPwmFmReverseSweep = normalized.timerPwmFmReverseSweep;
	target.timerPwmEfmDuty = normalized.timerPwmEfmDuty;
	target.timerPwmEfmSweepMin = normalized.timerPwmEfmSweepMin;
	target.timerPwmEfmSweep = normalized.timerPwmEfmSweep;
	target.timerPwmEfmSweepShape = normalized.timerPwmEfmSweepShape;
	target.timerPwmEfmAutomationTrigger = normalized.timerPwmEfmAutomationTrigger;
	target.timerPwmEfmReverseSweep = normalized.timerPwmEfmReverseSweep;
	const legacyTarget = target as ExtendedInstrument;
	delete legacyTarget.timerPwmDuty;
	delete legacyTarget.timerPwmSweepMin;
	delete legacyTarget.timerPwmSweep;
	delete legacyTarget.timerPwmSweepShape;
	delete legacyTarget.timerPwmReverseSweep;
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
