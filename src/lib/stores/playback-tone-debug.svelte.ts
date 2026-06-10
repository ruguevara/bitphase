export type ChipPlaybackHzState = {
	toneHz: (number | null)[];
	sidTimerHz: (number | null)[];
	syncbuzzerTimerHz: (number | null)[];
	timerPwmSweepPhase: (number | null)[];
	channelInstrumentIndex: number[];
	registers: number[];
};

const EMPTY_CHIP_PLAYBACK_HZ: ChipPlaybackHzState = {
	toneHz: [],
	sidTimerHz: [],
	syncbuzzerTimerHz: [],
	timerPwmSweepPhase: [],
	channelInstrumentIndex: [],
	registers: []
};

class PlaybackToneDebugStore {
	private debugByChip: ChipPlaybackHzState[] = $state([]);

	get allChipPlaybackHz(): ChipPlaybackHzState[] {
		return this.debugByChip;
	}

	setChipPlaybackHz(chipIndex: number, state: ChipPlaybackHzState): void {
		while (this.debugByChip.length <= chipIndex) {
			this.debugByChip = [...this.debugByChip, { ...EMPTY_CHIP_PLAYBACK_HZ }];
		}
		const next = this.debugByChip.slice();
		next[chipIndex] = state;
		this.debugByChip = next;
	}

	updateChipTimerPwmSweepPhase(
		chipIndex: number,
		timerPwmSweepPhase: (number | null)[],
		channelInstrumentIndex: number[]
	): void {
		while (this.debugByChip.length <= chipIndex) {
			this.debugByChip = [...this.debugByChip, { ...EMPTY_CHIP_PLAYBACK_HZ }];
		}
		const chip = this.debugByChip[chipIndex]!;
		if (chip.timerPwmSweepPhase.length !== timerPwmSweepPhase.length) {
			chip.timerPwmSweepPhase = timerPwmSweepPhase.slice();
		} else {
			for (let index = 0; index < timerPwmSweepPhase.length; index++) {
				chip.timerPwmSweepPhase[index] = timerPwmSweepPhase[index] ?? null;
			}
		}
		if (chip.channelInstrumentIndex.length !== channelInstrumentIndex.length) {
			chip.channelInstrumentIndex = channelInstrumentIndex.slice();
		} else {
			for (let index = 0; index < channelInstrumentIndex.length; index++) {
				chip.channelInstrumentIndex[index] = channelInstrumentIndex[index] ?? -1;
			}
		}
	}

	clear(): void {
		this.debugByChip = [];
	}
}

export const playbackToneDebugStore = new PlaybackToneDebugStore();
