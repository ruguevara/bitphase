import {
	AYUMI_STRUCT_SIZE,
	AYUMI_STRUCT_LEFT_OFFSET,
	AYUMI_STRUCT_RIGHT_OFFSET,
	AYUMI_STRUCT_CHANNEL_OUT_OFFSET,
	getPanSettingsForLayout,
	DEFAULT_AYM_FREQUENCY
} from './ayumi-constants.js';
import AYAudioDriver from './ay-audio-driver.js';
import AyumiEngine from './ayumi-engine.js';
import TrackerPatternProcessor from './tracker-pattern-processor.js';
import { Ay8910WorkletSlot } from './ay8910-worklet-slot.js';

export class AyumiSlot extends Ay8910WorkletSlot {
	constructor(port, chipIndex, sharedTimeline) {
		super(port, chipIndex, sharedTimeline);
		this.fadeInSamples = 0;
		this.fadeInDuration = 0.002;
		this.stereoLayout = 'ABC';
		this.channelWaveformBuf = [
			new Float32Array(512),
			new Float32Array(512),
			new Float32Array(512)
		];
		this.channelWaveformWriteIndex = 0;
		this.waveformPostCounter = 0;
		this.waveformPostInterval = 6;
	}

	async handleMessage(payload) {
		if (payload == null || typeof payload !== 'object') return;
		const { type, ...data } = payload;
		if (type === undefined) return;

		switch (type) {
			case 'init':
				await this.handleInit(data);
				break;
			case 'update_ay_frequency':
				this.handleUpdateAyFrequency(data);
				break;
			case 'update_int_frequency':
				this.handleUpdateIntFrequency(data);
				break;
			case 'update_chip_variant':
				this.handleUpdateChipVariant(data);
				break;
			case 'update_stereo_layout':
				this.handleUpdateStereoLayout(data);
				break;
			default:
				this.dispatchPortMessages(type, data);
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

			const aymFrequency = this.state.aymFrequency ?? DEFAULT_AYM_FREQUENCY;
			const isYM = this.state.isYM ?? 0;
			wasmModule.ayumi_configure(ayumiPtr, isYM, aymFrequency, sampleRate);

			this.applyPanSettings(wasmModule, ayumiPtr);

			this.state.setWasmModule(wasmModule, ayumiPtr, wasmBuffer);
			this.state.updateSamplesPerTick(sampleRate);
			this.audioDriver = new AYAudioDriver();
			this.ayumiEngine = new AyumiEngine(wasmModule, ayumiPtr);
			this.patternProcessor = new TrackerPatternProcessor(
				this.state,
				this.audioDriver,
				this.port
			);
			this._applyVirtualChannelResize();
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize Ayumi:', error);
		}
	}

	handleUpdateAyFrequency(data) {
		this.state.setAymFrequency(data.aymFrequency);
		this.handleInit({ wasmBuffer: this.state.wasmBuffer });
	}

	handleUpdateIntFrequency(data) {
		this.state.setIntFrequency(data.intFrequency, sampleRate);
	}

	handleUpdateChipVariant(data) {
		this.state.setChipVariant(data.chipVariant);
		this.handleInit({ wasmBuffer: this.state.wasmBuffer });
	}

	applyPanSettings(wasmModule, ayumiPtr) {
		if (!wasmModule || !ayumiPtr) return;
		const settings = getPanSettingsForLayout(this.stereoLayout);
		settings.forEach(({ channel, pan, isEqp }) => {
			wasmModule.ayumi_set_pan(ayumiPtr, channel, pan, isEqp);
		});
	}

	handleUpdateStereoLayout({ stereoLayout }) {
		this.stereoLayout = stereoLayout || 'ABC';
		if (this.state.wasmModule && this.state.ayumiPtr) {
			this.applyPanSettings(this.state.wasmModule, this.state.ayumiPtr);
		}
	}

	_prepareOutputForPlay() {
		this.fadeInSamples = Math.floor(sampleRate * this.fadeInDuration);
		this.registerState.reset();
		if (this.ayumiEngine) {
			this.ayumiEngine.reset();
			this._applyRegisterStateToEngine();
		}
	}

	resetChannelWaveformCapture() {
		for (const buf of this.channelWaveformBuf) {
			buf.fill(0);
		}
		this.channelWaveformWriteIndex = 0;
		this.waveformPostCounter = 0;
	}

	handleStop() {
		this.resetChannelWaveformCapture();
		super.handleStop();
	}

	handlePreviewRow(data) {
		this.resetChannelWaveformCapture();
		super.handlePreviewRow(data);
	}

	handleStopPreview(channel) {
		if (channel === undefined) {
			this.resetChannelWaveformCapture();
		}
		super.handleStopPreview(channel);
	}

	accumulateStereoOutput(sampleIndex, mix) {
		this.ayumiEngine.process();
		this.ayumiEngine.removeDC();

		const { wasmModule, ayumiPtr } = this.state;
		const leftOffset = ayumiPtr + AYUMI_STRUCT_LEFT_OFFSET;
		const rightOffset = ayumiPtr + AYUMI_STRUCT_RIGHT_OFFSET;
		const channelOutOffset = ayumiPtr + AYUMI_STRUCT_CHANNEL_OUT_OFFSET;

		const leftValue = new Float64Array(wasmModule.memory.buffer, leftOffset, 1)[0];
		const rightValue = new Float64Array(wasmModule.memory.buffer, rightOffset, 1)[0];

		const channelOut = new Float64Array(wasmModule.memory.buffer, channelOutOffset, 3);
		const wi = this.channelWaveformWriteIndex;
		for (let ch = 0; ch < 3; ch++) {
			this.channelWaveformBuf[ch][(wi + sampleIndex) % 512] = channelOut[ch];
		}

		let l = leftValue;
		let r = rightValue;
		if (this.fadeInSamples > 0) {
			const fadeInFactor = 1 - this.fadeInSamples / (sampleRate * this.fadeInDuration);
			l *= fadeInFactor;
			r *= fadeInFactor;
			this.fadeInSamples--;
		}
		mix.l += l;
		mix.r += r;
	}

	finishAudioBlock(numSamples) {
		if (this.paused && !this.isPreviewActive()) {
			this.finishAudioBlockFlushTransport(numSamples, this.paused);
			return;
		}
		this.channelWaveformWriteIndex = (this.channelWaveformWriteIndex + numSamples) % 512;
		this.waveformPostCounter++;
		if (this.waveformPostCounter >= this.waveformPostInterval) {
			this.waveformPostCounter = 0;
			const wi = this.channelWaveformWriteIndex;
			const channels = this.channelWaveformBuf.map((buf) => {
				const out = new Float32Array(512);
				for (let j = 0; j < 512; j++) {
					out[j] = buf[(wi + j) % 512];
				}
				return out;
			});
			this._post({ type: 'channel_waveform', channels });
		}

		this.finishAudioBlockFlushTransport(numSamples, this.paused);
	}
}
