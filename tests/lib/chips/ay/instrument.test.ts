import { describe, it, expect } from 'vitest';
import {
	normalizeAyInstrumentFields,
	syncAyInstrumentTimerRows,
	computeSidPeriod,
	resolveAySidPeriodMode,
	DEFAULT_AY_SID_PERIOD,
	DEFAULT_AY_SID_PERIOD_DETUNE,
	DEFAULT_AY_TIMER_WAVEFORM
} from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';

describe('ay instrument timer fields', () => {
	it('fills defaults for a plain instrument', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.sidPeriodMode).toBe('auto');
		expect(fields.sidPeriod).toBe(DEFAULT_AY_SID_PERIOD);
		expect(fields.sidPeriodDetune).toBe(DEFAULT_AY_SID_PERIOD_DETUNE);
		expect(fields.timerWaveform).toEqual(DEFAULT_AY_TIMER_WAVEFORM);
		expect(fields.timerRows).toHaveLength(1);
		expect(fields.timerRows[0].sid).toBe(false);
	});

	it('uses manual mode when sidPeriod was saved without mode', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { sidPeriod?: number }).sidPeriod = 200;
		expect(resolveAySidPeriodMode(instrument)).toBe('manual');
	});

	it('syncs timer rows when mixer rows are added', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		const timerRows = syncAyInstrumentTimerRows(instrument, 3);
		expect(timerRows).toHaveLength(3);
		expect(timerRows.every((row) => row.sid === false)).toBe(true);
	});

	it('computes auto sid period from tone period plus detune', () => {
		const fields = normalizeAyInstrumentFields(new Instrument('01', []));
		expect(computeSidPeriod(200, fields)).toBe(200 + DEFAULT_AY_SID_PERIOD_DETUNE);
	});

	it('uses manual sid period when mode is manual', () => {
		const instrument = new Instrument('01', []);
		(instrument as Instrument & { sidPeriodMode?: 'manual'; sidPeriod?: number }).sidPeriodMode =
			'manual';
		(instrument as Instrument & { sidPeriod?: number }).sidPeriod = 42;
		const fields = normalizeAyInstrumentFields(instrument);
		expect(computeSidPeriod(200, fields)).toBe(42);
	});
});
