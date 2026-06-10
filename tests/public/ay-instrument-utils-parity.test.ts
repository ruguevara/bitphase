import { describe, it, expect } from 'vitest';
import * as ts from '@/lib/chips/ay/instrument';
import * as jsModule from '../../public/ay-instrument-utils.js';

const js = jsModule as unknown as Record<string, (...args: never[]) => unknown> &
	Record<string, unknown>;

type InstrumentInput = Parameters<typeof ts.normalizeAyInstrumentFields>[0];
type AyTimerEffectType = ts.AyTimerEffectType;

const DUTY_INPUTS = [-10, -1, 0, 1, 5, 10, 24, 25, 26, 49, 50, 51, 75, 100, 3.7, 49.9];
const PERIOD_INPUTS = [0, 1, 2, 3, 10, 100, 249, 333, 1000, 4095, 65535];
const SWEEP_INPUTS = [-5, 0, 1, 2, 3, 7, 50, 100];
const DIRECTIONS = [-1, 1];
const CURRENT_DUTIES = [-1, 0, 1, 5, 24, 25, 26, 49, 50];

const SHARED_CONSTANTS = [
	'DEFAULT_AY_SID_PERIOD',
	'DEFAULT_AY_SID_PERIOD_DETUNE',
	'DEFAULT_AY_SID_PERIOD_SEMITONE_DETUNE',
	'DEFAULT_AY_TIMER_WAVEFORM',
	'DEFAULT_AY_SYNCBUZZER_WAVEFORM',
	'DEFAULT_AY_FM_WAVEFORM',
	'DEFAULT_AY_FM_PERIOD_WAVEFORM',
	'AY_FM_SEMITONE_MIN',
	'AY_FM_SEMITONE_MAX',
	'AY_FM_PERIOD_OFFSET_MIN',
	'AY_FM_PERIOD_OFFSET_MAX',
	'AY_TIMER_PWM_DUTY_MIN',
	'AY_TIMER_PWM_DUTY_MAX',
	'DEFAULT_AY_TIMER_PWM_DUTY',
	'DEFAULT_AY_TIMER_PWM_SWEEP_MIN',
	'DEFAULT_AY_TIMER_PWM_SWEEP',
	'TIMER_PWM_SWEEP_UNINITIALIZED',
	'AY_TONE_REGISTER_PRESCALER',
	'AY_AUTO_TIMER_TONE_MULTIPLIER'
] as const;

const ROW_CASES: Array<Record<string, unknown> | undefined> = [
	undefined,
	{},
	{ sid: true, sidWaveform: [15, 0] },
	{ sid: true, sidWaveform: [15, 8, 0] },
	{ sid: true, sidWaveform: [] },
	{ syncbuzzer: true, syncbuzzerWaveform: [15, 0] },
	{ sid: true, syncbuzzer: true, sidWaveform: [15, 0] },
	{ sid: true, sidWaveform: [14, 0] },
	{ sid: true, sidWaveform: [15, 0, 0] },
	{ fm: true, fmWaveform: [0, 12] },
	{ fm: true, fmWaveform: [0, 1, 0, -1] },
	{ fm: true, fmOffsetMode: 'period', fmWaveform: [0, 16] },
	{ fm: true, fmOffsetMode: 'period', fmWaveform: [-100, 200] }
];

const FIELD_CASES = [
	{
		sidTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		syncbuzzerTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		fmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		envFmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		timerRows: []
	},
	{
		sidTimerPwm: { duty: 25, sweepMin: 5, sweep: 3 },
		syncbuzzerTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		fmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		envFmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		timerRows: []
	},
	{
		sidTimerPwm: { duty: 75, sweepMin: -3, sweep: -1 },
		syncbuzzerTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		fmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		envFmTimerPwm: { duty: 50, sweepMin: 0, sweep: 0 },
		timerRows: []
	}
];

const INSTRUMENT_CASES: InstrumentInput[] = [
	{ id: '01', rows: [{}] } as unknown as InstrumentInput,
	{
		id: '02',
		rows: [{}, {}],
		timerRows: [
			{ sid: true, sidWaveform: [15, 0] },
			{ syncbuzzer: true }
		],
		sidTimerPwm: {
			duty: 25,
			sweepMin: 8,
			sweep: 4,
			preserveOnNewNote: true,
			reverseSweep: true
		}
	} as unknown as InstrumentInput,
	{
		id: '03',
		rows: [{}],
		timerRows: [{ sid: true }],
		sidTimerPwm: { duty: 33, sweepMin: 9, sweep: 2 }
	} as unknown as InstrumentInput,
	{
		id: '04',
		rows: [{}, {}, {}],
		timerRows: [{ sid: true, sidWaveform: [15, 0] }]
	} as unknown as InstrumentInput,
	{
		id: '05',
		rows: [{}],
		timerRows: [
			{
				sid: true,
				sidWaveform: Array.from({ length: 40 }, (_, i) => (i % 16) + (i < 20 ? 8 : 0)),
				sidWaveformLoop: 3,
				detune: 12,
				semitone: -3,
				period: 0x12345
			}
		],
		sidTimerPwm: { duty: 200, sweep: 999, sweepMin: 999 }
	} as unknown as InstrumentInput,
	{
		id: '06',
		rows: [{}, {}],
		timerRows: [{ sid: true, syncbuzzer: true, sidWaveform: [15, 0] }, {}]
	} as unknown as InstrumentInput
];

const EFFECT_TYPES: AyTimerEffectType[] = ['sid', 'syncbuzzer', 'fm', 'envFm'];

describe('ay-instrument-utils TS/JS parity', () => {
	it('exposes identical shared constants', () => {
		for (const key of SHARED_CONSTANTS) {
			expect(js[key], key).toEqual((ts as Record<string, unknown>)[key]);
		}
	});

	it('clampTimerPwmDuty matches', () => {
		for (const duty of DUTY_INPUTS) {
			expect(js.clampTimerPwmDuty(duty as never), `duty=${duty}`).toBe(
				ts.clampTimerPwmDuty(duty)
			);
		}
	});

	it('computeTimerPwmPeriods and computeTimerPwmLowPeriod match', () => {
		for (const basePeriod of PERIOD_INPUTS) {
			for (const duty of DUTY_INPUTS) {
				const label = `base=${basePeriod} duty=${duty}`;
				expect(js.computeTimerPwmPeriods(basePeriod as never, duty as never), label).toEqual(
					ts.computeTimerPwmPeriods(basePeriod, duty)
				);
				expect(js.computeTimerPwmLowPeriod(basePeriod as never, duty as never), label).toBe(
					ts.computeTimerPwmLowPeriod(basePeriod, duty)
				);
			}
		}
	});

	it('clampTimerPwmSweepMin matches', () => {
		for (const min of DUTY_INPUTS) {
			for (const max of DUTY_INPUTS) {
				expect(js.clampTimerPwmSweepMin(min as never, max as never), `min=${min} max=${max}`).toBe(
					ts.clampTimerPwmSweepMin(min, max)
				);
			}
		}
	});

	it('advanceTimerPwmSweep matches across all parameter combinations', () => {
		for (const reverseSweep of [false, true]) {
			for (const current of CURRENT_DUTIES) {
				for (const direction of DIRECTIONS) {
					for (const sweep of SWEEP_INPUTS) {
						for (const min of [0, 5, 25, 50]) {
							for (const max of [0, 10, 25, 50]) {
								const label = `reverse=${reverseSweep} c=${current} dir=${direction} s=${sweep} min=${min} max=${max}`;
								expect(
									js.advanceTimerPwmSweep(
										current as never,
										direction as never,
										sweep as never,
										min as never,
										max as never,
										reverseSweep as never
									),
									label
								).toEqual(
									ts.advanceTimerPwmSweep(current, direction, sweep, min, max, reverseSweep)
								);
							}
						}
					}
				}
			}
		}
	});

	it('resolveSyncbuzzerWaveform matches', () => {
		const cases = [
			{ timerRow: { syncbuzzer: true, syncbuzzerWaveform: [0, 8, 0, 8] }, patternShape: 0 },
			{ timerRow: { syncbuzzer: true, syncbuzzerWaveform: [0, 8, 0, 8] }, patternShape: 15 },
			{ timerRow: { syncbuzzer: true, syncbuzzerWaveform: [0, 8, 0, 8] }, patternShape: 12 },
			{ timerRow: { syncbuzzer: true, syncbuzzerWaveform: [8] }, patternShape: 12 },
			{ timerRow: undefined, patternShape: 12 }
		];
		for (const { timerRow, patternShape } of cases) {
			const label = `${JSON.stringify(timerRow)} / ${patternShape}`;
			expect(js.resolveSyncbuzzerWaveform(timerRow as never, patternShape as never), label).toEqual(
				ts.resolveSyncbuzzerWaveform(timerRow as ts.AyTimerRow | undefined, patternShape)
			);
		}
	});

	it('isClassicSidTimerWaveform matches', () => {
		const waveforms = [[15, 0], [15, 0, 0], [14, 0], [15, 1], [], [15], [0xf, 0x0]];
		for (const waveform of waveforms) {
			expect(js.isClassicSidTimerWaveform(waveform as never), JSON.stringify(waveform)).toBe(
				ts.isClassicSidTimerWaveform(waveform)
			);
		}
	});

	it('row waveform / pwm accessors match', () => {
		for (const row of ROW_CASES) {
			const label = JSON.stringify(row);
			for (const effectType of EFFECT_TYPES) {
				expect(js.effectiveRowWaveform(row as never, effectType as never), `${label}/${effectType}`).toEqual(
					ts.effectiveRowWaveform(row as ts.AyTimerRow | undefined, effectType)
				);
				expect(js.effectiveRowWaveformLoop(row as never, effectType as never), `${label}/${effectType}`).toBe(
					ts.effectiveRowWaveformLoop(row as ts.AyTimerRow | undefined, effectType)
				);
			}
			for (const effectType of EFFECT_TYPES) {
				expect(js.rowSupportsTimerPwm(row as never, effectType as never), `${label}/${effectType}`).toBe(
					ts.rowSupportsTimerPwm(row as ts.AyTimerRow | undefined, effectType)
				);
			}

			for (const fields of FIELD_CASES) {
				for (const effectType of EFFECT_TYPES) {
					const fieldsLabel = `${label} / ${effectType} / ${JSON.stringify(fields)}`;
					expect(
						js.effectiveTimerPwmDuty(fields as never, effectType as never, row as never),
						fieldsLabel
					).toBe(
						ts.effectiveTimerPwmDuty(
							fields as unknown as ts.AyInstrumentFields,
							effectType,
							row as ts.AyTimerRow | undefined
						)
					);
					expect(
						js.effectiveTimerPwmSweep(fields as never, effectType as never, row as never),
						fieldsLabel
					).toBe(
						ts.effectiveTimerPwmSweep(
							fields as unknown as ts.AyInstrumentFields,
							effectType,
							row as ts.AyTimerRow | undefined
						)
					);
					expect(
						js.effectiveTimerPwmSweepMin(fields as never, effectType as never, row as never),
						fieldsLabel
					).toBe(
						ts.effectiveTimerPwmSweepMin(
							fields as unknown as ts.AyInstrumentFields,
							effectType,
							row as ts.AyTimerRow | undefined
						)
					);
				}
			}
		}
	});

	it('normalizeAyInstrumentFields matches (covers normalizeTimerRow and pwm field resolution)', () => {
		for (const instrument of INSTRUMENT_CASES) {
			const label = (instrument as { id?: string }).id ?? 'unknown';
			const tsResult = ts.normalizeAyInstrumentFields(
				structuredClone(instrument) as InstrumentInput
			);
			const jsResult = js.normalizeAyInstrumentFields(structuredClone(instrument) as never);
			expect(jsResult, `instrument ${label}`).toEqual(tsResult);
		}
	});
});
