import {
	AYUMI_STRUCT_SIZE,
	AYUMI_STRUCT_LEFT_OFFSET,
	AYUMI_STRUCT_RIGHT_OFFSET,
	PAN_SETTINGS,
	DEFAULT_AYM_FREQUENCY
} from './ayumi-constants.js';
import AyumiState from './ayumi-state.js';
import TrackerPatternProcessor from './tracker-pattern-processor.js';
import AYAudioDriver from './ay-audio-driver.js';
import AyumiEngine from './ayumi-engine.js';
import AYChipRegisterState from './ay-chip-register-state.js';

class AyumiProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.initialized = false;
		this.state = new AyumiState();
		this.audioDriver = null;
		this.patternProcessor = null;
		this.ayumiEngine = null;
		this.registerState = new AYChipRegisterState();
		this.port.onmessage = this.handleMessage.bind(this);
		this.aymFrequency = 1773400;
		this.paused = true;
		this.fadeInSamples = 0;
		this.fadeInDuration = 0.01;
		this.previewActiveChannels = new Set();
		this.previewSampleCounters = new Map();
		this.pendingRowAfterPatternChange = null;
	}

	async handleMessage(event) {
		const { type, ...data } = event.data;

		switch (type) {
			case 'init':
				await this.handleInit(data);
				break;
			case 'play':
				this.handlePlay(data);
				break;
			case 'play_from_row':
				this.handlePlayFromRow(data);
				break;
			case 'stop':
				this.handleStop();
				break;
			case 'init_pattern':
				this.handleInitPattern(data);
				break;
			case 'update_order':
				this.handleUpdateOrder(data);
				break;
			case 'set_pattern_data':
				this.handleSetPatternData(data);
				break;
			case 'init_tuning_table':
				this.handleInitTuningTable(data);
				break;
			case 'init_speed':
				this.handleInitSpeed(data);
				break;
			case 'init_tables':
				this.handleInitTables(data);
				break;
			case 'init_instruments':
				this.handleInitInstruments(data);
				break;
			case 'update_ay_frequency':
				this.handleUpdateAyFrequency(data);
				break;
			case 'update_int_frequency':
				this.handleUpdateIntFrequency(data);
				break;
			case 'set_channel_mute':
				this.handleSetChannelMute(data);
				break;
			case 'change_pattern_during_playback':
				this.handleChangePatternDuringPlayback(data);
				break;
			case 'preview_note':
				this.handlePreviewNote(data);
				break;
			case 'stop_preview':
				this.handleStopPreview(data.channel);
				break;
		}
	}

	async handleInit({ wasmBuffer }) {
		if (!wasmBuffer) return;

		try {
			const result = await WebAssembly.instantiate(wasmBuffer, {
				env: { emscripten_notify_memory_growth: () => {} }
			});

			const wasmModule = result.instance.exports;
			const ayumiPtr = wasmModule.malloc(AYUMI_STRUCT_SIZE);

			this.aymFrequency = this.state.aymFrequency ?? DEFAULT_AYM_FREQUENCY;
			wasmModule.ayumi_configure(ayumiPtr, 0, this.aymFrequency, sampleRate);

			PAN_SETTINGS.forEach(({ channel, left, right }) => {
				wasmModule.ayumi_set_pan(ayumiPtr, channel, left, right);
			});

			this.state.setWasmModule(wasmModule, ayumiPtr, wasmBuffer);
			this.state.updateSamplesPerTick(sampleRate);
			this.audioDriver = new AYAudioDriver();
			this.ayumiEngine = new AyumiEngine(wasmModule, ayumiPtr);
			this.patternProcessor = new TrackerPatternProcessor(
				this.state,
				this.audioDriver,
				this.port
			);
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize Ayumi:', error);
		}
	}

	handleInitTuningTable(data) {
		this.state.setTuningTable(data.tuningTable);
	}

	handleInitSpeed(data) {
		this.state.setSpeed(data.speed);
	}

	handleInitTables(data) {
		this.state.setTables(data.tables);
	}

	handleInitInstruments(data) {
		this.state.setInstruments(data.instruments);
	}

	handleInitPattern(data) {
		if (
			data.patternOrderIndex !== undefined &&
			this.state.currentPatternOrderIndex !== data.patternOrderIndex
		) {
			this.state.currentPattern = null;
		}
		this.state.setPattern(data.pattern, data.patternOrderIndex);
	}

	handleUpdateOrder(data) {
		this.state.setPatternOrder(data.order);
	}

	handleSetPatternData(data) {
		this.state.setPattern(data.pattern, data.patternOrderIndex);

		// If we have a pending row from a pattern change, apply it now (clamping handled by setPattern)
		if (this.pendingRowAfterPatternChange !== null) {
			this.state.currentRow = this.pendingRowAfterPatternChange;
			this.state.currentTick = 0;
			this.state.sampleCounter = this.state.samplesPerTick;
			this.pendingRowAfterPatternChange = null;
		}
	}

	handleUpdateAyFrequency(data) {
		this.state.setAymFrequency(data.aymFrequency);
		this.handleInit({ wasmBuffer: this.state.wasmBuffer });
	}

	handleUpdateIntFrequency(data) {
		this.state.setIntFrequency(data.intFrequency, sampleRate);
	}

	handleSetChannelMute({ channelIndex, muted }) {
		if (channelIndex >= 0 && channelIndex < 3) {
			this.state.channelMuted[channelIndex] = muted;
			if (muted) {
				this.registerState.channels[channelIndex].volume = 0;
				this.registerState.channels[channelIndex].mixer = {
					tone: false,
					noise: false,
					envelope: false
				};
				this.state.channelEnvelopeEnabled[channelIndex] = false;
				if (this.ayumiEngine) {
					this.ayumiEngine.applyRegisterState(this.registerState);
				}
			}
		}
	}

	handleChangePatternDuringPlayback({ row, patternOrderIndex, pattern, speed }) {
		if (!this.state.wasmModule || !this.initialized || this.paused) {
			return;
		}

		let patternChanged = false;

		if (patternOrderIndex !== undefined) {
			const patternOrderChanged = this.state.currentPatternOrderIndex !== patternOrderIndex;
			this.state.currentPatternOrderIndex = patternOrderIndex;

			if (pattern) {
				this.state.setPattern(pattern, patternOrderIndex);
				patternChanged = true;
			} else if (patternOrderChanged && !this.state.currentPattern) {
				this.port.postMessage({
					type: 'request_pattern',
					patternOrderIndex: patternOrderIndex
				});
				// Store pending row to be applied when pattern arrives
				if (row !== undefined) {
					this.pendingRowAfterPatternChange = row;
				}
			}
		} else if (pattern) {
			this.state.setPattern(pattern, this.state.currentPatternOrderIndex);
			patternChanged = true;
		}

		// Handle speed changes
		if (speed !== undefined && speed !== null && speed > 0) {
			this.state.setSpeed(speed);
		}

		// Handle row changes - row clamping is now handled in TrackerState.setPattern
		if (row !== undefined && (patternChanged || this.state.currentPattern)) {
			this.state.currentRow = row;
			this.state.currentTick = 0;
			this.state.sampleCounter = this.state.samplesPerTick;
		} else if (row !== undefined && !patternChanged) {
			// If we're changing pattern order but don't have the pattern yet,
			// store the row to be applied when the pattern arrives
			this.pendingRowAfterPatternChange = row;
		}
	}

	handlePlay({ startPatternOrderIndex, initialSpeed }) {
		if (!this.state.wasmModule || !this.initialized) {
			console.warn('Play aborted: wasmModule not initialized');
			return;
		}

		this.paused = false;
		this.fadeInSamples = Math.floor(sampleRate * this.fadeInDuration);
		this.registerState.reset();
		if (this.ayumiEngine) {
			this.ayumiEngine.reset();
			this.ayumiEngine.applyRegisterState(this.registerState);
		}

		this.state.reset();
		if (!this.audioDriver || !this.patternProcessor || !this.ayumiEngine) {
			this.audioDriver = new AYAudioDriver();
			this.ayumiEngine = new AyumiEngine(this.state.wasmModule, this.state.ayumiPtr);
			this.patternProcessor = new TrackerPatternProcessor(
				this.state,
				this.audioDriver,
				this.port
			);
		}

		this.enforceMuteState();

		if (startPatternOrderIndex !== undefined) {
			this.state.currentPatternOrderIndex = startPatternOrderIndex;
		}
		if (initialSpeed !== undefined) {
			this.state.setSpeed(initialSpeed);
		}
	}

	handlePlayFromRow({ row, patternOrderIndex, speed }) {
		if (!this.state.wasmModule || !this.initialized) {
			console.warn('Play aborted: wasmModule not initialized');
			return;
		}

		this.paused = false;
		this.fadeInSamples = Math.floor(sampleRate * this.fadeInDuration);
		this.registerState.reset();
		if (this.ayumiEngine) {
			this.ayumiEngine.reset();
			this.ayumiEngine.applyRegisterState(this.registerState);
		}

		this.state.reset();
		if (!this.audioDriver || !this.patternProcessor || !this.ayumiEngine) {
			this.audioDriver = new AYAudioDriver();
			this.ayumiEngine = new AyumiEngine(this.state.wasmModule, this.state.ayumiPtr);
			this.patternProcessor = new TrackerPatternProcessor(
				this.state,
				this.audioDriver,
				this.port
			);
		}

		this.enforceMuteState();

		if (patternOrderIndex !== undefined) {
			if (this.state.currentPatternOrderIndex !== patternOrderIndex) {
				this.state.currentPattern = null;
			}
			this.state.currentPatternOrderIndex = patternOrderIndex;
			this.port.postMessage({
				type: 'request_pattern',
				patternOrderIndex: patternOrderIndex
			});
		}
		this.state.currentRow = row;
		if (speed !== undefined && speed !== null && speed > 0) {
			this.state.setSpeed(speed);
		}
	}

	enforceMuteState() {
		for (let ch = 0; ch < 3; ch++) {
			if (this.state.channelMuted[ch]) {
				this.registerState.channels[ch].volume = 0;
				this.registerState.channels[ch].mixer = {
					tone: false,
					noise: false,
					envelope: false
				};
				this.state.channelEnvelopeEnabled[ch] = false;
			}
		}
		if (this.ayumiEngine) {
			this.ayumiEngine.applyRegisterState(this.registerState);
		}
	}

	handleStop() {
		this.paused = true;
		this.registerState.reset();
		if (this.ayumiEngine) {
			this.ayumiEngine.applyRegisterState(this.registerState);
		}
		this.state.reset();
		this.state.currentPattern = null;
		this.handleStopPreview();
	}

	handlePreviewNote({ note, channel, rowData }) {
		if (!this.paused || !this.initialized || !this.state.wasmModule) {
			return;
		}

		this.previewActiveChannels.add(channel);
		this.previewSampleCounters.set(channel, this.state.samplesPerTick);

		if (note >= 0 && note < this.state.currentTuningTable.length) {
			const toneValue = this.state.currentTuningTable[note];
			this.registerState.channels[channel].tone = toneValue;
		}

		const volume = this.getNumericValue(rowData.volume, 16, 0xf);
		this.registerState.channels[channel].volume = volume;
		this.registerState.channels[channel].mixer = {
			tone: true,
			noise: false,
			envelope: false
		};

		const instrumentId = rowData.instrument;
		if (instrumentId !== undefined && instrumentId !== null) {
			const instrumentIdNumber =
				typeof instrumentId === 'string' ? parseInt(instrumentId, 10) : instrumentId;
			const instrumentIndex = this.state.instrumentIdToIndex.get(instrumentIdNumber);

			if (instrumentIndex !== undefined && this.state.instruments[instrumentIndex]) {
				this.state.channelInstruments[channel] = instrumentIndex;
				this.state.instrumentPositions[channel] = 0;
				this.state.channelSoundEnabled[channel] = true;
				this.state.channelCurrentNotes[channel] = note;
				this.state.channelPatternVolumes[channel] = volume;
				this.audioDriver.resetInstrumentAccumulators(this.state, channel);
			} else {
				this.state.channelInstruments[channel] = -1;
			}
		} else {
			this.state.channelInstruments[channel] = -1;
		}

		this.state.channelBaseNotes[channel] = note;

		const table = rowData.table;
		if (table !== null && table !== undefined && table !== 0) {
			const tableNumber = typeof table === 'string' ? parseInt(table, 10) : table;
			const tableIndex = tableNumber - 1;

			if (this.state.tables && this.state.tables[tableIndex]) {
				this.state.channelTables[channel] = tableIndex;
				this.state.tablePositions[channel] = 0;
				this.state.tableCounters[channel] = 0;
			} else {
				this.state.channelTables[channel] = -1;
			}
		} else {
			this.state.channelTables[channel] = -1;
		}

		if (this.ayumiEngine) {
			this.ayumiEngine.applyRegisterState(this.registerState);
		}
	}

	getNumericValue(value, radix, defaultValue) {
		if (value === undefined || value === null) return defaultValue;
		if (typeof value === 'number') return value;
		if (typeof value === 'string') return parseInt(value, radix);
		return defaultValue;
	}

	handleStopPreview(channel) {
		if (channel !== undefined) {
			this.previewActiveChannels.delete(channel);
			this.previewSampleCounters.delete(channel);
			this.registerState.channels[channel].volume = 0;
			this.registerState.channels[channel].mixer = {
				tone: false,
				noise: false,
				envelope: false
			};
			this.state.channelSoundEnabled[channel] = false;

			if (this.ayumiEngine) {
				this.ayumiEngine.applyRegisterState(this.registerState);
			}
		} else {
			this.previewActiveChannels.clear();
			this.previewSampleCounters.clear();
		}
	}

	process(_inputs, outputs, _parameters) {
		if (!this.initialized || !this.state.wasmModule || !this.state.ayumiPtr) {
			console.error('Processor not initialized or missing dependencies');
			return true;
		}

		if (outputs.length > 0 && outputs[0].length > 1) {
			const output = outputs[0];
			const leftChannel = output[0];
			const rightChannel = output[1];
			const numSamples = leftChannel.length;

			if (this.paused && this.previewActiveChannels.size === 0) {
				for (let i = 0; i < numSamples; i++) {
					leftChannel[i] = 0;
					rightChannel[i] = 0;
				}
				return true;
			}

			for (let i = 0; i < numSamples; i++) {
				if (this.previewActiveChannels.size > 0) {
					for (const channel of this.previewActiveChannels) {
						const counter = this.previewSampleCounters.get(channel);
						if (counter >= this.state.samplesPerTick) {
							this.patternProcessor.processTables();
							if (
								this.state.channelInstruments &&
								this.state.channelInstruments[channel] >= 0
							) {
								this.audioDriver.processInstruments(this.state, this.registerState);
							}
							this.audioDriver.processPWMAutomation(this.state);
							this.audioDriver.savePWMOriginalVolumes(this.state, this.registerState);
							this.previewSampleCounters.set(channel, 0);
						} else {
							this.previewSampleCounters.set(channel, counter + 1);
						}
					}
					this.ayumiEngine.applyRegisterState(this.registerState);
				} else if (
					this.state.currentPattern &&
					this.state.currentPattern.length > 0 &&
					this.state.sampleCounter >= this.state.samplesPerTick
				) {
					if (this.state.currentTick === 0) {
						this.patternProcessor.parsePatternRow(
							this.state.currentPattern,
							this.state.currentRow,
							this.registerState
						);

						this.port.postMessage({
							type: 'position_update',
							currentRow: this.state.currentRow,
							currentTick: this.state.currentTick,
							currentPatternOrderIndex: this.state.currentPatternOrderIndex
						});
					}

					this.enforceMuteState();

					this.patternProcessor.processTables();
					this.patternProcessor.processSlides();
					this.patternProcessor.processArpeggio();
					this.audioDriver.processInstruments(this.state, this.registerState);
					this.audioDriver.processPWMAutomation(this.state);
					this.audioDriver.savePWMOriginalVolumes(this.state, this.registerState);

					this.enforceMuteState();

					const needsPatternChange = this.state.advancePosition();
					if (needsPatternChange) {
						this.port.postMessage({
							type: 'request_pattern',
							patternOrderIndex: this.state.currentPatternOrderIndex
						});
					}

					this.state.sampleCounter = 0;
				}

				this.audioDriver.processPWMPerSample(
					this.state,
					this.registerState,
					this.aymFrequency,
					sampleRate
				);
				this.ayumiEngine.applyRegisterState(this.registerState);

				this.ayumiEngine.process();
				this.ayumiEngine.removeDC();

				const { wasmModule, ayumiPtr } = this.state;
				const leftOffset = ayumiPtr + AYUMI_STRUCT_LEFT_OFFSET;
				const rightOffset = ayumiPtr + AYUMI_STRUCT_RIGHT_OFFSET;

				const leftValue = new Float64Array(wasmModule.memory.buffer, leftOffset, 1)[0];
				const rightValue = new Float64Array(wasmModule.memory.buffer, rightOffset, 1)[0];

				// Apply fade-in if needed
				if (this.fadeInSamples > 0) {
					const fadeInFactor =
						1 - this.fadeInSamples / (sampleRate * this.fadeInDuration);
					leftChannel[i] = leftValue * fadeInFactor;
					rightChannel[i] = rightValue * fadeInFactor;
					this.fadeInSamples--;
				} else {
					leftChannel[i] = leftValue;
					rightChannel[i] = rightValue;
				}

				this.state.sampleCounter++;
			}
		} else {
			console.error('Invalid output configuration');
		}
		return true;
	}
}

registerProcessor('ayumi-processor', AyumiProcessor);
