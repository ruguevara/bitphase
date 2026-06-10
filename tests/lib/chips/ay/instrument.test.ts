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
	clampFmPeriodOffset,
	parseAyTimerWaveform,
	parseAyFmWaveform,
	parseAyTimerWaveformPartial,
	effectiveRowTimerWaveform,
	effectiveRowFmWaveform,
	effectiveRowTimerPwmDuty,
	effectiveRowTimerPwmSweep,
	effectiveRowTimerPwmSweepMin,
	effectiveInstrumentTimerPwmDuty,
	isClassicSidTimerWaveform,
	rowSupportsTimerPwm,
	rowUsesSyncbuzzerPwmDuty,
	resolveSyncbuzzerWaveform,
	instrumentSupportsTimerPwm,
	normalizeInstrumentTimerPwmFields,
	sanitizeTimerPwmPercentInput,
	sanitizeTimerPwmSweepInput,
	advanceTimerPwmSweep,
	clampTimerPwmDuty,
	clampTimerPwmSweep,
	AY_TIMER_PWM_DUTY_MAX,
	AY_TIMER_PWM_SWEEP_START_PHASE_PEAK,
	DEFAULT_AY_TIMER_PWM_SWEEP_START_PHASE,
	pwmSweepDutyAtPhase,
	resolveTimerPwmSweepStart,
	resolveTimerPwmSweepStartPhase,
	resolveTimerPwmSweepShape,
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
		expect(fields.timerPwmSweepStartPhase).toBe(DEFAULT_AY_TIMER_PWM_SWEEP_START_PHASE);
	});

	it('normalizes pwm preserve on new note from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { timerPwmPreserveOnNewNote?: boolean }).timerPwmPreserveOnNewNote =
			true;
		expect(normalizeAyInstrumentFields(instrument).timerPwmPreserveOnNewNote).toBe(true);
	});

	it('normalizes pwm sweep start phase from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(
			instrument as Instrument & { timerPwmSweepStartPhase?: number }
		).timerPwmSweepStartPhase = 250;
		expect(normalizeAyInstrumentFields(instrument).timerPwmSweepStartPhase).toBe(250);
	});

	it('migrates legacy reverse pwm sweep to peak start phase', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { timerPwmReverseSweep?: boolean }).timerPwmReverseSweep = true;
		expect(normalizeAyInstrumentFields(instrument).timerPwmSweepStartPhase).toBe(
			AY_TIMER_PWM_SWEEP_START_PHASE_PEAK
		);
	});

	it('syncs timer rows to an explicit row count', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		const timerRows = syncAyInstrumentTimerRows(instrument, 3);
		expect(timerRows).toHaveLength(3);
		expect(timerRows.every((row) => row.sid === false)).toBe(true);
		expect(timerRows.every((row) => effectiveRowTimerWaveform(row).length === 2)).toBe(true);
	});

	it('keeps timer row count independent from mixer rows', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }, { tone: false, volume: 10 }]);
		(instrument as Instrument & { timerRows: { sid: boolean }[]; timerLoop: number }).timerRows = [
			{ sid: true }
		];
		(instrument as Instrument & { timerLoop: number }).timerLoop = 0;
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows).toHaveLength(1);
		expect(fields.timerLoop).toBe(0);
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

	it('keeps sid, syncbuzzer, fm, and envFm mutually exclusive', () => {
		expect(resolveExclusiveTimerEffects({ sid: true, syncbuzzer: true })).toMatchObject({
			sid: true,
			syncbuzzer: false,
			fm: false,
			envFm: false
		});
		expect(resolveExclusiveTimerEffects({ sid: false, syncbuzzer: true })).toMatchObject({
			sid: false,
			syncbuzzer: true,
			fm: false,
			envFm: false
		});
		expect(resolveExclusiveTimerEffects({ sid: false, syncbuzzer: false, fm: true })).toMatchObject({
			sid: false,
			syncbuzzer: false,
			fm: true,
			envFm: false
		});
		expect(
			resolveExclusiveTimerEffects({ sid: false, syncbuzzer: false, fm: false, envFm: true })
		).toMatchObject({
			sid: false,
			syncbuzzer: false,
			fm: false,
			envFm: true
		});
		expect(
			resolveExclusiveTimerEffects({ sid: false, syncbuzzer: false, fm: true, envFm: true })
		).toMatchObject({
			fm: true,
			envFm: false
		});

		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { timerRows?: { sid: boolean; syncbuzzer?: boolean }[] }).timerRows =
			[{ sid: true, syncbuzzer: true }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.sid).toBe(true);
		expect(fields.timerRows[0]?.syncbuzzer).toBe(false);
		expect(fields.timerRows[0]?.fm).toBe(false);
		expect(fields.timerRows[0]?.envFm).toBe(false);
	});

	it('normalizes env fm rows with fm waveform semantics', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(
			instrument as Instrument & {
				timerRows?: { sid: boolean; envFm?: boolean; timerWaveform?: number[] }[];
			}
		).timerRows = [{ sid: false, envFm: true, timerWaveform: [0, 200] }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.envFm).toBe(true);
		expect(fields.timerRows[0]?.timerWaveform).toEqual([0, 128]);
		expect(effectiveRowFmWaveform(fields.timerRows[0])).toEqual([0, 128]);
	});

	it('parses and formats fm semitone waveforms', () => {
		expect(parseAyFmWaveform('0 1 0 -1', false)).toEqual([0, 1, 0, -1]);
		expect(parseAyFmWaveform('-12 0', false)).toEqual([-12, 0]);
		expect(parseAyFmWaveform('-0 0', false)).toBeNull();
		expect(formatAyFmWaveform([0, 12, -12], false)).toBe('0 12 -12');
	});

	it('parses and formats fm period offset waveforms', () => {
		expect(parseAyFmWaveform('0 16 -100', false, 'period')).toEqual([0, 16, -100]);
		expect(formatAyFmWaveform([0, 16, -512], false, 'period')).toBe('0 16 -512');
	});

	it('clamps fm period offsets to hardware range', () => {
		expect(clampFmPeriodOffset(-5000)).toBe(-4095);
		expect(clampFmPeriodOffset(5000)).toBe(4095);
	});

	it('enables pwm settings for two-step sid, syncbuzzer, or fm waveforms', () => {
		expect(isClassicSidTimerWaveform([15, 0])).toBe(true);
		expect(isClassicSidTimerWaveform([15, 0, 0])).toBe(false);
		expect(isClassicSidTimerWaveform([15, 1])).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, timerWaveform: [15, 0] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 0] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 14] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, timerWaveform: [15, 14, 13] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, syncbuzzer: true, timerWaveform: [13, 9] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: false, syncbuzzer: true, timerWaveform: [8] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, syncbuzzer: true, timerWaveform: [8, 12, 8] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, fm: true, timerWaveform: [0, 12] })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: false, fm: true, timerWaveform: [0, 1, 0, -1] })).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, fm: true })).toBe(true);
		expect(rowSupportsTimerPwm({ sid: false, envFm: true, timerWaveform: [0, 12] })).toBe(true);
		expect(
			rowSupportsTimerPwm({ sid: false, envFm: true, timerWaveform: [0, 1, 0, -1] })
		).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, envFm: true })).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ sid: false, syncbuzzer: true, timerWaveform: [13, 9] })).toBe(
			true
		);
		expect(
			rowUsesSyncbuzzerPwmDuty({ sid: false, syncbuzzer: true, timerWaveform: [8, 12, 8] })
		).toBe(false);
	});

	it('resolves syncbuzzer steps with zero placeholders from pattern envelope shape', () => {
		const timerRow = { sid: false, syncbuzzer: true, timerWaveform: [0, 8, 0, 8] };
		expect(resolveSyncbuzzerWaveform(timerRow, 0)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 15)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 12)).toEqual([12, 8, 12, 8]);
		expect(
			resolveSyncbuzzerWaveform({ sid: false, syncbuzzer: true, timerWaveform: [8] }, 12)
		).toEqual([8]);
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
		expect(
			(fields.timerRows[0] as { timerPwmDuty?: number } | undefined)?.timerPwmDuty
		).toBeUndefined();
	});

	it('advances triangle pwm sweep by phase', () => {
		let result = advanceTimerPwmSweep(TIMER_PWM_SWEEP_UNINITIALIZED, 250, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(0);
		expect(result.duty).toBe(0);

		result = advanceTimerPwmSweep(result.phase, 250, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(250);
		expect(result.duty).toBe(50);

		result = advanceTimerPwmSweep(result.phase, 250, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(500);
		expect(result.duty).toBe(100);

		result = advanceTimerPwmSweep(result.phase, 250, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(750);
		expect(result.duty).toBe(50);

		result = advanceTimerPwmSweep(result.phase, 250, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(1000);
		expect(result.duty).toBe(0);

		result = advanceTimerPwmSweep(result.phase, 1, 0, 100, 0, 'triangle');
		expect(result.phase).toBe(0);
		expect(result.duty).toBe(0);
	});

	it('returns max duty when pwm sweep speed is zero', () => {
		const result = advanceTimerPwmSweep(TIMER_PWM_SWEEP_UNINITIALIZED, 0, 5, 25);
		expect(result.duty).toBe(25);
	});

	it('starts pwm sweep from configured start phase', () => {
		const result = advanceTimerPwmSweep(
			TIMER_PWM_SWEEP_UNINITIALIZED,
			10,
			0,
			100,
			AY_TIMER_PWM_SWEEP_START_PHASE_PEAK,
			'triangle'
		);
		expect(result.phase).toBe(AY_TIMER_PWM_SWEEP_START_PHASE_PEAK);
		expect(result.duty).toBe(100);
	});

	it('maps pwm sweep shapes to duty at phase', () => {
		expect(pwmSweepDutyAtPhase(0, 'triangle', 0, 100)).toBe(0);
		expect(pwmSweepDutyAtPhase(500, 'triangle', 0, 100)).toBe(100);
		expect(pwmSweepDutyAtPhase(0, 'sawUp', 0, 100)).toBe(0);
		expect(pwmSweepDutyAtPhase(500, 'sawUp', 0, 100)).toBe(50);
		expect(pwmSweepDutyAtPhase(0, 'sawDown', 0, 100)).toBe(100);
		expect(pwmSweepDutyAtPhase(500, 'sawDown', 0, 100)).toBe(50);
		expect(pwmSweepDutyAtPhase(0, 'square', 0, 100)).toBe(100);
		expect(pwmSweepDutyAtPhase(500, 'square', 0, 100)).toBe(0);
	});

	it('resolves pwm sweep start from phase and shape', () => {
		expect(resolveTimerPwmSweepStart(0, 0, 100)).toEqual({ phase: 0, duty: 0 });
		expect(resolveTimerPwmSweepStart(500, 0, 100)).toEqual({ phase: 500, duty: 100 });
		expect(resolveTimerPwmSweepStart(250, 0, 100)).toEqual({ phase: 250, duty: 50 });
		expect(resolveTimerPwmSweepStart(750, 0, 100)).toEqual({ phase: 750, duty: 50 });
		expect(resolveTimerPwmSweepStartPhase({ timerPwmReverseSweep: true })).toBe(
			AY_TIMER_PWM_SWEEP_START_PHASE_PEAK
		);
		expect(resolveTimerPwmSweepShape('sine')).toBe('sine');
		expect(resolveTimerPwmSweepShape('random')).toBe('triangle');
		expect(resolveTimerPwmSweepShape('invalid')).toBe('triangle');
	});

	it('sanitizes pwm percent and sweep text inputs', () => {
		expect(sanitizeTimerPwmPercentInput('1230123', 100)).toBe('100');
		expect(sanitizeTimerPwmPercentInput('51', 50)).toBe('50');
		expect(sanitizeTimerPwmPercentInput('5011', 50)).toBe('50');
		expect(sanitizeTimerPwmPercentInput('101', 100)).toBe('100');
		expect(sanitizeTimerPwmPercentInput('100', 100)).toBe('100');
		expect(sanitizeTimerPwmPercentInput('5', 100)).toBe('5');
		expect(sanitizeTimerPwmSweepInput('500000', 100, false)).toBe('100');
		expect(sanitizeTimerPwmSweepInput('99', 100, false)).toBe('99');
		expect(sanitizeTimerPwmSweepInput('FF', 100, true)).toBe('64');
	});

	it('clamps pwm duty and sweep at 100', () => {
		expect(AY_TIMER_PWM_DUTY_MAX).toBe(100);
		expect(clampTimerPwmDuty(100)).toBe(100);
		expect(clampTimerPwmDuty(150)).toBe(100);
		expect(clampTimerPwmDuty(-5)).toBe(0);
		expect(clampTimerPwmSweep(100)).toBe(100);
		expect(clampTimerPwmSweep(101)).toBe(100);
	});

	it('clamps instrument pwm sweep speed to duty max', () => {
		expect(
			normalizeInstrumentTimerPwmFields({
				timerPwmDuty: 25,
				timerPwmSweep: 150
			}).timerPwmSweep
		).toBe(100);
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
		expect(computeTimerPwmPeriods(100, 88)).toEqual({ highPeriod: 176, lowPeriod: 24 });
		expect(computeTimerPwmPeriods(100, 100)).toEqual({ highPeriod: 200, lowPeriod: 1 });
		expect(computeTimerPwmPeriods(100, 150)).toEqual({ highPeriod: 200, lowPeriod: 1 });
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
