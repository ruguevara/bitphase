export const DEFAULT_AY_SID_PERIOD = 100;
export const DEFAULT_AY_SID_PERIOD_DETUNE = 3;
export const DEFAULT_AY_TIMER_WAVEFORM = [15, 0];

export function resolveAySidPeriodMode(instrument) {
	if (instrument.sidPeriodMode === 'auto' || instrument.sidPeriodMode === 'manual') {
		return instrument.sidPeriodMode;
	}
	return instrument.sidPeriod !== undefined ? 'manual' : 'auto';
}

export function computeSidPeriod(tonePeriod, fields) {
	if (fields.sidPeriodMode === 'manual') {
		return Math.max(1, fields.sidPeriod & 0xffff);
	}
	if (tonePeriod > 0) {
		const detune = fields.sidPeriodDetune | 0;
		return Math.max(1, ((tonePeriod + detune) & 0xffff) || 1);
	}
	return Math.max(1, fields.sidPeriod & 0xffff);
}

export function normalizeAyInstrumentFields(instrument) {
	const rowCount = Math.max(instrument.rows?.length ?? 0, 1);
	let timerRows = instrument.timerRows;
	if (!timerRows) {
		timerRows = (instrument.rows ?? []).map(() => ({ sid: false }));
	}
	while (timerRows.length < rowCount) {
		timerRows.push({ sid: false });
	}
	if (timerRows.length > rowCount) {
		timerRows.length = rowCount;
	}

	let timerWaveform = instrument.timerWaveform;
	if (!timerWaveform || timerWaveform.length === 0) {
		timerWaveform = [...DEFAULT_AY_TIMER_WAVEFORM];
	}

	const timerWaveformLoop = instrument.timerWaveformLoop ?? 0;
	const sidPeriodMode = resolveAySidPeriodMode(instrument);
	const sidPeriod = instrument.sidPeriod ?? DEFAULT_AY_SID_PERIOD;
	const sidPeriodDetune = instrument.sidPeriodDetune ?? DEFAULT_AY_SID_PERIOD_DETUNE;

	return {
		timerRows,
		timerWaveform,
		timerWaveformLoop,
		sidPeriodMode,
		sidPeriod: Math.max(1, sidPeriod & 0xffff),
		sidPeriodDetune
	};
}

export function getAySidBaseVolume(finalVolume) {
	return finalVolume & 0x0f;
}
