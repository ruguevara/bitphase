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
export const DEFAULT_AY_TIMER_PWM_DUTY = 50;
export const DEFAULT_AY_TIMER_PWM_SWEEP_MIN = 0;
export const DEFAULT_AY_TIMER_PWM_SWEEP = 0;
export const TIMER_PWM_SWEEP_UNINITIALIZED = -1;
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

const TIMER_EFFECT_PWM_FIELD_KEYS = {
	sid: 'sidTimerPwm',
	syncbuzzer: 'syncbuzzerTimerPwm',
	fm: 'fmTimerPwm',
	envFm: 'envFmTimerPwm'
};

export function getTimerEffectPwmFields(fields, effectType) {
	return fields[TIMER_EFFECT_PWM_FIELD_KEYS[effectType]];
}

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

function normalizeNybbleWaveform(waveform, defaultWaveform) {
	if (waveform?.length) {
		return waveform.map((value) => value & 0xf).slice(0, 32);
	}
	return [...defaultWaveform];
}

function isEffectActive(row, effectType) {
	if (!row) {
		return false;
	}
	switch (effectType) {
		case 'sid':
			return row.sid;
		case 'syncbuzzer':
			return row.syncbuzzer === true;
		case 'fm':
			return row.fm === true;
		case 'envFm':
			return row.envFm === true;
	}
	return false;
}

export function effectiveRowSidWaveform(row) {
	return normalizeNybbleWaveform(row?.sidWaveform, DEFAULT_AY_TIMER_WAVEFORM);
}

export function effectiveRowSidWaveformLoop(row) {
	return row?.sidWaveformLoop ?? 0;
}

export function effectiveRowSyncbuzzerWaveform(row) {
	return normalizeNybbleWaveform(row?.syncbuzzerWaveform, DEFAULT_AY_SYNCBUZZER_WAVEFORM);
}

export function effectiveRowSyncbuzzerWaveformLoop(row) {
	return row?.syncbuzzerWaveformLoop ?? 0;
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

export function effectiveRowFmWaveform(row) {
	if (!row?.fm) {
		return [...DEFAULT_AY_FM_WAVEFORM];
	}
	const mode = resolveAyFmOffsetMode(row);
	const waveform = row?.fmWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeFmWaveform(waveform, mode);
	}
	return defaultAyFmWaveform(mode);
}

export function effectiveRowFmWaveformLoop(row) {
	return row?.fmWaveformLoop ?? 0;
}

export function resolveAyEnvFmOffsetMode(row) {
	return row?.envFmOffsetMode === 'period' ? 'period' : 'semitone';
}

export function effectiveRowEnvFmWaveform(row) {
	if (!row?.envFm) {
		return [...DEFAULT_AY_FM_WAVEFORM];
	}
	const mode = resolveAyEnvFmOffsetMode(row);
	const waveform = row?.envFmWaveform;
	if (waveform && waveform.length > 0) {
		return normalizeFmWaveform(waveform, mode);
	}
	return defaultAyFmWaveform(mode);
}

export function effectiveRowEnvFmWaveformLoop(row) {
	return row?.envFmWaveformLoop ?? 0;
}

export function effectiveRowWaveform(row, effectType) {
	switch (effectType) {
		case 'sid':
			return effectiveRowSidWaveform(row);
		case 'syncbuzzer':
			return effectiveRowSyncbuzzerWaveform(row);
		case 'fm':
			return effectiveRowFmWaveform(row);
		case 'envFm':
			return effectiveRowEnvFmWaveform(row);
	}
	return effectiveRowSidWaveform(row);
}

export function effectiveRowWaveformLoop(row, effectType) {
	switch (effectType) {
		case 'sid':
			return effectiveRowSidWaveformLoop(row);
		case 'syncbuzzer':
			return effectiveRowSyncbuzzerWaveformLoop(row);
		case 'fm':
			return effectiveRowFmWaveformLoop(row);
		case 'envFm':
			return effectiveRowEnvFmWaveformLoop(row);
	}
	return 0;
}

export function envelopePeriodToNote(envelopePeriod, tuningTable) {
	if (envelopePeriod === 0) {
		return null;
	}

	let nearestNote = -1;
	let bestDistance = Infinity;

	for (let i = 0; i < tuningTable.length; i++) {
		const noteEnvelopePeriod = Math.round(tuningTable[i] / 16);
		if (noteEnvelopePeriod === envelopePeriod) {
			return i;
		}

		const distance = Math.abs(noteEnvelopePeriod - envelopePeriod);
		if (distance < bestDistance) {
			bestDistance = distance;
			nearestNote = i;
		}
	}

	return nearestNote >= 0 ? nearestNote : null;
}

export function noteToEnvelopePeriod(noteIndex, tuningTable) {
	if (noteIndex < 0 || noteIndex >= tuningTable.length) {
		return 0;
	}
	return Math.round(tuningTable[noteIndex] / 16);
}

export function resolveEnvFmEnvelopePeriodSteps(
	baseEnvelopePeriod,
	steps,
	tuningTable,
	mode
) {
	if (baseEnvelopePeriod <= 0) {
		return steps.map(() => 1);
	}
	if (mode === 'period') {
		return steps.map((offset) => {
			const period = (baseEnvelopePeriod + clampFmPeriodOffset(offset)) & 0xffff;
			return period === 0 ? 1 : period;
		});
	}
	const baseNote = envelopePeriodToNote(baseEnvelopePeriod, tuningTable);
	if (baseNote === null) {
		return steps.map((semitone) => {
			const factor = Math.pow(2, -clampFmSemitone(semitone) / 12);
			const period = Math.round(baseEnvelopePeriod * factor) & 0xffff;
			return period === 0 ? 1 : period;
		});
	}
	const maxNote = tuningTable.length - 1;
	return steps.map((semitone) => {
		const noteIndex = Math.max(0, Math.min(maxNote, baseNote + clampFmSemitone(semitone)));
		const period = noteToEnvelopePeriod(noteIndex, tuningTable) & 0xffff;
		return period === 0 ? 1 : period;
	});
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
	const steps = effectiveRowSyncbuzzerWaveform(timerRow).map((value) => value & 0xf);
	if (!isPatternEnvelopeShapeSet(patternEnvelopeShape)) {
		return steps;
	}
	const patternShape = patternEnvelopeShape & 0xf;
	return steps.map((step) => (step === 0 ? patternShape : step));
}

export function rowSupportsTimerPwm(row, effectType) {
	if (!isEffectActive(row, effectType)) {
		return false;
	}
	return effectiveRowWaveform(row, effectType).length === 2;
}

export function rowUsesSyncbuzzerPwmDuty(row) {
	return rowSupportsTimerPwm(row, 'syncbuzzer');
}

export function normalizeAyTimerEffectPwmFields(source = {}) {
	const duty = clampTimerPwmDuty(source.duty ?? DEFAULT_AY_TIMER_PWM_DUTY);
	const sweep = clampTimerPwmSweep(source.sweep ?? DEFAULT_AY_TIMER_PWM_SWEEP);
	return {
		duty,
		sweepMin:
			sweep <= 0
				? DEFAULT_AY_TIMER_PWM_SWEEP_MIN
				: clampTimerPwmSweepMin(source.sweepMin ?? DEFAULT_AY_TIMER_PWM_SWEEP_MIN, duty),
		sweep,
		preserveOnNewNote: source.preserveOnNewNote === true,
		reverseSweep: source.reverseSweep === true
	};
}

export function effectiveTimerPwmDuty(fields, effectType, row) {
	if (!rowSupportsTimerPwm(row, effectType)) {
		return DEFAULT_AY_TIMER_PWM_DUTY;
	}
	return clampTimerPwmDuty(getTimerEffectPwmFields(fields, effectType).duty);
}

export function effectiveTimerPwmSweep(fields, effectType, row) {
	if (!rowSupportsTimerPwm(row, effectType)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP;
	}
	return clampTimerPwmSweep(getTimerEffectPwmFields(fields, effectType).sweep);
}

export function effectiveTimerPwmSweepMin(fields, effectType, row) {
	if (!rowSupportsTimerPwm(row, effectType)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_MIN;
	}
	const pwm = getTimerEffectPwmFields(fields, effectType);
	return clampTimerPwmSweepMin(pwm.sweepMin, pwm.duty);
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

function createDefaultAyTimerEffectPwmFields() {
	return {
		duty: DEFAULT_AY_TIMER_PWM_DUTY,
		sweepMin: DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		sweep: DEFAULT_AY_TIMER_PWM_SWEEP,
		preserveOnNewNote: false,
		reverseSweep: false
	};
}

function createDefaultAyTimerRow() {
	return {
		sid: false,
		syncbuzzer: false,
		fm: false,
		envFm: false,
		sidWaveform: [...DEFAULT_AY_TIMER_WAVEFORM],
		sidWaveformLoop: 0,
		syncbuzzerWaveform: [...DEFAULT_AY_SYNCBUZZER_WAVEFORM],
		syncbuzzerWaveformLoop: 0,
		fmWaveform: [...DEFAULT_AY_FM_WAVEFORM],
		fmWaveformLoop: 0,
		envFmWaveform: [...DEFAULT_AY_FM_WAVEFORM],
		envFmWaveformLoop: 0
	};
}

export function resolveSidSyncbuzzerExclusiveRow(row) {
	if (row.sid && row.syncbuzzer) {
		return { ...row, syncbuzzer: false };
	}
	return row;
}

function normalizeTimerRow(row) {
	const defaults = createDefaultAyTimerRow();
	const fmOffsetMode = resolveAyFmOffsetMode(row);
	const envFmOffsetMode = resolveAyEnvFmOffsetMode(row);
	const normalized = {
		sid: row?.sid ?? defaults.sid,
		syncbuzzer: row?.syncbuzzer ?? defaults.syncbuzzer,
		fm: row?.fm ?? defaults.fm,
		envFm: row?.envFm ?? defaults.envFm,
		fmOffsetMode,
		envFmOffsetMode,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		sidWaveform: normalizeNybbleWaveform(row?.sidWaveform, DEFAULT_AY_TIMER_WAVEFORM),
		sidWaveformLoop: row?.sidWaveformLoop ?? defaults.sidWaveformLoop,
		syncbuzzerWaveform: normalizeNybbleWaveform(
			row?.syncbuzzerWaveform,
			DEFAULT_AY_SYNCBUZZER_WAVEFORM
		),
		syncbuzzerWaveformLoop: row?.syncbuzzerWaveformLoop ?? defaults.syncbuzzerWaveformLoop,
		fmWaveform: row?.fmWaveform?.length
			? normalizeFmWaveform(row.fmWaveform, fmOffsetMode)
			: defaultAyFmWaveform(fmOffsetMode),
		fmWaveformLoop: row?.fmWaveformLoop ?? defaults.fmWaveformLoop,
		envFmWaveform: row?.envFmWaveform?.length
			? normalizeFmWaveform(row.envFmWaveform, envFmOffsetMode)
			: defaultAyFmWaveform(envFmOffsetMode),
		envFmWaveformLoop: row?.envFmWaveformLoop ?? defaults.envFmWaveformLoop
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
	if (envFmOffsetMode === 'period') {
		normalized.envFmOffsetMode = 'period';
	}
	return resolveSidSyncbuzzerExclusiveRow(normalized);
}

export function normalizeAyInstrumentFields(instrument) {
	const rowCount = Math.max(instrument.rows?.length ?? 0, 1);
	const sourceRows = instrument.timerRows ?? [];
	const timerRows = Array.from({ length: rowCount }, (_, index) =>
		normalizeTimerRow(sourceRows[index])
	);

	return {
		timerRows,
		sidTimerPwm: normalizeAyTimerEffectPwmFields(instrument.sidTimerPwm),
		syncbuzzerTimerPwm: normalizeAyTimerEffectPwmFields(instrument.syncbuzzerTimerPwm),
		fmTimerPwm: normalizeAyTimerEffectPwmFields(instrument.fmTimerPwm),
		envFmTimerPwm: normalizeAyTimerEffectPwmFields(instrument.envFmTimerPwm)
	};
}

export function getAySidBaseVolume(finalVolume) {
	return finalVolume & 0x0f;
}
