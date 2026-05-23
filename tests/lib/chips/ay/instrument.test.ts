import { describe, it, expect } from 'vitest';
import {
	normalizeAyInstrumentFields,
	syncAyInstrumentTimerRows,
	computeSidPeriod,
	resolveAyTimerRowSidPeriodMode,
	resolveExclusiveTimerEffects,
	formatAyTimerWaveform,
	parseAyTimerWaveform,
	parseAyTimerWaveformPartial,
	AY_AUTO_TIMER_TONE_MULTIPLIER,
	AY_TONE_REGISTER_PRESCALER,
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

	it('computes auto sid period aligned to tone prescaler ratio', () => {
		const row = { sid: true, sidPeriodMode: 'auto' as const, detune: 7 };
		expect(computeSidPeriod(200, row)).toBe(200 + 7);
		expect(computeSidPeriod(200)).toBe(200 + DEFAULT_AY_SID_PERIOD_DETUNE);
	});

	it('targets sixteen times tone hz in auto mode', () => {
		const chipClockHz = 1_773_400;
		const tonePeriod = 664;
		const sidPeriod = computeSidPeriod(tonePeriod);
		const toneHz = chipClockHz / (AY_TONE_REGISTER_PRESCALER * tonePeriod);
		const sidHz = chipClockHz / sidPeriod;
		expect(sidHz / toneHz).toBeCloseTo(AY_AUTO_TIMER_TONE_MULTIPLIER, 1);
	});

	it('uses manual sid period from the row', () => {
		const row = { sid: true, sidPeriodMode: 'manual' as const, period: 42 };
		expect(computeSidPeriod(200, row)).toBe(42);
	});

	it('keeps sid and syncbuzzer mutually exclusive', () => {
		expect(resolveExclusiveTimerEffects({ sid: true, syncbuzzer: true })).toEqual({
			sid: true,
			syncbuzzer: false
		});
		expect(resolveExclusiveTimerEffects({ sid: false, syncbuzzer: true })).toEqual({
			sid: false,
			syncbuzzer: true
		});

		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { timerRows?: { sid: boolean; syncbuzzer: boolean }[] }).timerRows =
			[{ sid: true, syncbuzzer: true }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.sid).toBe(true);
		expect(fields.timerRows[0]?.syncbuzzer).toBe(false);
	});

	it('formats and parses space-separated timer waveform strings', () => {
		expect(formatAyTimerWaveform([15, 0], false)).toBe('15 0');
		expect(formatAyTimerWaveform([15, 0], true)).toBe('F 0');
		expect(parseAyTimerWaveform('15 0', false)).toEqual([15, 0]);
		expect(parseAyTimerWaveform('F 0', true)).toEqual([15, 0]);
		expect(parseAyTimerWaveform('15  0', false)).toEqual([15, 0]);
		expect(parseAyTimerWaveform('16', false)).toBeNull();
		expect(parseAyTimerWaveform('', false)).toBeNull();
	});

	it('parses partial timer waveform strings for live preview', () => {
		expect(parseAyTimerWaveformPartial('15', false)).toEqual([15]);
		expect(parseAyTimerWaveformPartial('15 ', false)).toEqual([15]);
		expect(parseAyTimerWaveformPartial('15 0', false)).toEqual([15, 0]);
		expect(parseAyTimerWaveformPartial('15 1', false)).toEqual([15, 1]);
		expect(parseAyTimerWaveformPartial('15 16', false)).toEqual([15]);
		expect(parseAyTimerWaveform('15 16', false)).toBeNull();
	});
});
