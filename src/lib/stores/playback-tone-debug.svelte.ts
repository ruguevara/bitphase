export type ChipPlaybackHzState = {
	toneHz: (number | null)[];
	sidTimerHz: (number | null)[];
	syncbuzzerTimerHz: (number | null)[];
	registers: number[];
};

const EMPTY_CHIP_PLAYBACK_HZ: ChipPlaybackHzState = {
	toneHz: [],
	sidTimerHz: [],
	syncbuzzerTimerHz: [],
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

	clear(): void {
		this.debugByChip = [];
	}
}

export const playbackToneDebugStore = new PlaybackToneDebugStore();
