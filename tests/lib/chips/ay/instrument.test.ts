import { describe, it, expect } from 'vitest';
import {
	normalizeAyInstrumentFields,
	syncAyInstrumentTimerRows,
	computeSidPeriod,
	computeTimerPwmLowPeriod,
	computeTimerPwmPeriods,
	resolveAyTimerRowSidPeriodMode,
	resolveEnvFmEnvelopePeriodSteps,
	formatAyTimerWaveform,
	formatAyFmWaveform,
	clampFmPeriodOffset,
	parseAyTimerWaveform,
	parseAyFmWaveform,
	parseAyTimerWaveformPartial,
	effectiveRowSidWaveform,
	effectiveTimerPwmDuty,
	effectiveTimerPwmSweep,
	effectiveTimerPwmSweepMin,
	isClassicSidTimerWaveform,
	rowSupportsTimerPwm,
	rowUsesSyncbuzzerPwmDuty,
	resolveSyncbuzzerWaveform,
	instrumentSupportsTimerPwm,
	normalizeAyTimerEffectPwmFields,
	sanitizeTimerPwmPercentInput,
	sanitizeTimerPwmSweepInput,
	advanceTimerPwmSweep,
	TIMER_PWM_SWEEP_UNINITIALIZED,
	AY_AUTO_TIMER_TONE_MULTIPLIER,
	AY_TONE_REGISTER_PRESCALER,
	DEFAULT_AY_SID_PERIOD,
	DEFAULT_AY_SID_PERIOD_DETUNE,
	DEFAULT_AY_TIMER_WAVEFORM,
	DEFAULT_AY_SYNCBUZZER_WAVEFORM,
	DEFAULT_AY_TIMER_PWM_DUTY,
	DEFAULT_AY_TIMER_PWM_SWEEP_MIN,
	DEFAULT_AY_TIMER_PWM_SWEEP,
	createDefaultAyTimerEffectPwmFields
} from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';

describe('ay instrument timer fields', () => {
	it('fills defaults for a plain instrument', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		const fields = normalizeAyInstrumentFields(instrument);
		expect(effectiveRowSidWaveform(fields.timerRows[0])).toEqual(DEFAULT_AY_TIMER_WAVEFORM);
		expect(fields.timerRows).toHaveLength(1);
		expect(fields.timerRows[0].sid).toBe(false);
		expect(resolveAyTimerRowSidPeriodMode(fields.timerRows[0])).toBe('auto');
		expect(fields.sidTimerPwm).toEqual(createDefaultAyTimerEffectPwmFields());
		expect(fields.syncbuzzerTimerPwm).toEqual(createDefaultAyTimerEffectPwmFields());
		expect(fields.fmTimerPwm).toEqual(createDefaultAyTimerEffectPwmFields());
		expect(fields.envFmTimerPwm).toEqual(createDefaultAyTimerEffectPwmFields());
	});

	it('normalizes pwm preserve on new note from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { sidTimerPwm?: { preserveOnNewNote?: boolean } }).sidTimerPwm =
			{ preserveOnNewNote: true };
		expect(normalizeAyInstrumentFields(instrument).sidTimerPwm.preserveOnNewNote).toBe(true);
	});

	it('normalizes reverse pwm sweep from instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { sidTimerPwm?: { reverseSweep?: boolean } }).sidTimerPwm = {
			reverseSweep: true
		};
		expect(normalizeAyInstrumentFields(instrument).sidTimerPwm.reverseSweep).toBe(true);
	});

	it('syncs timer rows when mixer rows are added', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		const timerRows = syncAyInstrumentTimerRows(instrument, 3);
		expect(timerRows).toHaveLength(3);
		expect(timerRows.every((row) => row.sid === false)).toBe(true);
		expect(timerRows.every((row) => effectiveRowSidWaveform(row).length === 2)).toBe(true);
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

	it('allows fm and envFm with sid but keeps sid and syncbuzzer exclusive', () => {
		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & {
			timerRows?: { sid: boolean; syncbuzzer?: boolean; fm?: boolean; envFm?: boolean }[];
		}).timerRows = [{ sid: true, syncbuzzer: true, fm: true, envFm: true }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.sid).toBe(true);
		expect(fields.timerRows[0]?.syncbuzzer).toBe(false);
		expect(fields.timerRows[0]?.fm).toBe(true);
		expect(fields.timerRows[0]?.envFm).toBe(true);
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

	it('resolves env fm envelope period steps from semitones and period offsets', () => {
		const tuningTable = Array.from({ length: 96 }, (_, index) => 1000 + index * 16);
		const baseEnvelopePeriod = Math.round(tuningTable[24]! / 16);
		expect(
			resolveEnvFmEnvelopePeriodSteps(baseEnvelopePeriod, [0, 12], tuningTable, 'semitone')
		).toEqual([
			baseEnvelopePeriod,
			Math.round(tuningTable[36]! / 16)
		]);
		expect(
			resolveEnvFmEnvelopePeriodSteps(baseEnvelopePeriod, [0, 16], tuningTable, 'period')
		).toEqual([baseEnvelopePeriod, baseEnvelopePeriod + 16]);
	});

	it('enables pwm settings for two-step sid, syncbuzzer, or fm waveforms', () => {
		expect(isClassicSidTimerWaveform([15, 0])).toBe(true);
		expect(isClassicSidTimerWaveform([15, 0, 0])).toBe(false);
		expect(isClassicSidTimerWaveform([15, 1])).toBe(false);
		expect(rowSupportsTimerPwm({ sid: false, sidWaveform: [15, 0] }, 'sid')).toBe(false);
		expect(rowSupportsTimerPwm({ sid: true, sidWaveform: [15, 0] }, 'sid')).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, sidWaveform: [15, 14] }, 'sid')).toBe(true);
		expect(rowSupportsTimerPwm({ sid: true, sidWaveform: [15, 14, 13] }, 'sid')).toBe(false);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, syncbuzzerWaveform: [13, 9] }, 'syncbuzzer')).toBe(
			true
		);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, syncbuzzerWaveform: [8] }, 'syncbuzzer')).toBe(
			false
		);
		expect(
			rowSupportsTimerPwm({ syncbuzzer: true, syncbuzzerWaveform: [8, 12, 8] }, 'syncbuzzer')
		).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true, fmWaveform: [0, 12] }, 'fm')).toBe(true);
		expect(rowSupportsTimerPwm({ fm: true, fmWaveform: [0, 1, 0, -1] }, 'fm')).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true }, 'fm')).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, syncbuzzerWaveform: [13, 9] })).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, syncbuzzerWaveform: [8, 12, 8] })).toBe(
			false
		);
	});

	it('resolves syncbuzzer steps with zero placeholders from pattern envelope shape', () => {
		const timerRow = { syncbuzzer: true, syncbuzzerWaveform: [0, 8, 0, 8] };
		expect(resolveSyncbuzzerWaveform(timerRow, 0)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 15)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 12)).toEqual([12, 8, 12, 8]);
		expect(
			resolveSyncbuzzerWaveform({ syncbuzzer: true, syncbuzzerWaveform: [8] }, 12)
		).toEqual([8]);
	});

	it('uses per-effect pwm values for pwm-eligible rows only', () => {
		const fields = normalizeAyInstrumentFields(
			Object.assign(
				new Instrument('01', [
					{ tone: true, volume: 15 },
					{ tone: true, volume: 15 }
				]),
				{
					sidTimerPwm: { duty: 20, sweepMin: 5, sweep: 3 },
					timerRows: [
						{ sid: true, sidWaveform: [15, 0] },
						{ sid: true, sidWaveform: [15, 14, 13] }
					]
				}
			)
		);
		expect(fields.sidTimerPwm.duty).toBe(20);
		expect(effectiveTimerPwmDuty(fields, 'sid', fields.timerRows[0])).toBe(20);
		expect(effectiveTimerPwmSweepMin(fields, 'sid', fields.timerRows[0])).toBe(5);
		expect(effectiveTimerPwmSweep(fields, 'sid', fields.timerRows[0])).toBe(3);
		expect(effectiveTimerPwmDuty(fields, 'sid', fields.timerRows[1])).toBe(
			DEFAULT_AY_TIMER_PWM_DUTY
		);
		expect(instrumentSupportsTimerPwm(fields)).toBe(true);
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
			normalizeAyTimerEffectPwmFields({
				duty: 25,
				sweep: 99
			}).sweep
		).toBe(50);
	});

	it('resets sweep min to zero when sweep is disabled', () => {
		expect(
			normalizeAyTimerEffectPwmFields({
				duty: 25,
				sweepMin: 8,
				sweep: 0
			}).sweepMin
		).toBe(0);
	});

	it('clamps instrument pwm min to max duty', () => {
		expect(
			normalizeAyInstrumentFields(
				Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
					sidTimerPwm: { duty: 20, sweepMin: 30, sweep: 4 }
				})
			).sidTimerPwm.sweepMin
		).toBe(20);
	});

	it('computes pwm periods from duty without changing full cycle length', () => {
		expect(computeTimerPwmPeriods(100, 50)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmPeriods(100, 25)).toEqual({ highPeriod: 50, lowPeriod: 150 });
		expect(computeTimerPwmPeriods(100, 0)).toEqual({ highPeriod: 1, lowPeriod: 200 });
		expect(computeTimerPwmPeriods(100, 88)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmLowPeriod(100, 50)).toBe(100);
		expect(
			normalizeAyInstrumentFields(new Instrument('01', [{ tone: true, volume: 15 }])).sidTimerPwm
				.duty
		).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
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

	it('defaults syncbuzzer waveform independently from sid', () => {
		const fields = normalizeAyInstrumentFields(
			new Instrument('01', [{ tone: true, volume: 15 }])
		);
		expect(fields.timerRows[0]?.syncbuzzerWaveform).toEqual(DEFAULT_AY_SYNCBUZZER_WAVEFORM);
	});
});
