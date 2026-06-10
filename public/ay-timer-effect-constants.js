export const TIMER_EFFECT_TARGET_NONE = 0;
export const TIMER_EFFECT_TARGET_VOLUME = 1;
export const TIMER_EFFECT_TARGET_ENVELOPE_SHAPE = 2;
export const TIMER_EFFECT_TARGET_TONE = 4;
export const TIMER_EFFECT_TARGET_ENVELOPE_PERIOD = 8;

export const TIMER_PWM_MODE_OFF = 0;
export const TIMER_PWM_MODE_BY_STEP_VALUE = 1;
export const TIMER_PWM_MODE_BY_DUTY_INDEX = 2;

export const TIMER_FM_OFFSET_SEMITONE = 0;
export const TIMER_FM_OFFSET_PERIOD = 1;

export function resolveTimerFmOffsetMode(mode) {
	return mode === TIMER_FM_OFFSET_PERIOD || mode === 'period'
		? TIMER_FM_OFFSET_PERIOD
		: TIMER_FM_OFFSET_SEMITONE;
}

export function createDefaultTimerEffect() {
	return {
		enabled: false,
		targetMask: TIMER_EFFECT_TARGET_NONE,
		pwmMode: TIMER_PWM_MODE_OFF,
		period: 100,
		periodLow: 100,
		baseVolume: 0,
		baseTonePeriod: 1,
		baseEnvelopePeriod: 1,
		fmOffsetMode: TIMER_FM_OFFSET_SEMITONE,
		volumeWaveform: [15, 0],
		envelopeShapeWaveform: [8],
		toneWaveform: [0, 7],
		envelopePeriodWaveform: [0, 7],
		volumeWaveformLoop: 0,
		envelopeShapeWaveformLoop: 0,
		toneWaveformLoop: 0,
		envelopePeriodWaveformLoop: 0,
		resetPhase: false
	};
}

export function buildCompositeTimerEffect({
	targetMask = TIMER_EFFECT_TARGET_NONE,
	pwmMode = TIMER_PWM_MODE_OFF,
	period = 100,
	periodLow = period,
	baseVolume = 0,
	baseTonePeriod = 1,
	baseEnvelopePeriod = 1,
	fmOffsetMode = TIMER_FM_OFFSET_SEMITONE,
	volumeWaveform = [15, 0],
	envelopeShapeWaveform = [8],
	toneWaveform = [0, 7],
	envelopePeriodWaveform = [0, 7],
	volumeWaveformLoop = 0,
	envelopeShapeWaveformLoop = 0,
	toneWaveformLoop = 0,
	envelopePeriodWaveformLoop = 0,
	waveformLoop = 0,
	resetPhase = false,
	enabled = false
} = {}) {
	const mask = enabled ? targetMask & 0xf : TIMER_EFFECT_TARGET_NONE;
	const fallbackLoop = waveformLoop ?? 0;
	return {
		enabled: mask !== 0,
		targetMask: mask,
		pwmMode,
		period,
		periodLow,
		baseVolume,
		baseTonePeriod,
		baseEnvelopePeriod,
		fmOffsetMode: resolveTimerFmOffsetMode(fmOffsetMode),
		volumeWaveform: [...volumeWaveform],
		envelopeShapeWaveform: [...envelopeShapeWaveform],
		toneWaveform: [...toneWaveform],
		envelopePeriodWaveform: [...envelopePeriodWaveform],
		volumeWaveformLoop: volumeWaveformLoop ?? fallbackLoop,
		envelopeShapeWaveformLoop: envelopeShapeWaveformLoop ?? fallbackLoop,
		toneWaveformLoop: toneWaveformLoop ?? fallbackLoop,
		envelopePeriodWaveformLoop: envelopePeriodWaveformLoop ?? fallbackLoop,
		resetPhase
	};
}

export function disableTimerEffect(timerEffect) {
	timerEffect.enabled = false;
	timerEffect.targetMask = TIMER_EFFECT_TARGET_NONE;
	timerEffect.pwmMode = TIMER_PWM_MODE_OFF;
	timerEffect.resetPhase = false;
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
	return buildCompositeTimerEffect({
		enabled,
		targetMask: TIMER_EFFECT_TARGET_VOLUME,
		pwmMode: pwmByDutyIndex
			? TIMER_PWM_MODE_BY_DUTY_INDEX
			: pwm
				? TIMER_PWM_MODE_BY_STEP_VALUE
				: TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseVolume,
		volumeWaveform: waveform,
		volumeWaveformLoop: waveformLoop,
		resetPhase
	});
}

export function createToneTimerEffect({
	enabled = false,
	pwm = false,
	period = 100,
	periodLow = period,
	baseTonePeriod = 1,
	fmOffsetMode = TIMER_FM_OFFSET_SEMITONE,
	waveform = [0, 7],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return buildCompositeTimerEffect({
		enabled,
		targetMask: TIMER_EFFECT_TARGET_TONE,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseTonePeriod,
		fmOffsetMode,
		toneWaveform: waveform,
		toneWaveformLoop: waveformLoop,
		resetPhase
	});
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
	return buildCompositeTimerEffect({
		enabled,
		targetMask: TIMER_EFFECT_TARGET_ENVELOPE_SHAPE,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		envelopeShapeWaveform: waveform,
		envelopeShapeWaveformLoop: waveformLoop,
		resetPhase
	});
}

export function createEnvelopeFmTimerEffect({
	enabled = false,
	pwm = false,
	period = 100,
	periodLow = period,
	baseEnvelopePeriod = 1,
	fmOffsetMode = TIMER_FM_OFFSET_PERIOD,
	waveform = [0, 7],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return buildCompositeTimerEffect({
		enabled,
		targetMask: TIMER_EFFECT_TARGET_ENVELOPE_PERIOD,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseEnvelopePeriod,
		fmOffsetMode,
		envelopePeriodWaveform: waveform,
		envelopePeriodWaveformLoop: waveformLoop,
		resetPhase
	});
}
