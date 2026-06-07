import { describe, it, expect } from 'vitest';
import {
	normalizeAyInstrumentFields,
	syncAyInstrumentTimerRows,
	computeSidPeriod,
	computeTimerPwmLowPeriod,
	computeTimerPwmPeriods,
	resolveAyTimerRowSidPeriodMode,
	resolveExclusiveTimerEffects,
	formatAyTimerWaveform,
	formatAyFmWaveform,
	parseAyTimerWaveform,
	parseAyFmWaveform,
	parseAyTimerWaveformPartial,
	effectiveRowTimerWaveform,
	effectiveRowTimerPwmDuty,
	effectiveRowTimerPwmSweep,
	effectiveRowTimerPwmSweepMin,
	effectiveInstrumentTimerPwmDuty,
	isClassicSidTimerWaveform,
	rowSupportsTimerPwm,
	rowUsesSyncbuzzerPwmDuty,
	instrumentSupportsTimerPwm,
	normalizeInstrumentTimerPwmFields,
	sanitizeTimerPwmPercentInput,
	sanitizeTimerPwmSweepInput,
	advanceTimerPwmSweep,
	TIMER_PWM_SWEEP_UNINITIALIZED,
	AY_AUTO_TIMER_TONE_MULTIPLIER,
	AY_TONE_REGISTER_PRESCALER,
	DEFAULT_AY_SID_PERIOD,
	DEFAULT_AY_SID_PERIOD_DETUNE,
	DEFAULT_AY_TIMER_WAVEFORM,
	DEFAULT_AY_TIMER_PWM_DUTY,
	DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
	DEFAULT_AY_TIMER_PWM_SWEEP
} from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';

describe('ay instrument timer fields', () => {
	it('fills defaults for a plain instrument', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		const fields = normalizeAyInstrumentFields(instrument);
		expect(effectiveRowTimerWaveform(fields.timerRows[0])).toEqual(DEFAULT_AY_TIMER_WAVEFORM);
		expect(fields.timerRows).toHaveLength(1);
		expect(fields.timerRows[0].sid).toBe(false);
		expect(resolveAyTimerRowSidPeriodMode(fields.timerRows[0])).toBe('auto');
		expect(fields.timerPwmDuty).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
		expect(fields.timerPwmSweepMin).toBe(DEFAULT_AY_TIMER_PWM_SWEEP_MIN);
		expect(fields.timerPwmSweep).toBe(DEFAULT_AY_TIMER_PWM_SWEEP);
		expect(fields.timerPwmPreserveOnNewNote).toBe(false);
		expect(fields.timerPwmReverseSweep).toBe(false);
	});

	it('normalizes pwm preserve on new note from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { timerPwmPreserveOnNewNote?: boolean }).timerPwmPreserveOnNewNote =
			true;
		expect(normalizeAyInstrumentFields(instrument).timerPwmPreserveOnNewNote).toBe(true);
	});

	it('normalizes reverse pwm sweep from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { timerPwmReverseSweep?: boolean }).timerPwmReverseSweep = true;
		expect(normalizeAyInstrumentFields(instrument).timerPwmReverseSweep).toBe(true);
	});

	it('syncs timer rows when mixer rows are added', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		const timerRows = syncAyInstrumentTimerRows(instrument, 3);
		expect(timerRows).toHaveLength(3);
		expect(timerRows.every((row) => row.sid === false)).toBe(true);
		expect(timerRows.every((row) => effectiveRowTimerWaveform(row).length === 2)).toBe(true);
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

	it('keeps sid, syncbuzzer, and fm mutually exclusive', () => {
		expect(resolveExclusiveTimerEffects({ sid: true, syncbuzzer: true })).toMatchObject({
			sid: true,
			syncbuzzer: false,
			fm: false
		});
		expect(resolveExclusiveTimerEffects({ sid: false, syncbuzzer: true })).toMatchObject({
			sid: false,
			syncbuzzer: true,
			fm: false
		});
		expect(resolveExclusiveTimerEffects({ sid: false, syncbuzzer: false, fm: true })).toMatchObject({
			sid: false,
			syncbuzzer: false,
			fm: true
		});

		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { timerRows?: { sid: boolean; syncbuzzer?: boolean }[] }).timerRows =
			[{ sid: true, syncbuzzer: true }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.sid).toBe(true);
		expect(fields.timerRows[0]?.syncbuzzer).toBe(false);
		expect(fields.timerRows[0]?.fm).toBe(false);
	});

	it('parses and formats fm semitone waveforms', () => {
		expect(parseAyFmWaveform('0 1 0 -1', false)).toEqual([0, 1, 0, -1]);
		expect(formatAyFmWaveform([0, 12, -12], false)).toBe('0 12 -12');
	});

	it('enables pwm settings for two-step sid, syncbuzzer, or fm waveforms', () => {
		expect(isClassicSidTimerWaveform([15, 0])).toBe(true);
		expect(isClassicSidTimerWaveform([15, 0, 0])).toBe(false);
		expect(isClassicSidTimerWaveform([15, 1])).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, timerWaveform: [15, 0] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 0] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 14] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 14, 13] })).toBe(false);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [13, 9] })).toBe(true);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [8] })).toBe(false);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [8, 12, 8] })).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true, timerWaveform: [0, 12] })).toBe(true);
		expect(rowSupportsTimerPwm({ fm: true, timerWaveform: [0, 1, 0, -1] })).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true })).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, timerWaveform: [13, 9] })).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, timerWaveform: [8, 12, 8] })).toBe(false);
	});

	it('uses instrument-level pwm values for pwm-eligible rows only', () => {
		const fields = normalizeAyInstrumentFields(
			Object.assign(
				new Instrument('01', [
					{ tone: true, volume: 15 },
					{ tone: true, volume: 15 }
				]),
				{
					timerPwmDuty: 20,
					timerPwmSweepMin: 5,
					timerPwmSweep: 3,
					timerRows: [
						{ sid: true, timerWaveform: [15, 0] },
						{ sid: true, timerWaveform: [15, 14, 13], timerPwmDuty: 99 }
					]
				}
			)
		);
		expect(fields.timerPwmDuty).toBe(20);
		expect(effectiveRowTimerPwmDuty(fields, fields.timerRows[0])).toBe(20);
		expect(effectiveRowTimerPwmSweepMin(fields, fields.timerRows[0])).toBe(5);
		expect(effectiveRowTimerPwmSweep(fields, fields.timerRows[0])).toBe(3);
		expect(effectiveRowTimerPwmDuty(fields, fields.timerRows[1])).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
		expect(instrumentSupportsTimerPwm(fields)).toBe(true);
	});

	it('migrates legacy per-row pwm values to instrument level', () => {
		const fields = normalizeAyInstrumentFields(
			Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
				timerRows: [{ sid: false, timerPwmDuty: 25, timerPwmSweepMin: 8, timerPwmSweep: 4 }]
			})
		);
		expect(fields.timerPwmDuty).toBe(25);
		expect(fields.timerPwmSweepMin).toBe(8);
		expect(fields.timerPwmSweep).toBe(4);
		expect(fields.timerRows[0]?.timerPwmDuty).toBeUndefined();
	});

	it('bounces pwm sweep duty between configured min and max', () => {
		let duty = TIMER_PWM_SWEEP_UNINITIALIZED;
		let direction = 1;
		({ duty, direction } = advanceTimerPwmSweep(duty, direction, 5, 5, 25));
		expect(duty).toBe(5);
		expect(direction).toBe(1);

		({ duty, direction } = advanceTimerPwmSweep(duty, direction, 5, 5, 25));
		expect(duty).toBe(10);

		({ duty, direction } = advanceTimerPwmSweep(22, 1, 5, 5, 25));
		expect(duty).toBe(25);
		expect(direction).toBe(-1);

		({ duty, direction } = advanceTimerPwmSweep(7, -1, 5, 5, 25));
		expect(duty).toBe(5);
		expect(direction).toBe(1);

		({ duty, direction } = advanceTimerPwmSweep(duty, direction, 0, 5, 25));
		expect(duty).toBe(25);
	});

	it('starts reverse pwm sweep at max and sweeps down first', () => {
		let duty = TIMER_PWM_SWEEP_UNINITIALIZED;
		let direction = -1;
		({ duty, direction } = advanceTimerPwmSweep(duty, direction, 5, 5, 25, true));
		expect(duty).toBe(25);
		expect(direction).toBe(-1);

		({ duty, direction } = advanceTimerPwmSweep(duty, direction, 5, 5, 25, true));
		expect(duty).toBe(20);
		expect(direction).toBe(-1);

		({ duty, direction } = advanceTimerPwmSweep(7, -1, 5, 5, 25, true));
		expect(duty).toBe(5);
		expect(direction).toBe(1);
	});

	it('sanitizes pwm percent and sweep text inputs', () => {
		expect(sanitizeTimerPwmPercentInput('1230123', 50)).toBe('12');
		expect(sanitizeTimerPwmPercentInput('51', 50)).toBe('50');
		expect(sanitizeTimerPwmPercentInput('5011', 50)).toBe('50');
		expect(sanitizeTimerPwmPercentInput('5', 50)).toBe('5');
		expect(sanitizeTimerPwmSweepInput('500000', 50, false)).toBe('50');
		expect(sanitizeTimerPwmSweepInput('99', 50, false)).toBe('50');
		expect(sanitizeTimerPwmSweepInput('33', 50, true)).toBe('32');
	});

	it('clamps instrument pwm sweep speed to duty max', () => {
		expect(
			normalizeInstrumentTimerPwmFields({
				timerPwmDuty: 25,
				timerPwmSweep: 99
			}).timerPwmSweep
		).toBe(50);
	});

	it('resets sweep min to zero when sweep is disabled', () => {
		expect(
			normalizeInstrumentTimerPwmFields({
				timerPwmDuty: 25,
				timerPwmSweepMin: 8,
				timerPwmSweep: 0
			}).timerPwmSweepMin
		).toBe(0);
	});

	it('clamps instrument pwm min to max duty', () => {
		expect(
			normalizeAyInstrumentFields(
				Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
					timerPwmDuty: 20,
					timerPwmSweepMin: 30,
					timerPwmSweep: 4
				})
			).timerPwmSweepMin
		).toBe(20);
	});

	it('computes pwm periods from duty without changing full cycle length', () => {
		expect(computeTimerPwmPeriods(100, 50)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmPeriods(100, 25)).toEqual({ highPeriod: 50, lowPeriod: 150 });
		expect(computeTimerPwmPeriods(100, 0)).toEqual({ highPeriod: 1, lowPeriod: 200 });
		expect(computeTimerPwmPeriods(100, 88)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmLowPeriod(100, 50)).toBe(100);
		expect(effectiveInstrumentTimerPwmDuty(normalizeAyInstrumentFields(
			new Instrument('01', [{ tone: true, volume: 15 }])
		))).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
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
