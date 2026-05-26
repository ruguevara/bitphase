import { describe, it, expect } from 'vitest';
import { AyTimerEffectsController } from '@/lib/chips/ay/ay-timer-effects-controller.svelte.ts';
import { AY_TIMER_WAVEFORM_MAX_LENGTH } from '@/lib/chips/ay/instrument';
import { Instrument } from '@/lib/models/song';
import { HistoryClone } from '@/lib/services/history/history-clone';

function createInstrument(
	timerRows: { sid: boolean; syncbuzzer?: boolean; sidPeriodMode?: 'auto' | 'manual' }[]
): Instrument {
	const instrument = new Instrument('01', [{ tone: true, noise: false, envelope: false, volume: 15 }]);
	(
		instrument as Instrument & {
			timerRows: typeof timerRows;
			timerWaveform: number[];
			timerWaveformLoop: number;
		}
	).timerRows = timerRows;
	(
		instrument as Instrument & { timerWaveform: number[]; timerWaveformLoop: number }
	).timerWaveform = [15, 0];
	(
		instrument as Instrument & { timerWaveformLoop: number }
	).timerWaveformLoop = 0;
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

	it('appends waveform steps up to the maximum length', () => {
		let current = createInstrument([{ sid: false }]);
		const controller = new AyTimerEffectsController(
			() => current,
			(instrument) => {
				current = instrument;
			},
			() => false
		);

		expect(controller.appendWaveformStep()).toBe(true);
		expect(controller.fields.timerWaveform).toEqual([15, 0, 0]);

		controller.setTimerWaveform(Array.from({ length: AY_TIMER_WAVEFORM_MAX_LENGTH }, () => 1));
		expect(controller.appendWaveformStep()).toBe(false);
		expect(controller.fields.timerWaveform).toHaveLength(AY_TIMER_WAVEFORM_MAX_LENGTH);
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

		controller.setTimerWaveform([15, 14, 13]);
		expect(controller.fields.timerWaveform).toEqual([15, 14, 13]);

		const restored = HistoryClone.instrument(createInstrument([{ sid: false }]));
		controller.handleInstrumentChange(restored);
		expect(controller.fields.timerWaveform).toEqual([15, 0]);
	});
});
