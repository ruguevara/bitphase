import { describe, it, expect } from 'vitest';
import { AyTimerEffectsController } from '@/lib/chips/ay/ay-timer-effects-controller.svelte.ts';
import {
	AY_TIMER_WAVEFORM_MIN_LENGTH,
	AY_TIMER_WAVEFORM_MAX_LENGTH,
	type AyTimerEffectType
} from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';
import { HistoryClone } from '@/lib/services/history/history-clone';

type TimerRowInput = {
	sid: boolean;
	syncbuzzer?: boolean;
	fm?: boolean;
	envFm?: boolean;
	sidWaveform?: number[];
	syncbuzzerWaveform?: number[];
	fmWaveform?: number[];
	envFmWaveform?: number[];
};

type PwmInput = Partial<{
	sidTimerPwm: { duty?: number; sweepMin?: number; sweep?: number; preserveOnNewNote?: boolean; reverseSweep?: boolean };
	syncbuzzerTimerPwm: { duty?: number; sweepMin?: number; sweep?: number };
	fmTimerPwm: { duty?: number; sweepMin?: number; sweep?: number };
	envFmTimerPwm: { duty?: number; sweepMin?: number; sweep?: number };
}>;

function createInstrument(timerRows: TimerRowInput[], pwm?: PwmInput): Instrument {
	const instrument = new Instrument('01', [
		{ tone: true, noise: false, envelope: false, volume: 15 }
	]);
	const extended = instrument as Instrument & {
		timerRows: TimerRowInput[];
	} & PwmInput;
	extended.timerRows = timerRows;
	if (pwm?.sidTimerPwm) extended.sidTimerPwm = pwm.sidTimerPwm;
	if (pwm?.syncbuzzerTimerPwm) extended.syncbuzzerTimerPwm = pwm.syncbuzzerTimerPwm;
	if (pwm?.fmTimerPwm) extended.fmTimerPwm = pwm.fmTimerPwm;
	if (pwm?.envFmTimerPwm) extended.envFmTimerPwm = pwm.envFmTimerPwm;
	return instrument;
}

describe('AyTimerEffectsController', () => {
	it('re-syncs timer fields when instrument is replaced externally', () => {
		let current = createInstrument([{ sid: false, syncbuzzer: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.updateSidRow(0, true);
		expect(controller.fields.timerRows[0]?.sid).toBe(true);

		const restored = HistoryClone.instrument(
			createInstrument([{ sid: false, syncbuzzer: false }])
		);
		controller.handleInstrumentChange(restored);
		expect(controller.fields.timerRows[0]?.sid).toBe(false);
	});

	it('removes waveform steps for a row down to the minimum length', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0, 1] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.removeRowWaveformStep(0, 'sid')).toBe(true);
		expect(controller.rowWaveform(0, 'sid')).toEqual([15, 0]);

		controller.setRowWaveform(
			0,
			'sid',
			Array.from({ length: AY_TIMER_WAVEFORM_MIN_LENGTH }, () => 1)
		);
		expect(controller.removeRowWaveformStep(0, 'sid')).toBe(false);
		expect(controller.rowWaveform(0, 'sid')).toHaveLength(AY_TIMER_WAVEFORM_MIN_LENGTH);
	});

	it('appends waveform steps for a row up to the maximum length', () => {
		let current = createInstrument([{ sid: true }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.appendRowWaveformStep(0, 'sid')).toBe(true);
		expect(controller.rowWaveform(0, 'sid')).toEqual([15, 0, 0]);

		controller.setRowWaveform(
			0,
			'sid',
			Array.from({ length: AY_TIMER_WAVEFORM_MAX_LENGTH }, () => 1)
		);
		expect(controller.appendRowWaveformStep(0, 'sid')).toBe(false);
		expect(controller.rowWaveform(0, 'sid')).toHaveLength(AY_TIMER_WAVEFORM_MAX_LENGTH);
	});

	it('re-syncs timer waveform when instrument is replaced externally', () => {
		let current = createInstrument([{ sid: true }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setRowWaveform(0, 'sid', [15, 14, 13]);
		expect(controller.rowWaveform(0, 'sid')).toEqual([15, 14, 13]);

		const restored = HistoryClone.instrument(createInstrument([{ sid: true }]));
		controller.handleInstrumentChange(restored);
		expect(controller.rowWaveform(0, 'sid')).toEqual([15, 0]);
	});

	it('tracks per-effect pwm duty', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0] }], {
			sidTimerPwm: { duty: 50 }
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setTimerPwmDuty('sid', 10);
		expect(controller.timerPwmDuty('sid')).toBe(10);
		expect((current as Instrument & { sidTimerPwm?: { duty: number } }).sidTimerPwm?.duty).toBe(
			10
		);
	});

	it('updates pwm sweep speed with non-negative values only', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.updateTimerPwmSweep('sid', '3');
		expect(controller.timerPwmSweep('sid')).toBe(3);
		controller.updateTimerPwmSweep('sid', '-12');
		expect(controller.timerPwmSweep('sid')).toBe(3);
		controller.setTimerPwmSweepMin('sid', 8);
		expect(controller.timerPwmSweepMin('sid')).toBe(8);
		controller.updateTimerPwmSweep('sid', '0');
		expect(controller.timerPwmSweep('sid')).toBe(0);
		expect(controller.timerPwmSweepMin('sid')).toBe(0);
		controller.updateTimerPwmSweep('sid', '99');
		expect(controller.timerPwmSweep('sid')).toBe(50);
	});

	it('tracks per-effect sweep min', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0] }], {
			sidTimerPwm: { duty: 25, sweep: 4 }
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setTimerPwmSweepMin('sid', 5);
		expect(controller.timerPwmSweepMin('sid')).toBe(5);
		controller.setTimerPwmSweepMin('sid', 40);
		expect(controller.timerPwmSweepMin('sid')).toBe(25);
	});

	it('disables pwm editing when sid rows do not use exactly two steps', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 14, 13] }], {
			sidTimerPwm: { duty: 20, sweepMin: 5, sweep: 4 }
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.instrumentSupportsTimerPwm('sid')).toBe(false);
		controller.setTimerPwmDuty('sid', 10);
		expect(controller.timerPwmDuty('sid')).toBe(20);
	});

	it('enables pwm editing per effect type independently', () => {
		const cases: Array<{ row: TimerRowInput; effect: AyTimerEffectType }> = [
			{ row: { sid: true, sidWaveform: [15, 14] }, effect: 'sid' },
			{ row: { fm: true, fmWaveform: [0, 12] }, effect: 'fm' },
			{ row: { syncbuzzer: true, syncbuzzerWaveform: [13, 9] }, effect: 'syncbuzzer' }
		];

		for (const { row, effect } of cases) {
			let current = createInstrument([row], {
				sidTimerPwm: { duty: 20, sweepMin: 5, sweep: 4 },
				fmTimerPwm: { duty: 20, sweepMin: 5, sweep: 4 },
				syncbuzzerTimerPwm: { duty: 20, sweepMin: 5, sweep: 4 }
			});
			const controller = new AyTimerEffectsController(
				() => current,
				(instrument) => {
					current = instrument;
				},
				() => false
			);

			expect(controller.instrumentSupportsTimerPwm(effect)).toBe(true);
			controller.setTimerPwmDuty(effect, 10);
			expect(controller.timerPwmDuty(effect)).toBe(10);
		}
	});

	it('tracks per-effect pwm preserve on new note', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.timerPwmPreserveOnNewNote('sid')).toBe(false);
		controller.setTimerPwmPreserveOnNewNote('sid', true);
		expect(controller.timerPwmPreserveOnNewNote('sid')).toBe(true);
		expect(
			(current as Instrument & { sidTimerPwm?: { preserveOnNewNote: boolean } }).sidTimerPwm
				?.preserveOnNewNote
		).toBe(true);
	});

	it('tracks per-effect reverse pwm sweep', () => {
		let current = createInstrument([{ sid: true, sidWaveform: [15, 0] }], {
			sidTimerPwm: { sweep: 4 }
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.timerPwmReverseSweep('sid')).toBe(false);
		controller.setTimerPwmReverseSweep('sid', true);
		expect(controller.timerPwmReverseSweep('sid')).toBe(true);
		expect(
			(current as Instrument & { sidTimerPwm?: { reverseSweep: boolean } }).sidTimerPwm
				?.reverseSweep
		).toBe(true);
	});

	it('opens and closes the waveform editor for a row', () => {
		let current = createInstrument([{ sid: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.waveformEditorRowIndex).toBeNull();
		controller.openWaveformEditor(0);
		expect(controller.waveformEditorRowIndex).toBe(0);
		controller.openWaveformEditor(0);
		expect(controller.waveformEditorRowIndex).toBeNull();
		controller.closeWaveformEditor();
		expect(controller.waveformEditorRowIndex).toBeNull();
	});

	it('keeps sid and syncbuzzer mutually exclusive when toggling', () => {
		let current = createInstrument([{ sid: true, fm: true, fmWaveform: [15, 7] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.updateSyncbuzzerRow(0, true);
		expect(controller.rowSidEnabled(0)).toBe(false);
		expect(controller.rowSyncbuzzerEnabled(0)).toBe(true);
		expect(controller.rowFmEnabled(0)).toBe(true);
		expect(controller.rowWaveform(0, 'fm')).toEqual([15, 7]);

		controller.updateSidRow(0, true);
		expect(controller.rowSidEnabled(0)).toBe(true);
		expect(controller.rowSyncbuzzerEnabled(0)).toBe(false);
	});

	it('switches fm offset mode and keeps custom waveform values', () => {
		let current = createInstrument([{ fm: true, fmWaveform: [0, 8, -4] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.rowFmOffsetMode(0)).toBe('semitone');
		expect(controller.formatRowWaveform(0, 'fm')).toBe('0 8 -4');
		controller.updateFmOffsetMode(0, 'period');
		expect(controller.rowFmOffsetMode(0)).toBe('period');
		expect(controller.rowWaveform(0, 'fm')).toEqual([0, 8, -4]);
		expect(controller.formatRowWaveform(0, 'fm')).toBe('0 8 -4');
	});

	it('uses separate waveforms per effect type', () => {
		let current = createInstrument([
			{
				sid: true,
				fm: true,
				sidWaveform: [15, 0],
				fmWaveform: [0, 7]
			}
		]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.rowWaveform(0, 'sid')).toEqual([15, 0]);
		expect(controller.rowWaveform(0, 'fm')).toEqual([0, 7]);
		expect(controller.rowSyncbuzzerEnabled(0)).toBe(false);
	});
});
