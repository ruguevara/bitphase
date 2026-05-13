import {
	DEFAULT_AYM_FREQUENCY,
	SOFTWARE_PWM_DUTY_CYCLE,
	SOFTWARE_PWM_OFF_VOLUME,
	SOFTWARE_PWM_TIMER_DENOMINATOR_BIAS,
	AYUMI_DECIMATE_FACTOR
} from './ayumi-constants.js';

export function hasSoftwarePwmChannels(state) {
	const a = state?.channelPwmActive;
	return Array.isArray(a) && a.some(Boolean);
}

export function applySoftwarePwmPhaseStep(
	state,
	registerState,
	sampleRate,
	decimateFactor,
	defaultAyFreq = DEFAULT_AYM_FREQUENCY
) {
	if (!state?.channelPwmActive?.length || !registerState?.channels?.length) {
		return false;
	}
	const ayFreq = state.aymFrequency ?? defaultAyFreq;
	let any = false;
	const n = Math.min(state.channelPwmActive.length, registerState.channels.length);
	const divisor = sampleRate * decimateFactor;
	for (let ch = 0; ch < n; ch++) {
		if (!state.channelPwmActive[ch]) continue;
		const periodReg = registerState.channels[ch].tone & 0xfff;
		if (periodReg <= 0) {
			registerState.channels[ch].volume = 0;
			any = true;
			continue;
		}
		const pwmTimerDenom = Math.max(1, periodReg + SOFTWARE_PWM_TIMER_DENOMINATOR_BIAS);
		const prevTracked = state.channelPwmPeriodReg[ch];
		if (prevTracked === -1) {
			state.channelPwmPhase[ch] = 0;
		}
		let phase = state.channelPwmPhase[ch] + ayFreq / (divisor * 16 * pwmTimerDenom);
		if (phase >= 1) phase -= Math.floor(phase);
		state.channelPwmPhase[ch] = phase;
		state.channelPwmPeriodReg[ch] = periodReg;
		const high = state.channelPwmVolumeHigh[ch];
		const low = high > SOFTWARE_PWM_OFF_VOLUME ? SOFTWARE_PWM_OFF_VOLUME : 0;
		const vol = phase < SOFTWARE_PWM_DUTY_CYCLE ? high : low;
		registerState.channels[ch].volume = vol;
		any = true;
	}
	return any;
}

export function applyRegisterStateToAyumi(ayumiEngine, registerState, state, mixer) {
	if (!ayumiEngine) return;
	if (mixer.hasVirtualChannels()) {
		const hwState = mixer.merge(registerState, state);
		ayumiEngine.applyRegisterState(hwState);
		registerState.forceEnvelopeShapeWrite = false;
	} else {
		ayumiEngine.applyRegisterState(registerState);
	}
}

export function processAyumiOneOutputSample(
	wasm,
	ayumiPtr,
	ayumiEngine,
	registerState,
	state,
	mixer,
	sampleRate,
	defaultAyFreq = DEFAULT_AYM_FREQUENCY
) {
	if (!wasm || !ayumiPtr || !ayumiEngine) return;
	const inner = hasSoftwarePwmChannels(state) && ayumiEngine.hasPcmSlotExports();
	if (inner) {
		wasm.ayumi_begin_output_frame(ayumiPtr);
		const sub = AYUMI_DECIMATE_FACTOR;
		for (let slot = sub - 1; slot >= 0; slot--) {
			applySoftwarePwmPhaseStep(state, registerState, sampleRate, sub, defaultAyFreq);
			applyRegisterStateToAyumi(ayumiEngine, registerState, state, mixer);
			wasm.ayumi_output_inner_slot(ayumiPtr, slot);
		}
		wasm.ayumi_finish_output_frame(ayumiPtr);
		return;
	}
	if (hasSoftwarePwmChannels(state)) {
		const any = applySoftwarePwmPhaseStep(state, registerState, sampleRate, 1, defaultAyFreq);
		if (any) applyRegisterStateToAyumi(ayumiEngine, registerState, state, mixer);
	}
	wasm.ayumi_process(ayumiPtr);
}
