import type { Project } from '../../models/project';
import { AY_CHIP } from './index';
import type { Pattern } from '../../models/song';
import type { ChipRenderer } from '../base/renderer';

const SAMPLE_RATE = 44100;
const DEFAULT_SPEED = 6;
const AYUMI_STRUCT_SIZE = 22904;
const AYUMI_STRUCT_LEFT_OFFSET = 22888;
const AYUMI_STRUCT_RIGHT_OFFSET = 22896;
const DEFAULT_AYM_FREQUENCY = 1773400;
const PAN_SETTINGS = [
	{ channel: 0, left: 0.35, right: 0 },
	{ channel: 1, left: 0.5, right: 0 },
	{ channel: 2, left: 0.75, right: 0 }
];

export class AYChipRenderer implements ChipRenderer {
	private async loadWasmModule(
		onProgress?: (progress: number, message: string) => void
	): Promise<{ wasm: any; wasmBuffer: ArrayBuffer }> {
		onProgress?.(0, 'Loading WASM module...');
		const wasmResponse = await fetch(import.meta.env.BASE_URL + AY_CHIP.wasmUrl);
		const wasmBuffer = await wasmResponse.arrayBuffer();

		onProgress?.(10, 'Instantiating WASM...');
		const result = await WebAssembly.instantiate(wasmBuffer, {
			env: { emscripten_notify_memory_growth: () => {} }
		});

		return { wasm: result.instance.exports as any, wasmBuffer };
	}

	private initializeAyumi(wasm: any, song: any): number {
		const chipFrequency = song.chipFrequency || DEFAULT_AYM_FREQUENCY;
		const ayumiPtr = wasm.malloc(AYUMI_STRUCT_SIZE);
		if (!ayumiPtr) {
			throw new Error('Failed to allocate Ayumi structure');
		}

		const isYM = song.chipType === 'ay' && song.chipVariant === 'YM' ? 1 : 0;
		wasm.ayumi_configure(ayumiPtr, isYM, chipFrequency, SAMPLE_RATE);

		PAN_SETTINGS.forEach(({ channel, left, right }) => {
			wasm.ayumi_set_pan(ayumiPtr, channel, left, right);
		});

		return ayumiPtr;
	}

	private async loadProcessorModules(
		onProgress?: (progress: number, message: string) => void
	): Promise<{
		AyumiState: any;
		TrackerPatternProcessor: any;
		AYAudioDriver: any;
		AyumiEngine: any;
		AYChipRegisterState: any;
	}> {
		onProgress?.(20, 'Loading processor modules...');
		const baseUrl = import.meta.env.BASE_URL;
		const { default: AyumiState } = await import(`${baseUrl}ayumi-state.js`);
		onProgress?.(30, 'Loading pattern processor...');
		const { default: TrackerPatternProcessor } = await import(
			`${baseUrl}tracker-pattern-processor.js`
		);
		onProgress?.(40, 'Loading audio driver...');
		const { default: AYAudioDriver } = await import(`${baseUrl}ay-audio-driver.js`);
		const { default: AyumiEngine } = await import(`${baseUrl}ayumi-engine.js`);
		const { default: AYChipRegisterState } = await import(`${baseUrl}ay-chip-register-state.js`);

		return { AyumiState, TrackerPatternProcessor, AYAudioDriver, AyumiEngine, AYChipRegisterState };
	}

	private setupState(
		state: any,
		song: any,
		project: Project,
		wasm: any,
		ayumiPtr: number,
		wasmBuffer: ArrayBuffer
	): void {
		const chipFrequency = song.chipFrequency || DEFAULT_AYM_FREQUENCY;
		state.setWasmModule(wasm, ayumiPtr, wasmBuffer);
		state.setAymFrequency(chipFrequency);
		state.setTuningTable(song.tuningTable);
		state.setInstruments(song.instruments);
		state.setTables(project.tables);
		state.setPatternOrder(project.patternOrder || [0]);
		state.setSpeed(song.initialSpeed || DEFAULT_SPEED);
		state.updateSamplesPerTick(SAMPLE_RATE);
	}

	private getPatterns(song: any, patternOrder: number[]): Pattern[] {
		const patterns: Pattern[] = [];
		for (const patternId of patternOrder) {
			const pattern = song.patterns.find((p: Pattern) => p.id === patternId);
			if (pattern) {
				patterns.push(pattern);
			}
		}
		return patterns;
	}

	private calculateTotalRows(song: any, patternOrder: number[]): number {
		let totalRows = 0;
		for (const patternId of patternOrder) {
			const pattern = song.patterns.find((p: Pattern) => p.id === patternId);
			if (pattern) {
				totalRows += pattern.length;
			}
		}
		return totalRows;
	}

	private calculateCurrentRow(state: any, song: any): number {
		let currentRow = 0;
		for (let i = 0; i < state.currentPatternOrderIndex; i++) {
			const patternId = state.patternOrder[i];
			const pattern = song.patterns.find((p: Pattern) => p.id === patternId);
			if (pattern) {
				currentRow += pattern.length;
			}
		}
		if (state.currentPattern) {
			currentRow += state.currentRow;
		}
		return currentRow;
	}

	private async renderAudioLoop(
		state: any,
		patternProcessor: any,
		audioDriver: any,
		ayumiEngine: any,
		registerState: any,
		wasm: any,
		ayumiPtr: number,
		song: any,
		totalRows: number,
		patterns: Pattern[],
		onProgress?: (progress: number, message: string) => void
	): Promise<Float32Array[]> {
		const leftSamples: number[] = [];
		const rightSamples: number[] = [];
		let totalSamples = 0;
		const maxSamples = SAMPLE_RATE * 300;

		let lastProgressUpdate = 0;
		const progressUpdateInterval = SAMPLE_RATE * 0.1;
		let lastProgressTime = Date.now();
		const minProgressUpdateMs = 100;

		onProgress?.(50, 'Starting render...');

		while (totalSamples < maxSamples) {
			const now = Date.now();
			if (
				(totalSamples - lastProgressUpdate >= progressUpdateInterval ||
					now - lastProgressTime >= minProgressUpdateMs) &&
				totalSamples > 0
			) {
				const renderProgress = (totalSamples / maxSamples) * 50;
				const progress = 50 + renderProgress;
				const currentRow = this.calculateCurrentRow(state, song);
				const message = `Rendering... ${currentRow}/${totalRows} rows`;
				onProgress?.(progress, message);
				lastProgressUpdate = totalSamples;
				lastProgressTime = now;
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			if (state.sampleCounter >= state.samplesPerTick) {
				if (state.currentTick === 0 && state.currentPattern) {
					patternProcessor.parsePatternRow(state.currentPattern, state.currentRow, registerState);
				}

				patternProcessor.processTables();
				patternProcessor.processSlides();
				patternProcessor.processArpeggio();
				audioDriver.processInstruments(state, registerState);
				audioDriver.processPWMAutomation(state);
				audioDriver.savePWMOriginalVolumes(state, registerState);

				const isLastPattern =
					state.currentPatternOrderIndex >= state.patternOrder.length - 1;
				const isLastRow = state.currentRow >= state.currentPattern.length - 1;
				const isLastTick = state.currentTick >= state.currentSpeed - 1;

				if (isLastPattern && isLastRow && isLastTick) {
					break;
				}

				const needsPatternChange = state.advancePosition();
				if (needsPatternChange) {
					if (state.currentPatternOrderIndex >= state.patternOrder.length) {
						break;
					}
					if (state.currentPatternOrderIndex < patterns.length) {
						state.currentPattern = patterns[state.currentPatternOrderIndex];
					} else {
						break;
					}
				}

				state.sampleCounter = 0;
			}

			const chipFrequency = song.chipFrequency || DEFAULT_AYM_FREQUENCY;
			audioDriver.processPWMPerSample(state, registerState, chipFrequency, SAMPLE_RATE);
			ayumiEngine.applyRegisterState(registerState);

			ayumiEngine.process();
			ayumiEngine.removeDC();

			const leftOffset = ayumiPtr + AYUMI_STRUCT_LEFT_OFFSET;
			const rightOffset = ayumiPtr + AYUMI_STRUCT_RIGHT_OFFSET;

			const leftValue = new Float64Array(wasm.memory.buffer, leftOffset, 1)[0];
			const rightValue = new Float64Array(wasm.memory.buffer, rightOffset, 1)[0];

			leftSamples.push(leftValue);
			rightSamples.push(rightValue);
			totalSamples++;
			state.sampleCounter++;
		}

		return [new Float32Array(leftSamples), new Float32Array(rightSamples)];
	}

	async render(
		project: Project,
		songIndex: number,
		onProgress?: (progress: number, message: string) => void
	): Promise<Float32Array[]> {
		const song = project.songs[songIndex];
		if (!song || song.patterns.length === 0) {
			throw new Error('Song is empty');
		}

		const { wasm, wasmBuffer } = await this.loadWasmModule(onProgress);
		const ayumiPtr = this.initializeAyumi(wasm, song);
		const { AyumiState, TrackerPatternProcessor, AYAudioDriver, AyumiEngine, AYChipRegisterState } =
			await this.loadProcessorModules(onProgress);

		const state = new AyumiState();
		this.setupState(state, song, project, wasm, ayumiPtr, wasmBuffer);

		const audioDriver = new AYAudioDriver();
		const ayumiEngine = new AyumiEngine(wasm, ayumiPtr);
		const registerState = new AYChipRegisterState();
		const patternProcessor = new TrackerPatternProcessor(state, audioDriver, {
			postMessage: () => {}
		});

		const patternOrder = project.patternOrder || [0];
		const patterns = this.getPatterns(song, patternOrder);

		if (patterns.length === 0) {
			wasm.free(ayumiPtr);
			throw new Error('No patterns found');
		}

		state.currentPattern = patterns[0];
		state.currentPatternOrderIndex = 0;

		onProgress?.(50, 'Initializing renderer...');
		const totalRows = this.calculateTotalRows(song, patternOrder);

		try {
			const [leftChannel, rightChannel] = await this.renderAudioLoop(
				state,
				patternProcessor,
				audioDriver,
				ayumiEngine,
				registerState,
				wasm,
				ayumiPtr,
				song,
				totalRows,
				patterns,
				onProgress
			);

			wasm.free(ayumiPtr);
			onProgress?.(100, 'Rendering complete');
			return [leftChannel, rightChannel];
		} catch (error) {
			wasm.free(ayumiPtr);
			throw error;
		}
	}
}
