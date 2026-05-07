import {
	isMixerWorkletSlotProcessor,
	type ChipProcessor,
	type SettingsSubscriber
} from '../../chips/base/processor';
import type { Chip } from '../../chips/types';
import type { Table } from '../../models/project';
import { ChipSettings } from './chip-settings';
import type { CatchUpSegment } from './play-from-position';
import { channelMuteStore } from '../../stores/channel-mute.svelte';
import { waveformStore } from '../../stores/waveform.svelte';

import type { Pattern } from '../../models/song';

const BITPHASE_AUDIO_PROCESSOR = 'bitphase-audio-processor';
const BITPHASE_AUDIO_MODULE = `${BITPHASE_AUDIO_PROCESSOR}.js`;

export interface PlayFromRowOptions {
	catchUpSegments?: CatchUpSegment[];
	startPattern?: Pattern;
	getCatchUpSegmentsForChip?: (chipIndex: number) => CatchUpSegment[];
	getStartPatternForChip?: (chipIndex: number) => Pattern;
}

export class AudioService {
	private _audioContext: AudioContext | null = new AudioContext();
	private _isPlaying = false;
	private _previewChipIndices = new Set<number>();
	public chipSettings: ChipSettings = new ChipSettings();
	private _masterGainNode: GainNode | null = null;
	private _playPatternRestoreOrder: number[] | null = null;
	private _playPatternRestoreLoopPointId = 0;
	private _playPatternId: number | null = null;
	private _mixerNode: AudioWorkletNode | null = null;
	private readonly _wasmByUrl = new Map<string, ArrayBuffer>();

	chipProcessors: ChipProcessor[] = [];

	constructor() {
		if (this._audioContext) {
			this._masterGainNode = this._audioContext.createGain();
			this._masterGainNode.connect(this._audioContext.destination);
			this._masterGainNode.gain.value = 1.0;

			document.addEventListener('keydown', () => this._audioContext?.resume(), {
				once: true
			});
			document.addEventListener('mousedown', () => this._audioContext?.resume(), {
				once: true
			});
			document.addEventListener('touchstart', () => this._audioContext?.resume(), {
				once: true
			});
			document.addEventListener('touchend', () => this._audioContext?.resume(), {
				once: true
			});
		}
	}

	private _dispatchWorkletFromMixer(event: MessageEvent): void {
		const data = event.data as { chipIndex?: number };
		const chipIndex = data.chipIndex;
		if (typeof chipIndex !== 'number' || chipIndex < 0 || chipIndex >= this.chipProcessors.length) {
			return;
		}
		const proc = this.chipProcessors[chipIndex];
		proc.acceptWorkletPayload?.(event.data);
	}

	private async _loadWasm(url: string): Promise<ArrayBuffer> {
		let buf = this._wasmByUrl.get(url);
		if (!buf) {
			const res = await fetch(import.meta.env.BASE_URL + url);
			buf = await res.arrayBuffer();
			this._wasmByUrl.set(url, buf);
		}
		return buf.slice(0);
	}

	private async _rebuildMixerAfterChipListChange(): Promise<void> {
		if (!this._audioContext || !this._masterGainNode) return;

		this._mixerNode?.port.postMessage({ type: 'dispose_mixer' });
		this._mixerNode?.disconnect();
		this._mixerNode = null;

		if (this.chipProcessors.length === 0) return;

		const base = import.meta.env.BASE_URL;
		await this._audioContext.audioWorklet.addModule(base + BITPHASE_AUDIO_MODULE);
		this._mixerNode = new AudioWorkletNode(this._audioContext, BITPHASE_AUDIO_PROCESSOR, {
			outputChannelCount: [2]
		});
		this._mixerNode.connect(this._masterGainNode);
		this._mixerNode.port.onmessage = (e) => this._dispatchWorkletFromMixer(e);

		for (let i = 0; i < this.chipProcessors.length; i++) {
			const processor = this.chipProcessors[i];
			if (isMixerWorkletSlotProcessor(processor)) {
				processor.bindChipIndex(i);
				const wasmBuffer = await this._loadWasm(processor.chip.wasmUrl);
				processor.initialize(wasmBuffer, this._mixerNode);
			}
		}
	}

	async addChipProcessor(chip: Chip) {
		if (!this._audioContext) {
			throw new Error('Audio context not initialized');
		}

		const processor = this.createChipProcessor(chip);
		if (!isMixerWorkletSlotProcessor(processor)) {
			throw new Error(`Chip "${chip.type}" does not implement the bitphase mixer worklet slot`);
		}
		const chipIndex = this.chipProcessors.length;
		this.chipProcessors.push(processor);

		if (this.hasSettingsSubscription(processor)) {
			processor.subscribeToSettings(this.chipSettings);
		}

		const wasmBuffer = await this._loadWasm(chip.wasmUrl);
		const base = import.meta.env.BASE_URL;

		if (!this._mixerNode) {
			await this._audioContext.audioWorklet.addModule(base + BITPHASE_AUDIO_MODULE);
			this._mixerNode = new AudioWorkletNode(this._audioContext, BITPHASE_AUDIO_PROCESSOR, {
				outputChannelCount: [2]
			});
			this._mixerNode.connect(this._masterGainNode!);
			this._mixerNode.port.onmessage = (e) => this._dispatchWorkletFromMixer(e);
		}

		processor.bindChipIndex(chipIndex);
		processor.initialize(wasmBuffer, this._mixerNode);

		const processorWithWaveform = processor as {
			setWaveformCallback?: (cb: (channels: Float32Array[]) => void) => void;
		};
		processorWithWaveform.setWaveformCallback?.((channels: Float32Array[]) => {
			const showWaveform = this._isPlaying || this._previewChipIndices.has(chipIndex);
			if (showWaveform) waveformStore.setChannels(chipIndex, channels);
		});
	}

	setPreviewActiveForChips(indices: number | number[] | null): void {
		if (indices === null) {
			this._previewChipIndices.clear();
			if (!this._isPlaying) waveformStore.clear();
			return;
		}
		const arr = Array.isArray(indices) ? indices : [indices];
		this._previewChipIndices = new Set(arr);
	}

	play(initialSpeeds?: number[]) {
		if (this._isPlaying) return;

		this._isPlaying = true;
		this._previewChipIndices.clear();

		this.applyMuteStateToAllChips();

		this.chipProcessors.forEach((chipProcessor, index) => {
			const initialSpeed = initialSpeeds?.[index];
			chipProcessor.play(initialSpeed);
		});
	}

	playFromRow(
		row: number,
		patternOrderIndex?: number,
		getSpeedForChip?: (chipIndex: number) => number | null,
		options?: PlayFromRowOptions
	) {
		if (this._isPlaying) return;

		this._isPlaying = true;
		this._previewChipIndices.clear();

		this.applyMuteStateToAllChips();

		const catchUpSegments = options?.catchUpSegments;
		const startPattern = options?.startPattern;
		const getCatchUpSegmentsForChip = options?.getCatchUpSegmentsForChip;
		const getStartPatternForChip = options?.getStartPatternForChip;
		const orderIndex = patternOrderIndex ?? 0;

		this.chipProcessors.forEach((chipProcessor, index) => {
			const speed = getSpeedForChip ? (getSpeedForChip(index) ?? null) : null;
			const chipCatchUp = getCatchUpSegmentsForChip?.(index) ?? catchUpSegments;
			const chipStartPattern = getStartPatternForChip?.(index) ?? startPattern;
			if (chipCatchUp && chipStartPattern && chipProcessor.playFromPosition) {
				chipProcessor.playFromPosition(
					row,
					orderIndex,
					speed,
					chipCatchUp,
					chipStartPattern
				);
			} else {
				chipProcessor.playFromRow(row, patternOrderIndex, speed ?? undefined);
			}
		});
	}

	stop() {
		if (!this._isPlaying) return;

		this._isPlaying = false;
		this._previewChipIndices.clear();

		waveformStore.clear();

		this.chipProcessors.forEach((chipProcessor) => {
			chipProcessor.stop();
		});

		if (this._playPatternRestoreOrder) {
			this.updateOrder(this._playPatternRestoreOrder, this._playPatternRestoreLoopPointId);
			this._playPatternRestoreOrder = null;
			this._playPatternRestoreLoopPointId = 0;
			this._playPatternId = null;
		}
	}

	updateOrder(order: number[], loopPointId: number) {
		this.chipProcessors.forEach((chipProcessor) => {
			chipProcessor.updateOrder(order, loopPointId);
		});
	}

	setPlayPatternRestoreOrder(order: number[], patternId: number, loopPointId: number) {
		this._playPatternRestoreOrder = order;
		this._playPatternRestoreLoopPointId = loopPointId;
		this._playPatternId = patternId;
	}

	getPlayPatternId(): number | null {
		return this._playPatternId;
	}

	updateTables(tables: Table[]) {
		this.chipProcessors.forEach((chipProcessor) => {
			chipProcessor.sendInitTables(tables);
		});
	}

	updateInstruments(instruments: import('../../models/song').Instrument[]) {
		this.chipProcessors.forEach((chipProcessor) => {
			if ('sendInitInstruments' in chipProcessor) {
				(chipProcessor as { sendInitInstruments: (i: typeof instruments) => void }).sendInitInstruments(
					instruments
				);
			}
		});
	}

	removeChipProcessor(index: number): void {
		if (index < 0 || index >= this.chipProcessors.length) return;
		if (this._isPlaying) {
			this.stop();
		}
		this.chipProcessors = this.chipProcessors.filter((_, i) => i !== index);
		void this._rebuildMixerAfterChipListChange();
	}

	clearChipProcessors() {
		if (this._isPlaying) {
			this.stop();
		}
		this._mixerNode?.port.postMessage({ type: 'dispose_mixer' });
		this._mixerNode?.disconnect();
		this._mixerNode = null;
		this.chipProcessors = [];
	}

	async dispose() {
		if (this._isPlaying) {
			this.stop();
		}

		if (this._audioContext) {
			await this._audioContext.close();
			this._audioContext = null;
		}

		this._mixerNode = null;
		this.chipProcessors = [];
	}

	get playing() {
		return this._isPlaying;
	}

	setVolume(volume: number) {
		if (this._masterGainNode) {
			this._masterGainNode.gain.value = Math.max(0, Math.min(1, volume / 100));
		}
	}

	private createChipProcessor(chip: Chip): ChipProcessor {
		const createProcessor = chip.processorMap;
		if (!createProcessor) {
			throw new Error(`Unsupported chip: ${chip}`);
		}

		return createProcessor(chip);
	}

	private hasSettingsSubscription(
		processor: ChipProcessor
	): processor is ChipProcessor & SettingsSubscriber {
		return (
			'subscribeToSettings' in processor &&
			'unsubscribeFromSettings' in processor &&
			typeof (processor as unknown as SettingsSubscriber).subscribeToSettings === 'function' &&
			typeof (processor as unknown as SettingsSubscriber).unsubscribeFromSettings === 'function'
		);
	}

	private applyMuteStateToAllChips(): void {
		const allMuteStates = channelMuteStore.getAllMuteStates();

		this.chipProcessors.forEach((chipProcessor, chipIndex) => {
			const chipMutes = allMuteStates.get(chipIndex);
			if (chipMutes) {
				chipMutes.forEach((isMuted, channelIndex) => {
					chipProcessor.updateParameter(`channelMute_${channelIndex}`, isMuted);
				});
			}
		});
	}
}
