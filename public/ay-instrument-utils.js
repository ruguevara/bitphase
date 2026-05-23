export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 1;
export const DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE = 0;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];
export const AY_TONE_REGISTER_PRESCALER = 16;
export const AY_AUTO_TIMER_TONE_MULTIPLIER = 16;

export function resolveLegacyInstrumentDefaults(instrument) {
	const sidPeriodMode =
		instrument.sidPeriodMode === 'auto' || instrument.sidPeriodMode === 'manual'
			? instrument.sidPeriodMode
			: instrument.sidPeriod !== undefined
				? 'manual'
				: 'auto';
	return {
		sidPeriodMode,
		sidPeriod: Math.max(1, (instrument.sidPeriod ?? DEFAULT_AY_SID_PERIOD) & 0xffff),
		sidPeriodDetune: instrument.sidPeriodDetune ?? DEFAULT_AY_SID_PERIOD_DETUNE
	};
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

function normalizeTimerRow(row, legacy) {
	const sid = row?.sid ?? false;
	const syncbuzzer = row?.syncbuzzer ?? false;
	const sidPeriodMode =
		row?.sidPeriodMode === 'auto' || row?.sidPeriodMode === 'manual'
			? row.sidPeriodMode
			: legacy.sidPeriodMode;
	const normalized = { sid, syncbuzzer, sidPeriodMode };
	if (row?.detune !== undefined) {
		normalized.detune = row.detune;
	} else if (legacy.sidPeriodDetune !== DEFAULT_AY_SID_PERIOD_DETUNE) {
		normalized.detune = legacy.sidPeriodDetune;
	}
	if (row?.semitone !== undefined) {
		normalized.semitone = row.semitone;
	}
	if (row?.period !== undefined) {
		normalized.period = Math.max(1, row.period & 0xffff);
	} else if (legacy.sidPeriodMode === 'manual' && legacy.sidPeriod !== DEFAULT_AY_SID_PERIOD) {
		normalized.period = legacy.sidPeriod;
	}
	return applyExclusiveTimerEffects(normalized);
}

function applyExclusiveTimerEffects(row) {
	if (row.sid && row.syncbuzzer) {
		return { ...row, syncbuzzer: false };
	}
	return row;
}

export function normalizeAyInstrumentFields(instrument) {
	const rowCount = Math.max(instrument.rows?.length ?? 0, 1);
	const legacy = resolveLegacyInstrumentDefaults(instrument);
	let timerRows = instrument.timerRows;
	if (!timerRows) {
		timerRows = (instrument.rows ?? []).map(() => ({ sid: false, syncbuzzer: false }));
	}
	timerRows = timerRows.map((row) => normalizeTimerRow(row, legacy));
	while (timerRows.length < rowCount) {
		timerRows.push({ sid: false, syncbuzzer: false });
	}
	if (timerRows.length > rowCount) {
		timerRows.length = rowCount;
	}

	let timerWaveform = instrument.timerWaveform;
	if (!timerWaveform || timerWaveform.length === 0) {
		timerWaveform = [...DEFAULT_AY_TIMER_WAVEFORM];
	}

	const timerWaveformLoop = instrument.timerWaveformLoop ?? 0;

	return {
		timerRows,
		timerWaveform,
		timerWaveformLoop
	};
}

export function getAySidBaseVolume(finalVolume) {
	return finalVolume & 0x0f;
}
