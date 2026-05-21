import { describe, it, expect } from 'vitest';
import {
	normalizeAyInstrumentFields,
	syncAyInstrumentTimerRows,
	computeSidPeriod,
	resolveAyTimerRowSidPeriodMode,
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
		expect(fields.timerWaveform).toEqual(DEFAULT_AY_TIMER_WAVEFORM);
		expect(fields.timerRows).toHaveLength(1);
		expect(fields.timerRows[0].sid).toBe(false);
		expect(resolveAyTimerRowSidPeriodMode(fields.timerRows[0])).toBe('auto');
	});

	it('migrates legacy instrument-level manual period to timer rows', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { sidPeriodMode?: 'manual'; sidPeriod?: number }).sidPeriodMode =
			'manual';
		(instrument as Instrument & { sidPeriod?: number }).sidPeriod = 42;
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0].sidPeriodMode).toBe('manual');
		expect(fields.timerRows[0].period).toBe(42);
		expect(computeSidPeriod(200, fields.timerRows[0])).toBe(42);
	});

	it('syncs timer rows when mixer rows are added', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		const timerRows = syncAyInstrumentTimerRows(instrument, 3);
		expect(timerRows).toHaveLength(3);
		expect(timerRows.every((row) => row.sid === false)).toBe(true);
	});

	it('computes auto sid period from tone period plus row detune', () => {
		const row = { sid: true, sidPeriodMode: 'auto' as const, detune: 7 };
		expect(computeSidPeriod(200, row)).toBe(207);
		expect(computeSidPeriod(200)).toBe(200 + DEFAULT_AY_SID_PERIOD_DETUNE);
	});

	it('uses manual sid period from the row', () => {
		const row = { sid: true, sidPeriodMode: 'manual' as const, period: 42 };
		expect(computeSidPeriod(200, row)).toBe(42);
	});
});
