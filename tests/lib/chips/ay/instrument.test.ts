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
	parseAyEnvFmWaveform,
	formatAyEnvFmWaveform,
	defaultAyEnvFmWaveform,
	parseAyTimerWaveformPartial,
	effectiveRowTimerWaveform,
	effectiveRowTimerPwmDuty,
	effectiveRowTimerPwmSweep,
	effectiveRowTimerPwmSweepMin,
	effectiveScopeTimerPwmDuty,
	isClassicSidTimerWaveform,
	rowScopeSupportsTimerPwm,
	rowSupportsTimerPwm,
	rowUsesSyncbuzzerPwmDuty,
	resolveSyncbuzzerWaveform,
	instrumentSupportsTimerPwm,
	instrumentScopeSupportsTimerPwm,
	normalizeTimerPwmScopeFields,
	normalizeInstrumentTimerPwmScopeFields,
	sanitizeTimerPwmPercentInput,
	sanitizeTimerPwmSweepInput,
	advanceTimerPwmSweep,
	advanceTimerPwmSweepWithShape,
	effectiveTimerPwmSweepPerInterrupt,
	normalizeTimerPwmSweepShape,
	sampleTimerPwmSweepShape,
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
		expect(fields.timerPwmSidSyncDuty).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
		expect(fields.timerPwmSidSyncSweepMin).toBe(DEFAULT_AY_TIMER_PWM_SWEEP_MIN);
		expect(fields.timerPwmSidSyncSweep).toBe(DEFAULT_AY_TIMER_PWM_SWEEP);
		expect(fields.timerPwmFmDuty).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
		expect(fields.timerPwmEfmDuty).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
		expect(fields.timerPwmSidSyncAutomationTrigger).toBe('retrigger');
		expect(fields.timerPwmSidSyncReverseSweep).toBe(false);
		expect(fields.timerPwmFmAutomationTrigger).toBe('retrigger');
		expect(fields.timerPwmFmReverseSweep).toBe(false);
		expect(fields.timerPwmEfmAutomationTrigger).toBe('retrigger');
		expect(fields.timerPwmEfmReverseSweep).toBe(false);
		expect(fields.timerPwmSidSyncSweepShape).toBe('tri');
		expect(fields.timerPwmFmSweepShape).toBe('tri');
		expect(fields.timerPwmEfmSweepShape).toBe('tri');
	});

	it('normalizes scoped pwm automation trigger independently', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(
			instrument as Instrument & {
				timerPwmSidSyncAutomationTrigger?: string;
				timerPwmFmReverseSweep?: boolean;
			}
		).timerPwmSidSyncAutomationTrigger = 'free';
		(instrument as Instrument & { timerPwmFmReverseSweep?: boolean }).timerPwmFmReverseSweep =
			true;
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerPwmSidSyncAutomationTrigger).toBe('free');
		expect(fields.timerPwmFmAutomationTrigger).toBe('retrigger');
		expect(fields.timerPwmFmReverseSweep).toBe(true);
		expect(fields.timerPwmSidSyncReverseSweep).toBe(false);
	});

	it('normalizes reverse pwm sweep from legacy instrument data', () => {
		const instrument = new Instrument('01', [
			{ tone: true, noise: false, envelope: false, volume: 15 }
		]);
		(instrument as Instrument & { timerPwmReverseSweep?: boolean }).timerPwmReverseSweep = true;
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerPwmSidSyncReverseSweep).toBe(true);
		expect(fields.timerPwmFmReverseSweep).toBe(true);
		expect(fields.timerPwmEfmReverseSweep).toBe(true);
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

	it('keeps sid and syncbuzzer mutually exclusive but allows fm and envfm combinations', () => {
		expect(resolveExclusiveTimerEffects({ sid: true, syncbuzzer: true })).toMatchObject({
			sid: true,
			syncbuzzer: false
		});
		expect(resolveExclusiveTimerEffects({ sid: true, fm: true, envfm: true })).toMatchObject({
			sid: true,
			fm: true,
			envfm: true
		});
		expect(resolveExclusiveTimerEffects({ syncbuzzer: true, fm: true })).toMatchObject({
			syncbuzzer: true,
			fm: true
		});

		const instrument = new Instrument('01', [{ tone: true, volume: 15 }]);
		(instrument as Instrument & { timerRows?: { sid: boolean; syncbuzzer?: boolean; fm?: boolean }[] }).timerRows =
			[{ sid: true, syncbuzzer: true, fm: true }];
		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.sid).toBe(true);
		expect(fields.timerRows[0]?.syncbuzzer).toBe(false);
		expect(fields.timerRows[0]?.fm).toBe(true);
	});

	it('parses and formats env fm offset waveforms', () => {
		expect(parseAyEnvFmWaveform('-1 1', false)).toEqual([-1, 1]);
		expect(parseAyEnvFmWaveform('0 7', false, 'semitone')).toEqual([0, 7]);
		expect(formatAyEnvFmWaveform([-1, 1], false)).toBe('-1 1');
		expect(defaultAyEnvFmWaveform('semitone')).toEqual([0, 7]);
		expect(clampFmPeriodOffset(-5000)).toBe(-4095);
		expect(clampFmPeriodOffset(5000)).toBe(4095);
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
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [13, 9] })).toBe(true);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [8] })).toBe(false);
		expect(rowSupportsTimerPwm({ syncbuzzer: true, timerWaveform: [8, 12, 8] })).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true, timerWaveform: [0, 12] })).toBe(true);
		expect(rowSupportsTimerPwm({ fm: true, timerWaveform: [0, 1, 0, -1] })).toBe(false);
		expect(rowSupportsTimerPwm({ fm: true })).toBe(true);
		expect(rowSupportsTimerPwm({ envfm: true, timerWaveform: [-1, 1] })).toBe(true);
		expect(rowSupportsTimerPwm({ envfm: true, timerWaveform: [-1, 1, 1] })).toBe(false);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, timerWaveform: [13, 9] })).toBe(true);
		expect(rowUsesSyncbuzzerPwmDuty({ syncbuzzer: true, timerWaveform: [8, 12, 8] })).toBe(false);
	});

	it('resolves syncbuzzer steps with zero placeholders from pattern envelope shape', () => {
		const timerRow = { syncbuzzer: true, timerWaveform: [0, 8, 0, 8] };
		expect(resolveSyncbuzzerWaveform(timerRow, 0)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 15)).toEqual([0, 8, 0, 8]);
		expect(resolveSyncbuzzerWaveform(timerRow, 12)).toEqual([12, 8, 12, 8]);
		expect(resolveSyncbuzzerWaveform({ syncbuzzer: true, timerWaveform: [8] }, 12)).toEqual([8]);
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
		expect(fields.timerPwmSidSyncDuty).toBe(20);
		expect(fields.timerPwmFmDuty).toBe(20);
		expect(effectiveRowTimerPwmDuty(fields, fields.timerRows[0], 'sidSync')).toBe(20);
		expect(effectiveRowTimerPwmSweepMin(fields, fields.timerRows[0], 'sidSync')).toBe(5);
		expect(effectiveRowTimerPwmSweep(fields, fields.timerRows[0], 'sidSync')).toBe(3);
		expect(effectiveRowTimerPwmDuty(fields, fields.timerRows[1], 'sidSync')).toBe(
			DEFAULT_AY_TIMER_PWM_DUTY
		);
		expect(instrumentSupportsTimerPwm(fields)).toBe(true);
	});

	it('migrates legacy per-row pwm values to sid/sync scope', () => {
		const fields = normalizeAyInstrumentFields(
			Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
				timerRows: [{ sid: false, timerPwmDuty: 25, timerPwmSweepMin: 8, timerPwmSweep: 4 }]
			})
		);
		expect(fields.timerPwmSidSyncDuty).toBe(25);
		expect(fields.timerPwmSidSyncSweepMin).toBe(8);
		expect(fields.timerPwmSidSyncSweep).toBe(4);
		expect(fields.timerPwmFmDuty).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
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

	it('normalizes pwm sweep shape aliases and invalid values', () => {
		expect(normalizeTimerPwmSweepShape('sin')).toBe('sin');
		expect(normalizeTimerPwmSweepShape('rampup')).toBe('ramup');
		expect(normalizeTimerPwmSweepShape('bogus')).toBe('tri');
	});

	it('imports legacy global pwm sweep shape to all scopes', () => {
		const fields = normalizeAyInstrumentFields(
			Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
				timerPwmSweepShape: 'sin'
			})
		);
		expect(fields.timerPwmSidSyncSweepShape).toBe('sin');
		expect(fields.timerPwmFmSweepShape).toBe('sin');
		expect(fields.timerPwmEfmSweepShape).toBe('sin');
	});

	it('samples pwm sweep shapes across the cycle', () => {
		expect(sampleTimerPwmSweepShape('square', 0)).toBe(1);
		expect(sampleTimerPwmSweepShape('square', 0.5)).toBe(0);
		expect(sampleTimerPwmSweepShape('rampdn', 0)).toBe(1);
		expect(sampleTimerPwmSweepShape('ramup', 1)).toBe(1);
	});

	it('advances shaped pwm sweep by phase for non-triangle shapes', () => {
		const first = advanceTimerPwmSweepWithShape(-1, 1, 50, 5, 25, 'sin', false);
		expect(first.duty).toBeGreaterThanOrEqual(5);
		expect(first.duty).toBeLessThanOrEqual(25);
		expect(first.sweepState).toBeGreaterThanOrEqual(0);

		const tri = advanceTimerPwmSweepWithShape(-1, 1, 5, 5, 25, 'tri', false);
		expect(tri).toEqual({ sweepState: 5, direction: 1, duty: 5, onceComplete: false, hasTurned: false });
	});

	it('scales pwm sweep per interrupt from interrupt frequency', () => {
		expect(effectiveTimerPwmSweepPerInterrupt(10, 50)).toBe(10);
		expect(effectiveTimerPwmSweepPerInterrupt(10, 100)).toBe(5);
		expect(effectiveTimerPwmSweepPerInterrupt(10, 25)).toBe(20);
	});

	it('once triangle sweep uses the same speed scale as free or retrigger triangle', () => {
		let freeState = -1;
		let freeDirection = 1;
		let onceState = -1;
		let onceDirection = 1;
		let onceHasTurned = false;
		let onceComplete = false;
		let freeTicks = 0;
		let onceTicks = 0;

		while (freeTicks < 500) {
			const advanced = advanceTimerPwmSweepWithShape(
				freeState,
				freeDirection,
				5,
				0,
				50,
				'tri',
				false,
				'retrigger'
			);
			freeState = advanced.sweepState;
			freeDirection = advanced.direction;
			freeTicks += 1;
			if (freeTicks > 1 && freeState === 0 && freeDirection === 1) {
				break;
			}
		}

		while (!onceComplete && onceTicks < 500) {
			const advanced = advanceTimerPwmSweepWithShape(
				onceState,
				onceDirection,
				5,
				0,
				50,
				'tri',
				false,
				'once',
				onceComplete,
				onceHasTurned
			);
			onceState = advanced.sweepState;
			onceDirection = advanced.direction;
			onceHasTurned = advanced.hasTurned;
			onceComplete = advanced.onceComplete;
			onceTicks += 1;
		}

		expect(onceComplete).toBe(true);
		expect(onceTicks).toBe(freeTicks);
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
			normalizeTimerPwmScopeFields({
				duty: 25,
				sweep: 99
			}).sweep
		).toBe(50);
	});

	it('resets sweep min to zero when sweep is disabled', () => {
		expect(
			normalizeTimerPwmScopeFields({
				duty: 25,
				sweepMin: 8,
				sweep: 0
			}).sweepMin
		).toBe(0);
	});

	it('clamps instrument pwm min to max duty', () => {
		expect(
			normalizeInstrumentTimerPwmScopeFields(
				Object.assign(new Instrument('01', [{ tone: true, volume: 15 }]), {
					timerPwmSidSyncDuty: 20,
					timerPwmSidSyncSweepMin: 30,
					timerPwmSidSyncSweep: 4
				}),
				'sidSync'
			).sweepMin
		).toBe(20);
	});

	it('computes pwm periods from duty without changing full cycle length', () => {
		expect(computeTimerPwmPeriods(100, 50)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmPeriods(100, 25)).toEqual({ highPeriod: 50, lowPeriod: 150 });
		expect(computeTimerPwmPeriods(100, 0)).toEqual({ highPeriod: 1, lowPeriod: 200 });
		expect(computeTimerPwmPeriods(100, 88)).toEqual({ highPeriod: 100, lowPeriod: 100 });
		expect(computeTimerPwmLowPeriod(100, 50)).toBe(100);
		expect(effectiveScopeTimerPwmDuty(normalizeAyInstrumentFields(
			new Instrument('01', [{ tone: true, volume: 15 }])
		), 'sidSync')).toBe(DEFAULT_AY_TIMER_PWM_DUTY);
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
