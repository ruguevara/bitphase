import AYChipRegisterState from './ay-chip-register-state.js';

class AyumiEngine {
	constructor(wasmModule, ayumiPtr) {
		this.wasmModule = wasmModule;
		this.ayumiPtr = ayumiPtr;
		this.lastState = new AYChipRegisterState();
		this.sidWaveformPtrs = [0, 0, 0];
		this.sidWaveformLengths = [0, 0, 0];
		this.syncbuzzerWaveformPtrs = [0, 0, 0];
		this.syncbuzzerWaveformLengths = [0, 0, 0];
		this.forceFullApply = false;
		this.lastSampleSidVolumes = [-1, -1, -1];
	}

	_ensureSidWaveformBuffer(channelIndex, length) {
		const needed = Math.max(length, 1) * 4;
		if (this.sidWaveformPtrs[channelIndex] && this.sidWaveformLengths[channelIndex] >= length) {
			return this.sidWaveformPtrs[channelIndex];
		}
		if (this.sidWaveformPtrs[channelIndex]) {
			this.wasmModule.free(this.sidWaveformPtrs[channelIndex]);
		}
		const ptr = this.wasmModule.malloc(needed);
		this.sidWaveformPtrs[channelIndex] = ptr;
		this.sidWaveformLengths[channelIndex] = length;
		return ptr;
	}

	_applySid(channelIndex, sid, lastSid, forceApply = false) {
		const enabled = sid.enabled ? 1 : 0;
		const period = sid.period > 0 ? sid.period : 1;
		const periodLow = sid.periodLow > 0 ? sid.periodLow : period;
		const pwm = sid.pwm ? 1 : 0;
		const baseVolume = sid.baseVolume & 0xf;
		const wasEnabled = lastSid.enabled ? 1 : 0;
		const wasPwm = lastSid.pwm ? 1 : 0;
		const enableChanged = enabled !== wasEnabled;
		const modeChanged = pwm !== wasPwm;

		if (pwm) {
			if (
				forceApply ||
				enableChanged ||
				modeChanged ||
				period !== lastSid.period ||
				periodLow !== lastSid.periodLow ||
				baseVolume !== lastSid.baseVolume
			) {
				this.wasmModule.ayumi_set_sid_pwm(
					this.ayumiPtr,
					channelIndex,
					enabled,
					period,
					periodLow,
					baseVolume
				);
				lastSid.enabled = sid.enabled;
				lastSid.pwm = sid.pwm;
				lastSid.period = period;
				lastSid.periodLow = periodLow;
				lastSid.baseVolume = baseVolume;
			}
		} else if (
			forceApply ||
			enableChanged ||
			modeChanged ||
			period !== lastSid.period ||
			baseVolume !== lastSid.baseVolume
		) {
			this.wasmModule.ayumi_set_sid(this.ayumiPtr, channelIndex, enabled, period, baseVolume);
			lastSid.enabled = sid.enabled;
			lastSid.pwm = false;
			lastSid.period = period;
			lastSid.periodLow = period;
			lastSid.baseVolume = baseVolume;
		}

		const waveform = sid.waveform ?? [15, 0];
		const waveformLoop = sid.waveformLoop ?? 0;
		const lastWaveform = lastSid.waveform ?? [15, 0];
		const waveformChanged =
			waveform.length !== lastWaveform.length ||
			waveformLoop !== (lastSid.waveformLoop ?? 0) ||
			waveform.some((value, index) => value !== lastWaveform[index]);

		if (
			sid.enabled &&
			waveform.length > 0 &&
			(forceApply || waveformChanged || enableChanged || modeChanged)
		) {
			const ptr = this._ensureSidWaveformBuffer(channelIndex, waveform.length);
			const memory = new Int32Array(this.wasmModule.memory.buffer);
			const offset = ptr >> 2;
			for (let i = 0; i < waveform.length; i++) {
				memory[offset + i] = waveform[i] & 0xf;
			}
			this.wasmModule.ayumi_set_sid_waveform(
				this.ayumiPtr,
				channelIndex,
				ptr,
				waveform.length,
				waveformLoop
			);
			lastSid.waveform = [...waveform];
			lastSid.waveformLoop = waveformLoop;
		}

		if (sid.resetPhase) {
			this.wasmModule.ayumi_sid_reset(this.ayumiPtr, channelIndex);
			sid.resetPhase = false;
		}
	}

	_ensureSyncbuzzerWaveformBuffer(channelIndex, length) {
		const needed = Math.max(length, 1) * 4;
		if (
			this.syncbuzzerWaveformPtrs[channelIndex] &&
			this.syncbuzzerWaveformLengths[channelIndex] >= length
		) {
			return this.syncbuzzerWaveformPtrs[channelIndex];
		}
		if (this.syncbuzzerWaveformPtrs[channelIndex]) {
			this.wasmModule.free(this.syncbuzzerWaveformPtrs[channelIndex]);
		}
		const ptr = this.wasmModule.malloc(needed);
		this.syncbuzzerWaveformPtrs[channelIndex] = ptr;
		this.syncbuzzerWaveformLengths[channelIndex] = length;
		return ptr;
	}

	_applySyncbuzzer(channelIndex, syncbuzzer, lastSyncbuzzer, forceApply = false) {
		const enabled = syncbuzzer.enabled ? 1 : 0;
		const period = syncbuzzer.period > 0 ? syncbuzzer.period : 1;
		const periodLow = syncbuzzer.periodLow > 0 ? syncbuzzer.periodLow : period;
		const pwm = syncbuzzer.pwm ? 1 : 0;
		const shape = syncbuzzer.shape & 0xf;
		const wasEnabled = lastSyncbuzzer.enabled ? 1 : 0;
		const wasPwm = lastSyncbuzzer.pwm ? 1 : 0;
		const enableChanged = enabled !== wasEnabled;
		const modeChanged = pwm !== wasPwm;

		if (pwm) {
			if (
				forceApply ||
				enableChanged ||
				modeChanged ||
				period !== lastSyncbuzzer.period ||
				periodLow !== lastSyncbuzzer.periodLow
			) {
				this.wasmModule.ayumi_set_syncbuzzer_pwm(
					this.ayumiPtr,
					channelIndex,
					enabled,
					period,
					periodLow
				);
				lastSyncbuzzer.enabled = syncbuzzer.enabled;
				lastSyncbuzzer.pwm = syncbuzzer.pwm;
				lastSyncbuzzer.period = period;
				lastSyncbuzzer.periodLow = periodLow;
			}
		} else if (
			forceApply ||
			enableChanged ||
			modeChanged ||
			period !== lastSyncbuzzer.period ||
			shape !== lastSyncbuzzer.shape
		) {
			this.wasmModule.ayumi_set_syncbuzzer(
				this.ayumiPtr,
				channelIndex,
				enabled,
				period,
				shape
			);
			lastSyncbuzzer.enabled = syncbuzzer.enabled;
			lastSyncbuzzer.pwm = false;
			lastSyncbuzzer.period = period;
			lastSyncbuzzer.periodLow = period;
			lastSyncbuzzer.shape = shape;
		}

		const waveform = syncbuzzer.waveform ?? [shape];
		const waveformLoop = syncbuzzer.waveformLoop ?? 0;
		const lastWaveform = lastSyncbuzzer.waveform ?? [lastSyncbuzzer.shape & 0xf];
		const waveformChanged =
			waveform.length !== lastWaveform.length ||
			waveformLoop !== (lastSyncbuzzer.waveformLoop ?? 0) ||
			waveform.some((value, index) => value !== lastWaveform[index]);

		if (
			syncbuzzer.enabled &&
			waveform.length > 0 &&
			(forceApply || waveformChanged || enableChanged || modeChanged)
		) {
			const ptr = this._ensureSyncbuzzerWaveformBuffer(channelIndex, waveform.length);
			const memory = new Int32Array(this.wasmModule.memory.buffer);
			const offset = ptr >> 2;
			for (let i = 0; i < waveform.length; i++) {
				memory[offset + i] = waveform[i] & 0xf;
			}
			this.wasmModule.ayumi_set_syncbuzzer_waveform(
				this.ayumiPtr,
				channelIndex,
				ptr,
				waveform.length,
				waveformLoop
			);
			lastSyncbuzzer.waveform = [...waveform];
			lastSyncbuzzer.waveformLoop = waveformLoop;
			lastSyncbuzzer.shape = waveform[0] & 0xf;
		}

		if (syncbuzzer.resetPhase) {
			this.wasmModule.ayumi_syncbuzzer_reset(this.ayumiPtr, channelIndex);
			syncbuzzer.resetPhase = false;
		}
	}

	applyRegisterState(state) {
		if (!this.wasmModule || !this.ayumiPtr) {
			return;
		}

		const forceApply = this.forceFullApply;
		this.forceFullApply = false;

		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			const channel = state.channels[channelIndex];
			const lastChannel = this.lastState.channels[channelIndex];
			if (!channel || !lastChannel) continue;

			if (forceApply || channel.tone !== lastChannel.tone) {
				this.wasmModule.ayumi_set_tone(this.ayumiPtr, channelIndex, channel.tone);
				lastChannel.tone = channel.tone;
			}

			if (forceApply || channel.volume !== lastChannel.volume) {
				this.wasmModule.ayumi_set_volume(this.ayumiPtr, channelIndex, channel.volume);
				lastChannel.volume = channel.volume;
			}

			const mixer = channel.mixer;
			const lastMixer = lastChannel.mixer;
			if (
				forceApply ||
				mixer.tone !== lastMixer.tone ||
				mixer.noise !== lastMixer.noise ||
				mixer.envelope !== lastMixer.envelope
			) {
				this.wasmModule.ayumi_set_mixer(
					this.ayumiPtr,
					channelIndex,
					mixer.tone ? 0 : 1,
					mixer.noise ? 0 : 1,
					mixer.envelope ? 1 : 0
				);
				lastMixer.tone = mixer.tone;
				lastMixer.noise = mixer.noise;
				lastMixer.envelope = mixer.envelope;
			}

			if (channel.sid) {
				this._applySid(channelIndex, channel.sid, lastChannel.sid, forceApply);
			}

			if (channel.syncbuzzer) {
				this._applySyncbuzzer(channelIndex, channel.syncbuzzer, lastChannel.syncbuzzer, forceApply);
			}
		}

		if (forceApply || state.noise !== this.lastState.noise) {
			this.wasmModule.ayumi_set_noise(this.ayumiPtr, state.noise);
			this.lastState.noise = state.noise;
		}

		if (forceApply || state.envelopePeriod !== this.lastState.envelopePeriod) {
			this.wasmModule.ayumi_set_envelope(this.ayumiPtr, state.envelopePeriod);
			this.lastState.envelopePeriod = state.envelopePeriod;
		}

		if (forceApply || state.forceEnvelopeShapeWrite || state.envelopeShape !== this.lastState.envelopeShape) {
			this.wasmModule.ayumi_set_envelope_shape(this.ayumiPtr, state.envelopeShape);
			this.lastState.envelopeShape = state.envelopeShape;
			state.forceEnvelopeShapeWrite = false;
		}
	}

	process() {
		if (!this.wasmModule || !this.ayumiPtr) {
			return;
		}
		this.wasmModule.ayumi_process(this.ayumiPtr);
	}

	removeDC() {
		if (!this.wasmModule || !this.ayumiPtr) {
			return;
		}
		this.wasmModule.ayumi_remove_dc(this.ayumiPtr);
	}

	applySampleSidVolume(channelIndex, volumeLevel) {
		if (!this.wasmModule || !this.ayumiPtr) {
			return;
		}
		const volume = volumeLevel & 0xf;
		if (this.lastSampleSidVolumes[channelIndex] === volume) {
			return;
		}
		this.lastSampleSidVolumes[channelIndex] = volume;
		const ptr = this._ensureSidWaveformBuffer(channelIndex, 1);
		const memory = new Int32Array(this.wasmModule.memory.buffer);
		const offset = ptr >> 2;
		memory[offset] = volume;
		this.wasmModule.ayumi_set_sid_waveform(this.ayumiPtr, channelIndex, ptr, 1, 0);
	}

	reset() {
		this.lastState.reset();
		this.lastSampleSidVolumes = [-1, -1, -1];
		this.forceFullApply = true;
	}

	dispose() {
		for (let i = 0; i < this.sidWaveformPtrs.length; i++) {
			if (this.sidWaveformPtrs[i]) {
				this.wasmModule.free(this.sidWaveformPtrs[i]);
				this.sidWaveformPtrs[i] = 0;
				this.sidWaveformLengths[i] = 0;
			}
		}
	}
}

export default AyumiEngine;
