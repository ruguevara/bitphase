export const TIMER_EFFECT_KIND_NONE = 0;
export const TIMER_EFFECT_KIND_VOLUME = 1;
export const TIMER_EFFECT_KIND_ENVELOPE_SHAPE = 2;
export const TIMER_EFFECT_KIND_TONE = 3;

export const TIMER_PWM_MODE_OFF = 0;
export const TIMER_PWM_MODE_BY_STEP_VALUE = 1;
export const TIMER_PWM_MODE_BY_DUTY_INDEX = 2;

export function createDefaultTimerEffect() {
	return {
		enabled: false,
		kind: TIMER_EFFECT_KIND_NONE,
		pwmMode: TIMER_PWM_MODE_OFF,
		period: 100,
		periodLow: 100,
		baseVolume: 0,
		baseTonePeriod: 1,
		waveform: [15, 0],
		waveformLoop: 0,
		resetPhase: false
	};
}

export function createVolumeTimerEffect({
	enabled = false,
	pwm = false,
	pwmByDutyIndex = false,
	period = 100,
	periodLow = period,
	baseVolume = 0,
	waveform = [15, 0],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return {
		enabled,
		kind: enabled ? TIMER_EFFECT_KIND_VOLUME : TIMER_EFFECT_KIND_NONE,
		pwmMode: pwmByDutyIndex
			? TIMER_PWM_MODE_BY_DUTY_INDEX
			: pwm
				? TIMER_PWM_MODE_BY_STEP_VALUE
				: TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseVolume,
		baseTonePeriod: 1,
		waveform: [...waveform],
		waveformLoop,
		resetPhase
	};
}

export function createToneTimerEffect({
	enabled = false,
	pwm = false,
	period = 100,
	periodLow = period,
	baseTonePeriod = 1,
	waveform = [0, 7],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return {
		enabled,
		kind: enabled ? TIMER_EFFECT_KIND_TONE : TIMER_EFFECT_KIND_NONE,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseVolume: 0,
		baseTonePeriod,
		waveform: [...waveform],
		waveformLoop,
		resetPhase
	};
}

export function createEnvelopeShapeTimerEffect({
	enabled = false,
	pwm = false,
	period = 100,
	periodLow = period,
	waveform = [8],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return {
		enabled,
		kind: enabled ? TIMER_EFFECT_KIND_ENVELOPE_SHAPE : TIMER_EFFECT_KIND_NONE,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseVolume: 0,
		baseTonePeriod: 1,
		waveform: [...waveform],
		waveformLoop,
		resetPhase
	};
}

export function disableTimerEffect(timerEffect) {
	timerEffect.enabled = false;
	timerEffect.kind = TIMER_EFFECT_KIND_NONE;
	timerEffect.pwmMode = TIMER_PWM_MODE_OFF;
	timerEffect.resetPhase = false;
}
