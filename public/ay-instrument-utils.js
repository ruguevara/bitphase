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
export const DEFAULT_AY_TIMER_PWM_DUTY = 50;
export const DEFAULT_AY_TIMER_PWM_SWEEP_MIN = 0;
export const DEFAULT_AY_TIMER_PWM_SWEEP = 0;
export const DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE = 'tri';
export const AY_TIMER_PWM_SWEEP_PHASE_PERIOD = 1000;
export const TIMER_PWM_SWEEP_UNINITIALIZED = -1;
export const DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ = 50;

export function effectiveTimerPwmSweepPerInterrupt(sweepSpeed, intFrequency) {
	const hz =
		intFrequency > 0 ? intFrequency : DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ;
	return (sweepSpeed * DEFAULT_AY_TIMER_PWM_INTERRUPT_REFERENCE_HZ) / hz;
}
export const AY_TIMER_PWM_SWEEP_SHAPES = [
	'tri',
	'sin',
	'rampdn',
	'ramup',
	'expdn',
	'expup',
	'square'
];
export const AY_TIMER_PWM_AUTOMATION_TRIGGERS = ['once', 'free', 'retrigger'];
export const DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER = 'retrigger';
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

export function resolveAyTimerRowSidPeriodMode(row) {
	return row?.sidPeriodMode === 'manual' ? 'manual' : 'auto';
}

export function effectiveRowToneDetune(row) {
	return row?.semitone ?? DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE;
}

export function effectiveRowDetune(row) {
	return row?.detune ?? DEFAULT_AY_SID_PERIOD_DETUNE;
}

export function effectiveRowPeriod(row) {
	return Math.max(1, (row?.period ?? DEFAULT_AY_SID_PERIOD) & 0xffff);
}

export function computeTimerEffectPeriod(tonePeriod, timerRow) {
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

export function computeSidPeriod(tonePeriod, timerRow) {
	return computeTimerEffectPeriod(tonePeriod, timerRow);
}

export function clampTimerPwmDuty(duty) {
	return Math.max(AY_TIMER_PWM_DUTY_MIN, Math.min(AY_TIMER_PWM_DUTY_MAX, duty | 0));
}

export function clampTimerPwmSweep(sweep) {
	return Math.max(0, Math.min(AY_TIMER_PWM_DUTY_MAX, sweep | 0));
}

export function computeTimerPwmPeriods(basePeriod, dutyPercent) {
	const duty = clampTimerPwmDuty(dutyPercent) / 100;
	const cyclePeriod = Math.max(2, basePeriod * 2);
	const highPeriod = Math.max(1, Math.round(cyclePeriod * duty));
	const lowPeriod = Math.max(1, Math.round(cyclePeriod * (1 - duty)));
	return { highPeriod, lowPeriod };
}

export function computeTimerPwmLowPeriod(basePeriod, dutyPercent) {
	return computeTimerPwmPeriods(basePeriod, dutyPercent).lowPeriod;
}

export function effectiveRowTimerWaveform(row) {
	const waveform = row?.timerWaveform;
	if (waveform && waveform.length > 0) {
		return waveform;
	}
	return [...DEFAULT_AY_TIMER_WAVEFORM];
}

export function effectiveRowTimerWaveformLoop(row) {
	return row?.timerWaveformLoop ?? 0;
}

export function resolveAyFmOffsetMode(row) {
	return row?.fmOffsetMode === 'period' ? 'period' : 'semitone';
}

export function defaultAyFmWaveform(mode) {
	return mode === 'period' ? [...DEFAULT_AY_FM_PERIOD_WAVEFORM] : [...DEFAULT_AY_FM_WAVEFORM];
}

export function clampFmSemitone(value) {
	return Math.max(AY_FM_SEMITONE_MIN, Math.min(AY_FM_SEMITONE_MAX, value | 0));
}

export function clampFmPeriodOffset(value) {
	return Math.max(AY_FM_PERIOD_OFFSET_MIN, Math.min(AY_FM_PERIOD_OFFSET_MAX, value | 0));
}

export function clampFmWaveformValue(value, mode) {
	return mode === 'period' ? clampFmPeriodOffset(value) : clampFmSemitone(value);
}

export function normalizeFmWaveform(waveform, mode = 'semitone') {
	return waveform.map((value) => clampFmWaveformValue(value, mode)).slice(0, 32);
}

export function defaultAyEnvFmWaveform(mode) {
	return mode === 'period' ? [...DEFAULT_AY_ENV_FM_WAVEFORM] : [...DEFAULT_AY_FM_WAVEFORM];
}

export function normalizeEnvFmWaveform(waveform, mode = 'period') {
	return normalizeFmWaveform(waveform, mode);
}

export function rowHasSidOrSyncbuzzer(row) {
	return !!(row?.sid || row?.syncbuzzer);
}

export function rowTimerPwmReferenceWaveform(row) {
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

export function effectiveRowEnvFmWaveform(row) {
	if (!row?.envfm) {
		return defaultAyEnvFmWaveform('period');
	}
	const mode = resolveAyFmOffsetMode(row);
	if (rowHasSidOrSyncbuzzer(row) || row.fm) {
		const waveform = row?.envFmTimerWaveform;
		if (waveform && waveform.length > 0) {
			return normalizeEnvFmWaveform(waveform, mode);
		}
		return defaultAyEnvFmWaveform(mode);
	}
	const waveform = row?.timerWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeEnvFmWaveform(waveform, mode);
	}
	return defaultAyEnvFmWaveform(mode);
}

export function effectiveRowFmWaveform(row) {
	if (!row?.fm) {
		return [...DEFAULT_AY_FM_WAVEFORM];
	}
	const mode = resolveAyFmOffsetMode(row);
	if (rowHasSidOrSyncbuzzer(row)) {
		const waveform = row?.fmTimerWaveform;
		if (waveform && waveform.length > 0) {
			return normalizeFmWaveform(waveform, mode);
		}
		return defaultAyFmWaveform(mode);
	}
	const waveform = row?.timerWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeFmWaveform(waveform, mode);
	}
	return defaultAyFmWaveform(mode);
}

export function isDefaultFmTimerWaveform(waveform) {
	return (
		waveform.length === DEFAULT_AY_FM_WAVEFORM.length &&
		waveform.every(
			(value, index) => clampFmSemitone(value) === clampFmSemitone(DEFAULT_AY_FM_WAVEFORM[index])
		)
	);
}

export function isDefaultSidTimerWaveform(waveform) {
	return (
		waveform.length === DEFAULT_AY_TIMER_WAVEFORM.length &&
		waveform.every((value, index) => (value & 0xf) === (DEFAULT_AY_TIMER_WAVEFORM[index] & 0xf))
	);
}

export function isClassicSidTimerWaveform(waveform) {
	return waveform.length === 2 && (waveform[0] & 0xf) === 15 && (waveform[1] & 0xf) === 0;
}

export function isPatternEnvelopeShapeSet(envelopeShape) {
	return envelopeShape !== 0 && envelopeShape !== 15;
}

export function resolveSyncbuzzerWaveform(timerRow, patternEnvelopeShape) {
	const steps = effectiveRowTimerWaveform(timerRow).map((value) => value & 0xf);
	if (!isPatternEnvelopeShapeSet(patternEnvelopeShape)) {
		return steps;
	}
	const patternShape = patternEnvelopeShape & 0xf;
	return steps.map((step) => (step === 0 ? patternShape : step));
}

export const AY_TIMER_PWM_SCOPES = ['sidSync', 'fm', 'efm'];

const TIMER_PWM_SCOPE_FIELD_NAMES = {
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

export function rowScopeSupportsTimerPwm(row, scope) {
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

export function rowSupportsTimerPwm(row) {
	return AY_TIMER_PWM_SCOPES.some((scope) => rowScopeSupportsTimerPwm(row, scope));
}

export function rowUsesSyncbuzzerPwmDuty(row) {
	return !!row?.syncbuzzer && rowScopeSupportsTimerPwm(row, 'sidSync');
}

export function instrumentScopeSupportsTimerPwm(fields, scope) {
	return fields.timerRows.some((row) => rowScopeSupportsTimerPwm(row, scope));
}

export function instrumentSupportsTimerPwm(fields) {
	return AY_TIMER_PWM_SCOPES.some((scope) => instrumentScopeSupportsTimerPwm(fields, scope));
}

export function resolveRowPrimaryTimerPwmScope(options) {
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

export function timerPwmFieldsForScope(fields, scope) {
	const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
	return {
		duty: fields[names.duty],
		sweepMin: fields[names.sweepMin],
		sweep: fields[names.sweep],
		sweepShape: fields[names.sweepShape],
		automationTrigger: fields[names.automationTrigger],
		reverseSweep: fields[names.reverseSweep]
	};
}

export function effectiveScopeTimerPwmDuty(fields, scope) {
	return timerPwmFieldsForScope(fields, scope).duty;
}

export function effectiveScopeTimerPwmSweep(fields, scope) {
	return timerPwmFieldsForScope(fields, scope).sweep;
}

export function effectiveScopeTimerPwmSweepMin(fields, scope) {
	return timerPwmFieldsForScope(fields, scope).sweepMin;
}

export function effectiveScopeTimerPwmSweepShape(fields, scope) {
	return normalizeTimerPwmSweepShape(timerPwmFieldsForScope(fields, scope).sweepShape);
}

export function normalizeTimerPwmAutomationTrigger(value) {
	if (value === 'once' || value === 'free' || value === 'retrigger') {
		return value;
	}
	return DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER;
}

export function shouldResetTimerPwmScopeOnNewNote(trigger) {
	return trigger !== 'free';
}

export function effectiveScopeTimerPwmAutomationTrigger(fields, scope) {
	return normalizeTimerPwmAutomationTrigger(timerPwmFieldsForScope(fields, scope).automationTrigger);
}

export function effectiveScopeTimerPwmReverseSweep(fields, scope) {
	return timerPwmFieldsForScope(fields, scope).reverseSweep === true;
}

export function effectiveRowTimerPwmDuty(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_DUTY;
	}
	return effectiveScopeTimerPwmDuty(fields, scope);
}

export function effectiveRowTimerPwmSweep(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP;
	}
	return effectiveScopeTimerPwmSweep(fields, scope);
}

export function effectiveRowTimerPwmSweepMin(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_MIN;
	}
	return effectiveScopeTimerPwmSweepMin(fields, scope);
}

export function effectiveRowTimerPwmSweepShape(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE;
	}
	return effectiveScopeTimerPwmSweepShape(fields, scope);
}

export function effectiveRowTimerPwmReverseSweep(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return false;
	}
	return effectiveScopeTimerPwmReverseSweep(fields, scope);
}

export function effectiveRowTimerPwmAutomationTrigger(fields, row, scope) {
	if (!rowScopeSupportsTimerPwm(row, scope)) {
		return DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER;
	}
	return effectiveScopeTimerPwmAutomationTrigger(fields, scope);
}

export function clampTimerPwmSweepMin(min, maxDuty) {
	const clampedMax = clampTimerPwmDuty(maxDuty);
	return Math.max(AY_TIMER_PWM_DUTY_MIN, Math.min(clampedMax, min | 0));
}

export function advanceTimerPwmSweep(
	currentDuty,
	direction,
	sweepSpeed,
	minDuty,
	maxDuty,
	reverseSweep = false
) {
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
	currentDuty,
	direction,
	sweepSpeed,
	minDuty,
	maxDuty,
	reverseSweep = false,
	hasTurned = false,
	onceComplete = false
) {
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

export function normalizeTimerPwmSweepShape(value) {
	if (typeof value === 'string') {
		if (AY_TIMER_PWM_SWEEP_SHAPES.includes(value)) {
			return value;
		}
		if (value === 'rampup') {
			return 'ramup';
		}
	}
	return DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE;
}

export function sampleTimerPwmSweepShape(shape, phase) {
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
		default:
			return t < 0.5 ? t * 2 : 2 - t * 2;
	}
}

export function advanceTimerPwmSweepPhase(
	currentPhase,
	sweepSpeed,
	minDuty,
	maxDuty,
	shape,
	reverseSweep = false
) {
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
	currentPhase,
	sweepSpeed,
	minDuty,
	maxDuty,
	shape,
	reverseSweep = false,
	onceComplete = false
) {
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

	const computeDuty = (samplePhase) => {
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
	currentSweepState,
	direction,
	sweepSpeed,
	minDuty,
	maxDuty,
	shape,
	reverseSweep = false,
	automationTrigger = DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER,
	onceComplete = false,
	hasTurned = false
) {
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

function createDefaultTimerPwmScopeFields() {
	return {
		duty: DEFAULT_AY_TIMER_PWM_DUTY,
		sweepMin: DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		sweep: DEFAULT_AY_TIMER_PWM_SWEEP,
		sweepShape: DEFAULT_AY_TIMER_PWM_SWEEP_SHAPE,
		automationTrigger: DEFAULT_AY_TIMER_PWM_AUTOMATION_TRIGGER,
		reverseSweep: false
	};
}

function createDefaultInstrumentTimerPwmFields() {
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

function normalizeTimerPwmScopeFields(source) {
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

function normalizeInstrumentTimerPwmScopeFields(source, scope) {
	const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
	return normalizeTimerPwmScopeFields({
		duty: source[names.duty],
		sweepMin: source[names.sweepMin],
		sweep: source[names.sweep],
		sweepShape: source[names.sweepShape],
		automationTrigger: source[names.automationTrigger],
		reverseSweep: source[names.reverseSweep]
	});
}

function normalizeAllInstrumentTimerPwmFields(source) {
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

function hasScopedTimerPwmFields(source) {
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

function hasScopedTimerPwmSweepShapeFields(source) {
	return AY_TIMER_PWM_SCOPES.some((scope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return source[names.sweepShape] !== undefined;
	});
}

function hasScopedTimerPwmReverseFields(source) {
	return AY_TIMER_PWM_SCOPES.some((scope) => {
		const names = TIMER_PWM_SCOPE_FIELD_NAMES[scope];
		return source[names.reverseSweep] !== undefined;
	});
}

function expandLegacyTimerPwmFields(legacy, targetScope) {
	const defaults = createDefaultInstrumentTimerPwmFields();
	const applyScope = (scope) => {
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

function createDefaultAyTimerRow() {
	return {
		sid: false,
		syncbuzzer: false,
		fm: false,
		envfm: false,
		timerWaveform: [...DEFAULT_AY_TIMER_WAVEFORM],
		timerWaveformLoop: 0
	};
}

function normalizeTimerRow(row) {
	const defaults = createDefaultAyTimerRow();
	const sid = row?.sid ?? defaults.sid;
	const syncbuzzer = row?.syncbuzzer ?? defaults.syncbuzzer;
	const fm = row?.fm ?? defaults.fm;
	const envfm = row?.envfm ?? defaults.envfm;
	const fmOffsetMode = resolveAyFmOffsetMode(row);
	const hasSidOrSync = sid || syncbuzzer;
	const normalized = {
		sid,
		syncbuzzer,
		fm,
		envfm,
		fmOffsetMode,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		timerWaveformLoop: row?.timerWaveformLoop ?? defaults.timerWaveformLoop
	};
	if (hasSidOrSync) {
		normalized.timerWaveform = row?.timerWaveform?.length
			? row.timerWaveform.map((value) => value & 0xf).slice(0, 32)
			: syncbuzzer
				? [...DEFAULT_AY_SYNCBUZZER_WAVEFORM]
				: [...defaults.timerWaveform];
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
			? row.timerWaveform.map((value) => value & 0xf).slice(0, 32)
			: [...defaults.timerWaveform];
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
	return applyExclusiveTimerEffects(normalized);
}

function applyExclusiveTimerEffects(row) {
	if (row.sid && row.syncbuzzer) {
		return { ...row, syncbuzzer: false };
	}
	return row;
}

function applyLegacyTimerPwmBehaviorFields(pwmFields, instrument) {
	let result = { ...pwmFields };
	if (instrument.timerPwmSweepShape !== undefined && !hasScopedTimerPwmSweepShapeFields(instrument)) {
		const legacyShape = normalizeTimerPwmSweepShape(instrument.timerPwmSweepShape);
		result = {
			...result,
			timerPwmSidSyncSweepShape: legacyShape,
			timerPwmFmSweepShape: legacyShape,
			timerPwmEfmSweepShape: legacyShape
		};
	}
	if (instrument.timerPwmReverseSweep !== undefined && !hasScopedTimerPwmReverseFields(instrument)) {
		const reverse = instrument.timerPwmReverseSweep === true;
		result = {
			...result,
			timerPwmSidSyncReverseSweep: reverse,
			timerPwmFmReverseSweep: reverse,
			timerPwmEfmReverseSweep: reverse
		};
	}
	return result;
}

function resolveInstrumentTimerPwmFields(instrument, sourceRows) {
	let pwmFields;

	if (hasScopedTimerPwmFields(instrument)) {
		pwmFields = normalizeAllInstrumentTimerPwmFields(instrument);
	} else if (
		instrument.timerPwmDuty !== undefined ||
		instrument.timerPwmSweepMin !== undefined ||
		instrument.timerPwmSweep !== undefined ||
		instrument.timerPwmSweepShape !== undefined ||
		instrument.timerPwmReverseSweep !== undefined
	) {
		pwmFields = expandLegacyTimerPwmFields(
			normalizeTimerPwmScopeFields({
				duty: instrument.timerPwmDuty,
				sweepMin: instrument.timerPwmSweepMin,
				sweep: instrument.timerPwmSweep,
				sweepShape: instrument.timerPwmSweepShape,
				reverseSweep: instrument.timerPwmReverseSweep
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

	return applyLegacyTimerPwmBehaviorFields(pwmFields, instrument);
}

export function normalizeAyInstrumentFields(instrument) {
	const rowCount = Math.max(instrument.rows?.length ?? 0, 1);
	const sourceRows = instrument.timerRows ?? [];
	const timerRows = Array.from({ length: rowCount }, (_, index) =>
		normalizeTimerRow(sourceRows[index])
	);

	return {
		timerRows,
		...resolveInstrumentTimerPwmFields(instrument, sourceRows)
	};
}

export function getAySidBaseVolume(finalVolume) {
	return finalVolume & 0x0f;
}
