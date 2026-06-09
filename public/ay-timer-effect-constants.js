export const TIMER_EFFECT_KIND_NONE = 0;
export const TIMER_EFFECT_KIND_VOLUME = 1;
export const TIMER_EFFECT_KIND_ENVELOPE_SHAPE = 2;
export const TIMER_EFFECT_KIND_TONE = 3;
export const TIMER_EFFECT_KIND_ENVELOPE_FM = 4;

export const TIMER_LAYER_VOLUME = 1;
export const TIMER_LAYER_ENVELOPE_SHAPE = 2;
export const TIMER_LAYER_TONE = 4;
export const TIMER_LAYER_ENVELOPE_FM = 8;

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

export function timerEffectLayersFromKind(kind) {
	if (kind === TIMER_EFFECT_KIND_VOLUME) return TIMER_LAYER_VOLUME;
	if (kind === TIMER_EFFECT_KIND_ENVELOPE_SHAPE) return TIMER_LAYER_ENVELOPE_SHAPE;
	if (kind === TIMER_EFFECT_KIND_TONE) return TIMER_LAYER_TONE;
	if (kind === TIMER_EFFECT_KIND_ENVELOPE_FM) return TIMER_LAYER_ENVELOPE_FM;
	return 0;
}

export function resolveTimerEffectLayers(timerEffect) {
	if (timerEffect.layers !== undefined && timerEffect.layers !== null) {
		return timerEffect.layers;
	}
	return timerEffectLayersFromKind(timerEffect.kind ?? TIMER_EFFECT_KIND_NONE);
}

export function timerEffectHasLayer(timerEffect, layer) {
	return (resolveTimerEffectLayers(timerEffect) & layer) !== 0;
}

export function createDefaultTimerEffect() {
	return {
		enabled: false,
		layers: 0,
		kind: TIMER_EFFECT_KIND_NONE,
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
		envelopePeriodWaveform: [-1, 1],
		waveform: [15, 0],
		waveformLoop: 0,
		resetPhase: false
	};
}

export function buildCompositeTimerEffect({
	sid = false,
	syncbuzzer = false,
	fm = false,
	envfm = false,
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
	envelopePeriodWaveform = [-1, 1],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	let layers = 0;
	if (sid) layers |= TIMER_LAYER_VOLUME;
	if (syncbuzzer) layers |= TIMER_LAYER_ENVELOPE_SHAPE;
	if (fm) layers |= TIMER_LAYER_TONE;
	if (envfm) layers |= TIMER_LAYER_ENVELOPE_FM;
	const resolvedFmOffsetMode = resolveTimerFmOffsetMode(fmOffsetMode);
	return {
		enabled: layers !== 0,
		layers,
		kind: layersToLegacyKind(layers),
		pwmMode,
		period,
		periodLow,
		baseVolume,
		baseTonePeriod: Math.max(1, baseTonePeriod & 0xfff),
		baseEnvelopePeriod: Math.max(1, baseEnvelopePeriod & 0xffff),
		fmOffsetMode: resolvedFmOffsetMode,
		volumeWaveform: [...volumeWaveform],
		envelopeShapeWaveform: [...envelopeShapeWaveform],
		toneWaveform: [...toneWaveform],
		envelopePeriodWaveform: [...envelopePeriodWaveform],
		waveform: [...primaryWaveformForLayers(layers, {
			volumeWaveform,
			envelopeShapeWaveform,
			toneWaveform,
			envelopePeriodWaveform
		})],
		waveformLoop,
		resetPhase
	};
}

function layersToLegacyKind(layers) {
	if (layers === TIMER_LAYER_VOLUME) return TIMER_EFFECT_KIND_VOLUME;
	if (layers === TIMER_LAYER_ENVELOPE_SHAPE) return TIMER_EFFECT_KIND_ENVELOPE_SHAPE;
	if (layers === TIMER_LAYER_TONE) return TIMER_EFFECT_KIND_TONE;
	if (layers === TIMER_LAYER_ENVELOPE_FM) return TIMER_EFFECT_KIND_ENVELOPE_FM;
	return TIMER_EFFECT_KIND_NONE;
}

function primaryWaveformForLayers(layers, waveforms) {
	if (layers & TIMER_LAYER_VOLUME) return waveforms.volumeWaveform;
	if (layers & TIMER_LAYER_ENVELOPE_SHAPE) return waveforms.envelopeShapeWaveform;
	if (layers & TIMER_LAYER_TONE) return waveforms.toneWaveform;
	if (layers & TIMER_LAYER_ENVELOPE_FM) return waveforms.envelopePeriodWaveform;
	return [15, 0];
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
		sid: enabled,
		pwmMode: pwmByDutyIndex
			? TIMER_PWM_MODE_BY_DUTY_INDEX
			: pwm
				? TIMER_PWM_MODE_BY_STEP_VALUE
				: TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseVolume,
		volumeWaveform: waveform,
		waveformLoop,
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
		fm: enabled,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseTonePeriod,
		fmOffsetMode,
		toneWaveform: waveform,
		waveformLoop,
		resetPhase
	});
}

export function createEnvelopeFmTimerEffect({
	enabled = false,
	pwm = false,
	period = 100,
	periodLow = period,
	baseEnvelopePeriod = 100,
	fmOffsetMode = TIMER_FM_OFFSET_SEMITONE,
	waveform = [-1, 1],
	waveformLoop = 0,
	resetPhase = false
} = {}) {
	return buildCompositeTimerEffect({
		envfm: enabled,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		baseEnvelopePeriod,
		fmOffsetMode,
		envelopePeriodWaveform: waveform,
		waveformLoop,
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
		syncbuzzer: enabled,
		pwmMode: pwm ? TIMER_PWM_MODE_BY_DUTY_INDEX : TIMER_PWM_MODE_OFF,
		period,
		periodLow,
		envelopeShapeWaveform: waveform,
		waveformLoop,
		resetPhase
	});
}

export function disableTimerEffect(timerEffect) {
	timerEffect.enabled = false;
	timerEffect.layers = 0;
	timerEffect.kind = TIMER_EFFECT_KIND_NONE;
	timerEffect.pwmMode = TIMER_PWM_MODE_OFF;
	timerEffect.resetPhase = false;
}
