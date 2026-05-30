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

export function isClassicSidTimerWaveform(waveform) {
	return waveform.length === 2 && (waveform[0] & 0xf) === 15 && (waveform[1] & 0xf) === 0;
}

export function rowSupportsTimerPwm(row) {
	if (!row || row.syncbuzzer) {
		return false;
	}
	return isClassicSidTimerWaveform(effectiveRowTimerWaveform(row));
}

export function effectiveRowTimerPwmDuty(fields, row) {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_DUTY;
	}
	return clampTimerPwmDuty(fields.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY);
}

export function effectiveRowTimerPwmSweep(fields, row) {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP;
	}
	return Math.max(0, (fields.timerPwmSweep ?? DEFAULT_AY_TIMER_PWM_SWEEP) | 0);
}

export function effectiveRowTimerPwmSweepMin(fields, row) {
	if (!rowSupportsTimerPwm(row)) {
		return DEFAULT_AY_TIMER_PWM_SWEEP_MIN;
	}
	return clampTimerPwmSweepMin(
		fields.timerPwmSweepMin ?? DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		fields.timerPwmDuty ?? DEFAULT_AY_TIMER_PWM_DUTY
	);
}

export function clampTimerPwmSweepMin(min, maxDuty) {
	const clampedMax = clampTimerPwmDuty(maxDuty);
	return Math.max(AY_TIMER_PWM_DUTY_MIN, Math.min(clampedMax, min | 0));
}

export function advanceTimerPwmSweep(currentDuty, direction, sweepSpeed, minDuty, maxDuty) {
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

function createDefaultInstrumentTimerPwmFields() {
	return {
		timerPwmDuty: DEFAULT_AY_TIMER_PWM_DUTY,
		timerPwmSweepMin: DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
		timerPwmSweep: DEFAULT_AY_TIMER_PWM_SWEEP
	};
}

function normalizeInstrumentTimerPwmFields(source) {
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

function createDefaultAyTimerRow() {
	return {
		sid: false,
		syncbuzzer: false,
		timerWaveform: [...DEFAULT_AY_TIMER_WAVEFORM],
		timerWaveformLoop: 0
	};
}

function normalizeTimerRow(row) {
	const defaults = createDefaultAyTimerRow();
	const normalized = {
		sid: row?.sid ?? defaults.sid,
		syncbuzzer: row?.syncbuzzer ?? defaults.syncbuzzer,
		sidPeriodMode:
			row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
				? row.sidPeriodMode
				: 'auto',
		timerWaveform: row?.timerWaveform?.length
			? row.timerWaveform.map((value) => value & 0xf).slice(0, 32)
			: [...defaults.timerWaveform],
		timerWaveformLoop: row?.timerWaveformLoop ?? defaults.timerWaveformLoop
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
	return applyExclusiveTimerEffects(normalized);
}

function applyExclusiveTimerEffects(row) {
	if (row.sid) {
		return { ...row, syncbuzzer: false };
	}
	if (row.syncbuzzer) {
		return { ...row, sid: false };
	}
	return row;
}

function resolveInstrumentTimerPwmFields(instrument, sourceRows) {
	if (
		instrument.timerPwmDuty !== undefined ||
		instrument.timerPwmSweepMin !== undefined ||
		instrument.timerPwmSweep !== undefined
	) {
		return normalizeInstrumentTimerPwmFields(instrument);
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

export function normalizeAyInstrumentFields(instrument) {
	const rowCount = Math.max(instrument.rows?.length ?? 0, 1);
	const sourceRows = instrument.timerRows ?? [];
	const timerRows = Array.from({ length: rowCount }, (_, index) =>
		normalizeTimerRow(sourceRows[index])
	);

	return {
		timerRows,
		...resolveInstrumentTimerPwmFields(instrument, sourceRows),
		timerPwmPreserveOnNewNote: instrument.timerPwmPreserveOnNewNote === true
	};
}

export function getAySidBaseVolume(finalVolume) {
	return finalVolume & 0x0f;
}
