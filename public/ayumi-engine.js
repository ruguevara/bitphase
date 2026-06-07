import AYChipRegisterState from './ay-chip-register-state.js';
import {
	TIMER_EFFECT_KIND_NONE,
	TIMER_EFFECT_KIND_TONE
} from './ay-timer-effect-constants.js';

class AyumiEngine {
	constructor(wasmModule, ayumiPtr) {
		this.wasmModule = wasmModule;
		this.ayumiPtr = ayumiPtr;
		this.lastState = new AYChipRegisterState();
		this.timerEffectWaveformPtrs = [0, 0, 0];
		this.timerEffectWaveformLengths = [0, 0, 0];
		this.forceFullApply = false;
		this.lastSampleSidVolumes = [-1, -1, -1];
	}

	_ensureTimerEffectWaveformBuffer(channelIndex, length) {
		const needed = Math.max(length, 1) * 4;
		if (
			this.timerEffectWaveformPtrs[channelIndex] &&
			this.timerEffectWaveformLengths[channelIndex] >= length
		) {
			return this.timerEffectWaveformPtrs[channelIndex];
		}
		if (this.timerEffectWaveformPtrs[channelIndex]) {
			this.wasmModule.free(this.timerEffectWaveformPtrs[channelIndex]);
		}
		const ptr = this.wasmModule.malloc(needed);
		this.timerEffectWaveformPtrs[channelIndex] = ptr;
		this.timerEffectWaveformLengths[channelIndex] = length;
		return ptr;
	}

	_applyTimerEffect(channelIndex, timerEffect, lastTimerEffect, forceApply = false) {
		const enabled = timerEffect.enabled ? 1 : 0;
		const kind = timerEffect.kind ?? TIMER_EFFECT_KIND_NONE;
		const pwmMode = timerEffect.pwmMode ?? 0;
		const period = timerEffect.period > 0 ? timerEffect.period : 1;
		const periodLow = timerEffect.periodLow > 0 ? timerEffect.periodLow : period;
		const baseVolume = timerEffect.baseVolume & 0xf;
		const baseTonePeriod = Math.max(1, timerEffect.baseTonePeriod & 0xfff);
		const wasEnabled = lastTimerEffect.enabled ? 1 : 0;
		const enableChanged = enabled !== wasEnabled;
		const kindChanged = kind !== (lastTimerEffect.kind ?? TIMER_EFFECT_KIND_NONE);
		const pwmModeChanged = pwmMode !== (lastTimerEffect.pwmMode ?? 0);
		const lastBaseTonePeriod = lastTimerEffect.baseTonePeriod ?? 1;

		if (
			forceApply ||
			enableChanged ||
			kindChanged ||
			pwmModeChanged ||
			period !== lastTimerEffect.period ||
			periodLow !== lastTimerEffect.periodLow ||
			baseVolume !== lastTimerEffect.baseVolume ||
			baseTonePeriod !== lastBaseTonePeriod
		) {
			this.wasmModule.ayumi_set_timer_effect(
				this.ayumiPtr,
				channelIndex,
				enabled,
				kind,
				pwmMode,
				period,
				periodLow,
				baseVolume,
				baseTonePeriod
			);
			lastTimerEffect.enabled = timerEffect.enabled;
			lastTimerEffect.kind = kind;
			lastTimerEffect.pwmMode = pwmMode;
			lastTimerEffect.period = period;
			lastTimerEffect.periodLow = periodLow;
			lastTimerEffect.baseVolume = baseVolume;
			lastTimerEffect.baseTonePeriod = baseTonePeriod;
		}

		const waveform = timerEffect.waveform ?? [15, 0];
		const waveformLoop = timerEffect.waveformLoop ?? 0;
		const lastWaveform = lastTimerEffect.waveform ?? [15, 0];
		const waveformChanged =
			waveform.length !== lastWaveform.length ||
			waveformLoop !== (lastTimerEffect.waveformLoop ?? 0) ||
			waveform.some((value, index) => value !== lastWaveform[index]);

		if (
			timerEffect.enabled &&
			waveform.length > 0 &&
			(forceApply || waveformChanged || enableChanged || kindChanged || pwmModeChanged)
		) {
			const ptr = this._ensureTimerEffectWaveformBuffer(channelIndex, waveform.length);
			const memory = new Int32Array(this.wasmModule.memory.buffer);
			const offset = ptr >> 2;
			for (let i = 0; i < waveform.length; i++) {
				const raw = waveform[i] | 0;
				if (kind === TIMER_EFFECT_KIND_TONE) {
					memory[offset + i] = Math.max(-127, Math.min(128, raw));
				} else {
					memory[offset + i] = raw & 0xf;
				}
			}
			this.wasmModule.ayumi_set_timer_effect_waveform(
				this.ayumiPtr,
				channelIndex,
				ptr,
				waveform.length,
				waveformLoop
			);
			lastTimerEffect.waveform = [...waveform];
			lastTimerEffect.waveformLoop = waveformLoop;
		}

		if (timerEffect.resetPhase) {
			this.wasmModule.ayumi_timer_effect_reset(this.ayumiPtr, channelIndex);
			timerEffect.resetPhase = false;
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

			if (channel.timerEffect) {
				this._applyTimerEffect(
					channelIndex,
					channel.timerEffect,
					lastChannel.timerEffect,
					forceApply
				);
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
		const ptr = this._ensureTimerEffectWaveformBuffer(channelIndex, 1);
		const memory = new Int32Array(this.wasmModule.memory.buffer);
		const offset = ptr >> 2;
		memory[offset] = volume;
		this.wasmModule.ayumi_set_timer_effect_waveform(this.ayumiPtr, channelIndex, ptr, 1, 0);
	}

	reset() {
		this.lastState.reset();
		this.lastSampleSidVolumes = [-1, -1, -1];
		this.forceFullApply = true;
	}

	dispose() {
		for (let i = 0; i < this.timerEffectWaveformPtrs.length; i++) {
			if (this.timerEffectWaveformPtrs[i]) {
				this.wasmModule.free(this.timerEffectWaveformPtrs[i]);
				this.timerEffectWaveformPtrs[i] = 0;
				this.timerEffectWaveformLengths[i] = 0;
			}
		}
	}
}

export default AyumiEngine;
