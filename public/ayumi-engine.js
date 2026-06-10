import AYChipRegisterState from './ay-chip-register-state.js';
import {
	TIMER_EFFECT_TARGET_NONE,
	TIMER_EFFECT_TARGET_VOLUME,
	TIMER_EFFECT_TARGET_ENVELOPE_SHAPE,
	TIMER_EFFECT_TARGET_TONE,
	TIMER_EFFECT_TARGET_ENVELOPE_PERIOD,
	TIMER_FM_OFFSET_PERIOD,
	resolveTimerFmOffsetMode
} from './ay-timer-effect-constants.js';
import {
	AY_FM_PERIOD_OFFSET_MAX,
	AY_FM_PERIOD_OFFSET_MIN,
	AY_FM_SEMITONE_MAX,
	AY_FM_SEMITONE_MIN
} from './ay-instrument-utils.js';

const TIMER_EFFECT_WAVEFORM_TARGETS = [
	{
		target: TIMER_EFFECT_TARGET_VOLUME,
		waveformKey: 'volumeWaveform',
		loopKey: 'volumeWaveformLoop'
	},
	{
		target: TIMER_EFFECT_TARGET_ENVELOPE_SHAPE,
		waveformKey: 'envelopeShapeWaveform',
		loopKey: 'envelopeShapeWaveformLoop'
	},
	{
		target: TIMER_EFFECT_TARGET_TONE,
		waveformKey: 'toneWaveform',
		loopKey: 'toneWaveformLoop'
	},
	{
		target: TIMER_EFFECT_TARGET_ENVELOPE_PERIOD,
		waveformKey: 'envelopePeriodWaveform',
		loopKey: 'envelopePeriodWaveformLoop'
	}
];

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

	_waveformsEqual(left, right) {
		const a = left ?? [];
		const b = right ?? [];
		return a.length === b.length && a.every((value, index) => value === b[index]);
	}

	_clampWaveformValue(target, raw, fmOffsetMode) {
		if (target === TIMER_EFFECT_TARGET_ENVELOPE_PERIOD) {
			return Math.max(1, raw & 0xffff);
		}
		if (target === TIMER_EFFECT_TARGET_TONE) {
			return fmOffsetMode === TIMER_FM_OFFSET_PERIOD
				? Math.max(AY_FM_PERIOD_OFFSET_MIN, Math.min(AY_FM_PERIOD_OFFSET_MAX, raw))
				: Math.max(AY_FM_SEMITONE_MIN, Math.min(AY_FM_SEMITONE_MAX, raw));
		}
		return raw & 0xf;
	}

	_uploadTimerEffectWaveform(channelIndex, target, waveform, waveformLoop, fmOffsetMode) {
		if (!waveform || waveform.length <= 0) {
			return;
		}
		const ptr = this._ensureTimerEffectWaveformBuffer(channelIndex, waveform.length);
		const memory = new Int32Array(this.wasmModule.memory.buffer);
		const offset = ptr >> 2;
		for (let i = 0; i < waveform.length; i++) {
			memory[offset + i] = this._clampWaveformValue(target, waveform[i] | 0, fmOffsetMode);
		}
		this.wasmModule.ayumi_set_timer_effect_waveform(
			this.ayumiPtr,
			channelIndex,
			target,
			ptr,
			waveform.length,
			waveformLoop ?? 0
		);
	}

	_applyTimerEffect(channelIndex, timerEffect, lastTimerEffect, forceApply = false) {
		const enabled = timerEffect.enabled ? 1 : 0;
		const targetMask = timerEffect.targetMask ?? TIMER_EFFECT_TARGET_NONE;
		const pwmMode = timerEffect.pwmMode ?? 0;
		const period = timerEffect.period > 0 ? timerEffect.period : 1;
		const periodLow = timerEffect.periodLow > 0 ? timerEffect.periodLow : period;
		const baseVolume = timerEffect.baseVolume & 0xf;
		const baseTonePeriod = Math.max(1, timerEffect.baseTonePeriod & 0xfff);
		const baseEnvelopePeriod = Math.max(1, timerEffect.baseEnvelopePeriod & 0xffff);
		const fmOffsetMode = resolveTimerFmOffsetMode(timerEffect.fmOffsetMode);
		const wasEnabled = lastTimerEffect.enabled ? 1 : 0;
		const enableChanged = enabled !== wasEnabled;
		const targetMaskChanged =
			targetMask !== (lastTimerEffect.targetMask ?? TIMER_EFFECT_TARGET_NONE);
		const pwmModeChanged = pwmMode !== (lastTimerEffect.pwmMode ?? 0);
		const lastBaseTonePeriod = lastTimerEffect.baseTonePeriod ?? 1;
		const lastBaseEnvelopePeriod = lastTimerEffect.baseEnvelopePeriod ?? 1;
		const lastFmOffsetMode = resolveTimerFmOffsetMode(lastTimerEffect.fmOffsetMode);

		if (
			forceApply ||
			enableChanged ||
			targetMaskChanged ||
			pwmModeChanged ||
			period !== lastTimerEffect.period ||
			periodLow !== lastTimerEffect.periodLow ||
			baseVolume !== lastTimerEffect.baseVolume ||
			baseTonePeriod !== lastBaseTonePeriod ||
			baseEnvelopePeriod !== lastBaseEnvelopePeriod ||
			fmOffsetMode !== lastFmOffsetMode
		) {
			this.wasmModule.ayumi_set_timer_effect(
				this.ayumiPtr,
				channelIndex,
				enabled,
				targetMask,
				pwmMode,
				period,
				periodLow,
				baseVolume,
				baseTonePeriod,
				baseEnvelopePeriod,
				fmOffsetMode
			);
			lastTimerEffect.enabled = timerEffect.enabled;
			lastTimerEffect.targetMask = targetMask;
			lastTimerEffect.pwmMode = pwmMode;
			lastTimerEffect.period = period;
			lastTimerEffect.periodLow = periodLow;
			lastTimerEffect.baseVolume = baseVolume;
			lastTimerEffect.baseTonePeriod = baseTonePeriod;
			lastTimerEffect.baseEnvelopePeriod = baseEnvelopePeriod;
			lastTimerEffect.fmOffsetMode = fmOffsetMode;
		}

		if (!timerEffect.enabled || targetMask === TIMER_EFFECT_TARGET_NONE) {
			if (timerEffect.resetPhase) {
				this.wasmModule.ayumi_timer_effect_reset(this.ayumiPtr, channelIndex);
				timerEffect.resetPhase = false;
			}
			return;
		}

		for (const { target, waveformKey, loopKey } of TIMER_EFFECT_WAVEFORM_TARGETS) {
			if ((targetMask & target) === 0) {
				continue;
			}
			const waveform = timerEffect[waveformKey] ?? [];
			const waveformLoop = timerEffect[loopKey] ?? 0;
			const lastWaveform = lastTimerEffect[waveformKey] ?? [];
			const lastWaveformLoop = lastTimerEffect[loopKey] ?? 0;
			const waveformChanged =
				!this._waveformsEqual(waveform, lastWaveform) || waveformLoop !== lastWaveformLoop;

			if (
				waveform.length > 0 &&
				(forceApply ||
					waveformChanged ||
					enableChanged ||
					targetMaskChanged ||
					pwmModeChanged ||
					fmOffsetMode !== lastFmOffsetMode)
			) {
				this._uploadTimerEffectWaveform(
					channelIndex,
					target,
					waveform,
					waveformLoop,
					fmOffsetMode
				);
				lastTimerEffect[waveformKey] = [...waveform];
				lastTimerEffect[loopKey] = waveformLoop;
			}
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
		this._uploadTimerEffectWaveform(channelIndex, TIMER_EFFECT_TARGET_VOLUME, [volume], 0, 0);
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
