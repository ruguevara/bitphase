import { describe, it, expect } from 'vitest';
import { AyTimerEffectsController } from '@/lib/chips/ay/ay-timer-effects-controller.svelte.ts';
import {
	AY_TIMER_WAVEFORM_MIN_LENGTH,
	AY_TIMER_WAVEFORM_MAX_LENGTH
} from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';
import { HistoryClone } from '@/lib/services/history/history-clone';

function createInstrument(
	timerRows: {
		sid: boolean;
		syncbuzzer?: boolean;
		sidPeriodMode?: 'auto' | 'manual';
		timerWaveform?: number[];
		timerWaveformLoop?: number;
	}[],
	pwm?: {
		timerPwmDuty?: number;
		timerPwmSweepMin?: number;
		timerPwmSweep?: number;
		timerPwmPreserveOnNewNote?: boolean;
	}
): Instrument {
	const instrument = new Instrument('01', [{ tone: true, noise: false, envelope: false, volume: 15 }]);
	const extended = instrument as Instrument & {
		timerRows: typeof timerRows;
		timerPwmDuty?: number;
		timerPwmSweepMin?: number;
		timerPwmSweep?: number;
		timerPwmPreserveOnNewNote?: boolean;
	};
	extended.timerRows = timerRows;
	if (pwm?.timerPwmDuty !== undefined) extended.timerPwmDuty = pwm.timerPwmDuty;
	if (pwm?.timerPwmSweepMin !== undefined) extended.timerPwmSweepMin = pwm.timerPwmSweepMin;
	if (pwm?.timerPwmSweep !== undefined) extended.timerPwmSweep = pwm.timerPwmSweep;
	if (pwm?.timerPwmPreserveOnNewNote !== undefined) {
		extended.timerPwmPreserveOnNewNote = pwm.timerPwmPreserveOnNewNote;
	}
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
		let current = createInstrument([{ sid: false, timerWaveform: [15, 0, 1] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.removeRowWaveformStep(0)).toBe(true);
		expect(controller.rowTimerWaveform(0)).toEqual([15, 0]);

		controller.setRowTimerWaveform(0, Array.from({ length: AY_TIMER_WAVEFORM_MIN_LENGTH }, () => 1));
		expect(controller.removeRowWaveformStep(0)).toBe(false);
		expect(controller.rowTimerWaveform(0)).toHaveLength(AY_TIMER_WAVEFORM_MIN_LENGTH);
	});

	it('appends waveform steps for a row up to the maximum length', () => {
		let current = createInstrument([{ sid: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.appendRowWaveformStep(0)).toBe(true);
		expect(controller.rowTimerWaveform(0)).toEqual([15, 0, 0]);

		controller.setRowTimerWaveform(0, Array.from({ length: AY_TIMER_WAVEFORM_MAX_LENGTH }, () => 1));
		expect(controller.appendRowWaveformStep(0)).toBe(false);
		expect(controller.rowTimerWaveform(0)).toHaveLength(AY_TIMER_WAVEFORM_MAX_LENGTH);
	});

	it('re-syncs timer waveform when instrument is replaced externally', () => {
		let current = createInstrument([{ sid: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setRowTimerWaveform(0, [15, 14, 13]);
		expect(controller.rowTimerWaveform(0)).toEqual([15, 14, 13]);

		const restored = HistoryClone.instrument(createInstrument([{ sid: false }]));
		controller.handleInstrumentChange(restored);
		expect(controller.rowTimerWaveform(0)).toEqual([15, 0]);
	});

	it('tracks instrument-level pwm duty globally', () => {
		let current = createInstrument([{ sid: false }], { timerPwmDuty: 50 });
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setTimerPwmDuty(10);
		expect(controller.timerPwmDuty()).toBe(10);
		expect(
			(current as Instrument & { timerPwmDuty?: number }).timerPwmDuty
		).toBe(10);
	});

	it('updates pwm sweep speed globally with non-negative values only', () => {
		let current = createInstrument([{ sid: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.updateTimerPwmSweep('3');
		expect(controller.timerPwmSweep()).toBe(3);
		controller.updateTimerPwmSweep('-12');
		expect(controller.timerPwmSweep()).toBe(3);
		controller.setTimerPwmSweepMin(8);
		expect(controller.timerPwmSweepMin()).toBe(8);
		controller.updateTimerPwmSweep('0');
		expect(controller.timerPwmSweep()).toBe(0);
		expect(controller.timerPwmSweepMin()).toBe(0);
	});

	it('tracks instrument sweep min globally', () => {
		let current = createInstrument([{ sid: false }], {
			timerPwmDuty: 25,
			timerPwmSweep: 4
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		controller.setTimerPwmSweepMin(5);
		expect(controller.timerPwmSweepMin()).toBe(5);
		controller.setTimerPwmSweepMin(40);
		expect(controller.timerPwmSweepMin()).toBe(25);
	});

	it('disables pwm editing when no row uses classic sid waveform', () => {
		let current = createInstrument([{ sid: false, timerWaveform: [15, 14] }], {
			timerPwmDuty: 20,
			timerPwmSweepMin: 5,
			timerPwmSweep: 4
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.instrumentSupportsTimerPwm()).toBe(false);
		controller.setTimerPwmDuty(10);
		expect(controller.timerPwmDuty()).toBe(20);
	});

	it('disables pwm editing when only syncbuzzer rows use classic sid steps', () => {
		let current = createInstrument([{ syncbuzzer: true, timerWaveform: [15, 0] }], {
			timerPwmDuty: 20,
			timerPwmSweepMin: 5,
			timerPwmSweep: 4
		});
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.instrumentSupportsTimerPwm()).toBe(false);
		controller.setTimerPwmDuty(10);
		expect(controller.timerPwmDuty()).toBe(20);
	});

	it('tracks instrument-level pwm preserve on new note', () => {
		let current = createInstrument([{ sid: true, timerWaveform: [15, 0] }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.timerPwmPreserveOnNewNote()).toBe(false);
		controller.setTimerPwmPreserveOnNewNote(true);
		expect(controller.timerPwmPreserveOnNewNote()).toBe(true);
		expect(
			(current as Instrument & { timerPwmPreserveOnNewNote?: boolean }).timerPwmPreserveOnNewNote
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

	it('disables sid steps while syncbuzzer is active', () => {
		let current = createInstrument([{ sid: false, syncbuzzer: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.rowSidStepsEnabled(0)).toBe(true);
		controller.openWaveformEditor(0);
		expect(controller.waveformEditorRowIndex).toBe(0);
		controller.updateSyncbuzzerRow(0, true);
		expect(controller.rowSidStepsEnabled(0)).toBe(false);
		expect(controller.waveformEditorRowIndex).toBeNull();
		controller.openWaveformEditor(0);
		expect(controller.waveformEditorRowIndex).toBeNull();
	});
});
