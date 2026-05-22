import AyumiState from './ayumi-state.js';
import TrackerPatternProcessor from './tracker-pattern-processor.js';
import AYAudioDriver from './ay-audio-driver.js';
import AyumiEngine from './ayumi-engine.js';
import AYChipRegisterState from './ay-chip-register-state.js';
import VirtualChannelMixer from './virtual-channel-mixer.js';
import { WorkletSlotBase } from './worklet-slot-base.js';

export class Ay8910WorkletSlot extends WorkletSlotBase {
	constructor(port, chipIndex, sharedTimeline) {
		super(port, chipIndex);
		this.state = new AyumiState(3, sharedTimeline);
		this.initialized = false;
		this.audioDriver = null;
		this.patternProcessor = null;
		this.ayumiEngine = null;
		this.registerState = new AYChipRegisterState();
		this.virtualChannelMixer = new VirtualChannelMixer();
		this.virtualChannelMap = {};
		this.hwChannelCount = 3;
		this.previewActiveChannels = new Set();
		this.previewTickSampleCounter = 0;
	}

	_slotState() {
		return this.state;
	}

	_isReadyForPlayback() {
		return this.initialized && this.state.wasmModule && this.state.ayumiPtr;
	}

	_resizeForPatternChannels(n) {
		this._ensureChannelCapacity(n);
	}

	_applyPlaybackSpeed(speed) {
		if (!(speed > 0)) return;
		this.state.publishPlaybackSpeed(speed);
	}

	_replayCatchUpSegments(catchUpSegments) {
		if (
			!catchUpSegments?.length ||
			!this.patternProcessor ||
			!this.audioDriver ||
			!this.ayumiEngine
		) {
			return;
		}
		for (const segment of catchUpSegments) {
			if (segment.pattern?.channels?.length) {
				this._ensureChannelCapacity(segment.pattern.channels.length);
			}
			this.state.setPattern(segment.pattern, segment.patternOrderIndex);
			const numRows = segment.numRows ?? 0;
			for (let r = 0; r < numRows; r++) {
				this._simulateRow(this.state.currentPattern, r);
			}
		}
	}

	_runCatchUpRows(upToRow) {
		if (
			!this.state.currentPattern ||
			this.state.currentPattern.length === 0 ||
			upToRow <= 0 ||
			!this.patternProcessor ||
			!this.audioDriver ||
			!this.ayumiEngine
		) {
			return;
		}
		for (let r = 0; r < upToRow; r++) {
			this._simulateRow(this.state.currentPattern, r);
		}
	}

	_onTransportStop() {
		this.registerState.reset();
		if (this.audioDriver) {
			this.audioDriver.resetChannelMixerState();
		}
		if (this.ayumiEngine) {
			this.ayumiEngine.reset();
		}
		this._applyRegisterStateToEngine();
	}

	_afterTransportStop() {
		this.handleStopPreview();
	}

	_preparePatternWorkersForPlay() {
		this.ensurePlaybackWorkers();
		this.enforceMuteState();
	}

	dispatchPortMessages(type, data) {
		switch (type) {
			case 'play':
				this.handlePlay(data);
				break;
			case 'play_from_row':
				this.handlePlayFromRow(data);
				break;
			case 'play_from_position':
				this.handlePlayFromPosition(data);
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
			case 'change_pattern_during_playback':
				this.handleChangePatternDuringPlayback(data);
				break;
			case 'preview_row':
				this.handlePreviewRow(data);
				break;
			case 'stop_preview':
				this.handleStopPreview(data.channel);
				break;
			case 'set_virtual_channel_config':
				this.handleSetVirtualChannelConfig(data);
				break;
			case 'set_channel_mute':
				this.handleSetChannelMute(data);
				break;
			default:
				break;
		}
	}

	handleInitTuningTable(data) {
		this.state.setTuningTable(data.tuningTable);
	}

	handleInitSpeed(data) {
		const speed = data.speed;
		if (!(speed > 0)) return;
		this.state.publishPlaybackSpeed(speed);
	}

	handleInitTables(data) {
		this.state.setTables(data.tables);
	}

	handleInitInstruments(data) {
		this.state.setInstruments(data.instruments);
	}

	applyChannelSilent(registerState, channelIndex) {
		registerState.channels[channelIndex].volume = 0;
		registerState.channels[channelIndex].mixer = {
			tone: false,
			noise: false,
			envelope: false
		};
		if (registerState.channels[channelIndex].sid) {
			registerState.channels[channelIndex].sid.enabled = false;
		}
		if (registerState.channels[channelIndex].syncbuzzer) {
			registerState.channels[channelIndex].syncbuzzer.enabled = false;
		}
	}

	handleSetVirtualChannelConfig({ virtualChannelMap, hwChannelCount }) {
		this.virtualChannelMap = virtualChannelMap || {};
		this.hwChannelCount = hwChannelCount || 3;
		this.virtualChannelMixer.configure(this.virtualChannelMap, this.hwChannelCount);

		const totalChannels = this.virtualChannelMixer.getTotalVirtualChannelCount();
		this.state.resizeChannels(totalChannels);
		this.registerState.resize(totalChannels);
		if (this.audioDriver) {
			this.audioDriver.resizeChannels(totalChannels);
		}
	}

	handleSetChannelMute({ channelIndex, muted }) {
		const totalChannels = this.virtualChannelMixer.getTotalVirtualChannelCount();
		if (channelIndex >= 0 && channelIndex < totalChannels) {
			this.state.channelMuted[channelIndex] = muted;
			if (muted) {
				this.applyChannelSilent(this.registerState, channelIndex);
				this.state.channelEnvelopeEnabled[channelIndex] = false;
				if (this.ayumiEngine) {
					this._applyRegisterStateToEngine();
				}
			}
		}
	}

	_simulateRow(pattern, rowIndex) {
		this.patternProcessor.parsePatternRow(pattern, rowIndex, this.registerState);
		this.patternProcessor.processSpeedTable();
		const ticksPerRow = this.state.timeline.currentSpeed;
		for (let tick = 0; tick < ticksPerRow; tick++) {
			this.patternProcessor.processTables();
			this.patternProcessor.processArpeggio();
			this.patternProcessor.processEffectTables();
			this.audioDriver.processInstruments(this.state, this.registerState);
			this.patternProcessor.processVibrato();
			this.patternProcessor.processSlides();
		}
		this._applyRegisterStateToEngine();
	}

	_applyRegisterStateToEngine() {
		if (!this.ayumiEngine) return;
		if (this.virtualChannelMixer.hasVirtualChannels()) {
			const hwState = this.virtualChannelMixer.merge(this.registerState, this.state);
			this.ayumiEngine.applyRegisterState(hwState);
			this.registerState.forceEnvelopeShapeWrite = false;
		} else {
			this.ayumiEngine.applyRegisterState(this.registerState);
		}
	}

	_applyVirtualChannelResize() {
		if (!this.virtualChannelMixer.hasVirtualChannels()) return;
		const totalChannels = this.virtualChannelMixer.getTotalVirtualChannelCount();
		this.state.resizeChannels(totalChannels);
		this.registerState.resize(totalChannels);
		if (this.audioDriver) {
			this.audioDriver.resizeChannels(totalChannels);
		}
	}

	_ensureChannelCapacity(channelCount) {
		if (channelCount <= this.registerState.channelCount) return;
		this.state.resizeChannels(channelCount);
		this.registerState.resize(channelCount);
		if (this.audioDriver) {
			this.audioDriver.resizeChannels(channelCount);
		}
	}

	enforceMuteState() {
		const totalChannels = this.registerState.channelCount;
		for (let ch = 0; ch < totalChannels; ch++) {
			if (this.state.channelMuted[ch]) {
				this.applyChannelSilent(this.registerState, ch);
				this.state.channelEnvelopeEnabled[ch] = false;
			}
		}
		this._applyRegisterStateToEngine();
	}

	ensurePlaybackWorkers() {
		if (!this.audioDriver || !this.patternProcessor || !this.ayumiEngine) {
			this.audioDriver = new AYAudioDriver();
			this.ayumiEngine = new AyumiEngine(this.state.wasmModule, this.state.ayumiPtr);
			this.patternProcessor = new TrackerPatternProcessor(
				this.state,
				this.audioDriver,
				this.port
			);
			this._applyVirtualChannelResize();
		}
	}

	handlePreviewRow({ pattern, rowIndex, instrument }) {
		if (!this.initialized || !this.state.wasmModule) {
			return;
		}
		this.paused = true;
		if (!pattern || !pattern.channels || !pattern.patternRows || rowIndex < 0) {
			return;
		}
		if (rowIndex >= pattern.length) {
			return;
		}
		if (!this.audioDriver || !this.patternProcessor || !this.ayumiEngine) {
			return;
		}
		if (pattern.channels.length) {
			this._ensureChannelCapacity(pattern.channels.length);
		}
		if (instrument) {
			this.state.setInstruments([instrument]);
		}

		this.state.reset({ resetTimeline: false });
		this.registerState.reset();
		if (this.audioDriver) {
			this.audioDriver.resetChannelMixerState();
		}
		if (this.ayumiEngine) {
			this.ayumiEngine.reset();
		}

		for (let r = 0; r < rowIndex; r++) {
			this._simulateRow(pattern, r);
		}
		this.patternProcessor.parsePatternRow(pattern, rowIndex, this.registerState);
		this.patternProcessor.processTables();
		this.audioDriver.processInstruments(this.state, this.registerState);
		this._applyRegisterStateToEngine();

		const totalChannels = this.registerState.channelCount;
		this.previewActiveChannels = new Set();
		for (let ch = 0; ch < totalChannels; ch++) {
			this.previewActiveChannels.add(ch);
		}
		this.previewTickSampleCounter = 0;
	}

	handleStopPreview(channel) {
		if (channel !== undefined) {
			this.previewActiveChannels.delete(channel);
			this.applyChannelSilent(this.registerState, channel);
			this.state.channelSoundEnabled[channel] = false;
			this._applyRegisterStateToEngine();
		} else {
			this.previewActiveChannels.clear();
			this.registerState.reset();
			if (this.audioDriver) {
				this.audioDriver.resetChannelMixerState();
			}
			if (this.ayumiEngine) {
				this.ayumiEngine.reset();
			}
			this._applyRegisterStateToEngine();
		}
	}

	canRender() {
		return this.initialized && this.state.wasmModule && this.state.ayumiPtr;
	}

	isPreviewActive() {
		return this.previewActiveChannels.size > 0;
	}

	runSharedPlaybackQuantum() {
		if (!this.state.currentPattern || this.state.currentPattern.length === 0) return;
		if (this.state.timeline.currentTick === 0) {
			this.timelinePattern.maybeRequestPrefetchForSharedTimeline(
				this.state.currentPattern,
				this.state.timeline
			);

			if (this.state.currentPattern.channels) {
				this._ensureChannelCapacity(this.state.currentPattern.channels.length);
			}
			this.patternProcessor.parsePatternRow(
				this.state.currentPattern,
				this.state.timeline.currentRow,
				this.registerState
			);
			this.patternProcessor.processSpeedTable();

			this.timelinePattern.queueOrSendPositionUpdate();
		}

		this.enforceMuteState();

		this.patternProcessor.processTables();
		this.patternProcessor.processArpeggio();
		this.patternProcessor.processEffectTables();
		this.audioDriver.processInstruments(this.state, this.registerState);
		this.patternProcessor.processVibrato();
		this.patternProcessor.processSlides();

		this.enforceMuteState();

		this._applyRegisterStateToEngine();
	}

	runPreviewStep() {
		this.previewTickSampleCounter++;
		if (this.previewTickSampleCounter >= this.state.timeline.samplesPerTick) {
			this.previewTickSampleCounter = 0;
			this.patternProcessor.processTables();
			if (this.state.channelInstruments) {
				this.audioDriver.processInstruments(this.state, this.registerState);
			}
		}
		this._applyRegisterStateToEngine();
	}
}
