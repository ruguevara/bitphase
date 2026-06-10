import AYChipRegisterState from './ay-chip-register-state.js';
import EffectAlgorithms from './effect-algorithms.js';
import { PT3VolumeTable } from './pt3-volume-table.js';
import { normalizeAyInstrumentFields, getAySidBaseVolume, computeTimerEffectPeriod, computeTimerPwmPeriods, effectiveRowSidWaveform, effectiveRowSyncbuzzerWaveformLoop, effectiveRowFmWaveform, effectiveRowEnvFmWaveform, effectiveRowSidWaveformLoop, effectiveRowFmWaveformLoop, effectiveRowEnvFmWaveformLoop, resolveAyFmOffsetMode, resolveAyEnvFmOffsetMode, resolveEnvFmEnvelopePeriodSteps, effectiveTimerPwmDuty, effectiveTimerPwmSweep, effectiveTimerPwmSweepMin, getTimerEffectPwmFields, rowSupportsTimerPwm, resolveSyncbuzzerWaveform, isPatternEnvelopeShapeSet, advanceTimerPwmSweep } from './ay-instrument-utils.js';
import {
	instrumentHasSample,
	computeSampleSidPeriod,
	resolveSamplePlaybackRate,
	advanceSamplePosition,
	resetChannelSamplePlayback,
	clampSamplePlaybackPosition
} from './ay-sample-playback.js';
import {
	TIMER_EFFECT_TARGET_VOLUME,
	TIMER_EFFECT_TARGET_ENVELOPE_SHAPE,
	TIMER_EFFECT_TARGET_TONE,
	TIMER_EFFECT_TARGET_ENVELOPE_PERIOD,
	TIMER_PWM_MODE_OFF,
	TIMER_PWM_MODE_BY_DUTY_INDEX,
	TIMER_FM_OFFSET_PERIOD,
	TIMER_FM_OFFSET_SEMITONE,
	createDefaultTimerEffect,
	buildCompositeTimerEffect,
	createVolumeTimerEffect,
	disableTimerEffect
} from './ay-timer-effect-constants.js';
class AYAudioDriver {
	constructor(channelCount = 3) {
		this.channelMixerState = [];
		for (let i = 0; i < channelCount; i++) {
			this.channelMixerState.push({ tone: false, noise: false, envelope: false });
		}
		this.timerEffectPwmSweepState = {
			sid: {
				sweep: 'channelSidTimerPwmSweep',
				direction: 'channelSidTimerPwmSweepDirection'
			},
			syncbuzzer: {
				sweep: 'channelSyncbuzzerTimerPwmSweep',
				direction: 'channelSyncbuzzerTimerPwmSweepDirection'
			},
			fm: {
				sweep: 'channelFmTimerPwmSweep',
				direction: 'channelFmTimerPwmSweepDirection'
			},
			envFm: {
				sweep: 'channelEnvFmTimerPwmSweep',
				direction: 'channelEnvFmTimerPwmSweepDirection'
			}
		};
		this.timerEffectPwmPriority = ['sid', 'syncbuzzer', 'fm', 'envFm'];
	}

	resetChannelMixerState() {
		for (let i = 0; i < this.channelMixerState.length; i++) {
			this.channelMixerState[i] = { tone: false, noise: false, envelope: false };
		}
	}

	resizeChannels(newCount) {
		while (this.channelMixerState.length < newCount) {
			this.channelMixerState.push({ tone: false, noise: false, envelope: false });
		}
		if (this.channelMixerState.length > newCount) {
			this.channelMixerState.length = newCount;
		}
	}

	calculateVolume(
		patternVolume,
		instrumentVolume,
		amplitudeSliding,
		instrumentEnvelopeEnabled,
		channelEnvelopeEnabled,
		channelMuted,
		envelopeDisabledByOnOff
	) {
		if (channelMuted) {
			return 0;
		}

		let vol = instrumentVolume + amplitudeSliding;
		if (vol < 0) vol = 0;
		if (vol > 15) vol = 15;

		let finalVolume = PT3VolumeTable[patternVolume][vol];

		if (instrumentEnvelopeEnabled && channelEnvelopeEnabled && !envelopeDisabledByOnOff) {
			finalVolume = finalVolume | 16;
		}

		return finalVolume;
	}

	getEffectTimerPwmSweepState(state, effectType) {
		const keys = this.timerEffectPwmSweepState[effectType];
		if (!keys) {
			return null;
		}
		return {
			sweep: state[keys.sweep],
			direction: state[keys.direction]
		};
	}

	resetEffectTimerPwmSweep(state, channelIndex, effectType, instrumentIndex) {
		const pwmState = this.getEffectTimerPwmSweepState(state, effectType);
		if (!pwmState?.sweep || !pwmState.direction) {
			return;
		}
		const reverseSweep = this.effectReverseTimerPwmSweep(state, instrumentIndex, effectType);
		pwmState.sweep[channelIndex] = -1;
		pwmState.direction[channelIndex] = reverseSweep ? -1 : 1;
	}

	effectReverseTimerPwmSweep(state, instrumentIndex, effectType) {
		if (instrumentIndex === undefined || instrumentIndex < 0) {
			return false;
		}
		const instrument = state.instruments?.[instrumentIndex];
		if (!instrument) {
			return false;
		}
		return getTimerEffectPwmFields(normalizeAyInstrumentFields(instrument), effectType)
			.reverseSweep;
	}

	effectPreserveTimerPwmSweepOnNewNote(state, instrumentIndex, effectType) {
		if (instrumentIndex === undefined || instrumentIndex < 0) {
			return false;
		}
		const instrument = state.instruments?.[instrumentIndex];
		if (!instrument) {
			return false;
		}
		return getTimerEffectPwmFields(normalizeAyInstrumentFields(instrument), effectType)
			.preserveOnNewNote;
	}

	advanceEffectTimerPwmSweep(state, channelIndex, ayFields, timerRow, effectType, active) {
		if (!active || !rowSupportsTimerPwm(timerRow, effectType)) {
			return null;
		}
		const pwmState = this.getEffectTimerPwmSweepState(state, effectType);
		if (!pwmState?.sweep || !pwmState.direction) {
			return effectiveTimerPwmDuty(ayFields, effectType, timerRow);
		}
		const sweepSpeed = effectiveTimerPwmSweep(ayFields, effectType, timerRow);
		const maxDuty = effectiveTimerPwmDuty(ayFields, effectType, timerRow);
		const minDuty = effectiveTimerPwmSweepMin(ayFields, effectType, timerRow);
		const reverseSweep = getTimerEffectPwmFields(ayFields, effectType).reverseSweep === true;
		if (sweepSpeed === 0) {
			return maxDuty;
		}
		const advanced = advanceTimerPwmSweep(
			pwmState.sweep[channelIndex],
			pwmState.direction[channelIndex],
			sweepSpeed,
			minDuty,
			maxDuty,
			reverseSweep
		);
		pwmState.sweep[channelIndex] = advanced.duty;
		pwmState.direction[channelIndex] = advanced.direction;
		return advanced.duty;
	}

	resolveCompositeTimerPwmPeriods(state, channelIndex, ayFields, timerRow, activeEffects, timerEffectPeriod) {
		const duties = {};
		for (const effectType of this.timerEffectPwmPriority) {
			if (activeEffects[effectType]) {
				duties[effectType] = this.advanceEffectTimerPwmSweep(
					state,
					channelIndex,
					ayFields,
					timerRow,
					effectType,
					true
				);
			}
		}

		let pwmMode = TIMER_PWM_MODE_OFF;
		let period = timerEffectPeriod;
		let periodLow = timerEffectPeriod;
		for (const effectType of this.timerEffectPwmPriority) {
			if (!activeEffects[effectType] || !rowSupportsTimerPwm(timerRow, effectType)) {
				continue;
			}
			const duty = duties[effectType] ?? effectiveTimerPwmDuty(ayFields, effectType, timerRow);
			const timerPwmPeriods = computeTimerPwmPeriods(timerEffectPeriod, duty);
			period = timerPwmPeriods.highPeriod;
			periodLow = timerPwmPeriods.lowPeriod;
			pwmMode = TIMER_PWM_MODE_BY_DUTY_INDEX;
			break;
		}

		return { pwmMode, period, periodLow };
	}

	resolveCompositeTimerFmOffsetMode(activeEffects, timerRow) {
		if (activeEffects.fm) {
			return resolveAyFmOffsetMode(timerRow) === 'period'
				? TIMER_FM_OFFSET_PERIOD
				: TIMER_FM_OFFSET_SEMITONE;
		}
		if (activeEffects.envFm) {
			return resolveAyEnvFmOffsetMode(timerRow) === 'period'
				? TIMER_FM_OFFSET_PERIOD
				: TIMER_FM_OFFSET_SEMITONE;
		}
		return TIMER_FM_OFFSET_SEMITONE;
	}

	buildChannelCompositeTimerEffect({
		targetMask,
		pwmMode,
		period,
		periodLow,
		finalVolume,
		finalTone,
		baseEnvelopePeriod,
		fmOffsetMode,
		timerRow,
		patternEnvelopeShape,
		tuningTable,
		timerEffectReset
	}) {
		const resolvedBaseEnvelopePeriod = Math.max(1, baseEnvelopePeriod);
		return buildCompositeTimerEffect({
			enabled: targetMask !== 0,
			targetMask,
			pwmMode,
			period,
			periodLow,
			baseVolume:
				(targetMask & TIMER_EFFECT_TARGET_VOLUME) !== 0 ? getAySidBaseVolume(finalVolume) : 0,
			baseTonePeriod:
				(targetMask & TIMER_EFFECT_TARGET_TONE) !== 0 ? finalTone : 1,
			baseEnvelopePeriod:
				(targetMask & TIMER_EFFECT_TARGET_ENVELOPE_PERIOD) !== 0
					? resolvedBaseEnvelopePeriod
					: 1,
			fmOffsetMode,
			volumeWaveform: effectiveRowSidWaveform(timerRow),
			envelopeShapeWaveform: resolveSyncbuzzerWaveform(timerRow, patternEnvelopeShape),
			toneWaveform: effectiveRowFmWaveform(timerRow),
			envelopePeriodWaveform:
				(targetMask & TIMER_EFFECT_TARGET_ENVELOPE_PERIOD) !== 0
					? resolveEnvFmEnvelopePeriodSteps(
							resolvedBaseEnvelopePeriod,
							effectiveRowEnvFmWaveform(timerRow),
							tuningTable,
							resolveAyEnvFmOffsetMode(timerRow)
						)
					: [0, 7],
			volumeWaveformLoop: effectiveRowSidWaveformLoop(timerRow),
			envelopeShapeWaveformLoop: effectiveRowSyncbuzzerWaveformLoop(timerRow),
			toneWaveformLoop: effectiveRowFmWaveformLoop(timerRow),
			envelopePeriodWaveformLoop: effectiveRowEnvFmWaveformLoop(timerRow),
			resetPhase: timerEffectReset
		});
	}

	resetInstrumentAccumulators(state, channelIndex, options = {}) {
		state.channelToneAccumulator[channelIndex] = 0;
		state.channelNoiseAccumulator[channelIndex] = 0;
		state.channelEnvelopeAccumulator[channelIndex] = 0;
		state.channelAmplitudeSliding[channelIndex] = 0;
		if (!options.preserveTimerPwmSweep) {
			const instrumentIndex = state.channelInstruments?.[channelIndex] ?? -1;
			for (const effectType of this.timerEffectPwmPriority) {
				this.resetEffectTimerPwmSweep(state, channelIndex, effectType, instrumentIndex);
			}
		}
		if (state.channelTimerEffectReset) {
			const hasActiveSlide =
				state.channelSlideStep && state.channelSlideStep[channelIndex] !== 0;
			const hasActivePortamento =
				state.channelPortamentoActive && state.channelPortamentoActive[channelIndex];
			if (!hasActiveSlide && !hasActivePortamento) {
				state.channelTimerEffectReset[channelIndex] = true;
			}
		}
		if (state.channelToneSliding) {
			const hasActiveSlide =
				state.channelSlideStep && state.channelSlideStep[channelIndex] !== 0;
			const hasActivePortamento =
				state.channelPortamentoActive && state.channelPortamentoActive[channelIndex];
			if (!hasActiveSlide && !hasActivePortamento) {
				state.channelToneSliding[channelIndex] = 0;
			}
		}
		if (state.channelVibratoSliding) {
			state.channelVibratoSliding[channelIndex] = 0;
		}
	}

	processPatternRow(state, pattern, rowIndex, patternRow, registerState) {
		if (
			patternRow.noiseValue === null ||
			patternRow.noiseValue === undefined ||
			patternRow.noiseValue === 0
		) {
			state.noiseBaseValue = state.noisePreviousValue;
		} else if (patternRow.noiseValue === -1) {
			state.noiseBaseValue = 0;
			state.noisePreviousValue = 0;
		} else {
			state.noiseBaseValue = patternRow.noiseValue;
			state.noisePreviousValue = patternRow.noiseValue;
		}

		state.noiseAddValue = 0;
		state.envelopeAddValue = 0;

		for (let channelIndex = 0; channelIndex < pattern.channels.length; channelIndex++) {
			const channel = pattern.channels[channelIndex];
			const row = channel.rows[rowIndex];
			const isMuted = state.channelMuted[channelIndex];

			if (isMuted) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer = {
					tone: false,
					noise: false,
					envelope: false
				};
				state.channelEnvelopeEnabled[channelIndex] = false;
			} else {
				this._processNote(state, channelIndex, row, registerState);
				this._processInstrument(state, channelIndex, row);
				this._applySamplePosition(state, channelIndex, row);
				this._processEnvelope(state, channelIndex, row, patternRow, registerState);
			}
		}
	}

	_applySamplePosition(state, channelIndex, row) {
		const effect = row.effects?.[0];
		if (effect?.effect !== EffectAlgorithms.SAMPLE_POSITION) {
			return;
		}
		const instrumentIndex = state.channelInstruments[channelIndex];
		const instrument = instrumentIndex >= 0 ? state.instruments[instrumentIndex] : null;
		if (!instrumentHasSample(instrument)) {
			return;
		}
		if (state.channelSamplePositions) {
			state.channelSamplePositions[channelIndex] = clampSamplePlaybackPosition(
				instrument,
				effect.parameter & 0xffffff
			);
			if (state.channelSamplePhase) {
				state.channelSamplePhase[channelIndex] = 0;
			}
		}
	}

	_processNote(state, channelIndex, row, registerState) {
		if (state.channelMuted[channelIndex]) return;

		const preserveTimerPwmSweep = this.shouldPreserveTimerPwmSweep(state, channelIndex, row);
		const preserveSamplePlayback = this.shouldPreserveSamplePlayback(state, channelIndex, row);

		if (row.note.name === 1) {
			state.channelSoundEnabled[channelIndex] = false;
			registerState.channels[channelIndex].tone = 0;
			this.resetInstrumentAccumulators(state, channelIndex);
			state.instrumentPositions[channelIndex] = 0;
			const offInstrumentIndex = state.channelInstruments[channelIndex];
			const offInstrument =
				offInstrumentIndex >= 0 ? state.instruments[offInstrumentIndex] : null;
			if (instrumentHasSample(offInstrument)) {
				resetChannelSamplePlayback(state, channelIndex, offInstrument);
			} else if (state.channelSamplePositions) {
				state.channelSamplePositions[channelIndex] = 0;
			}
			if (state.channelSamplePhase) {
				state.channelSamplePhase[channelIndex] = 0;
			}
		} else if (row.note.name !== 0) {
			state.channelSoundEnabled[channelIndex] = true;
			const noteValue = row.note.name - 2 + (row.note.octave - 1) * 12;
			if (noteValue >= 0 && noteValue < state.currentTuningTable.length) {
				const regValue = state.currentTuningTable[noteValue];
				registerState.channels[channelIndex].tone = regValue;
			}
			const instrumentIndex = state.channelInstruments[channelIndex];
			const instrument = instrumentIndex >= 0 ? state.instruments[instrumentIndex] : null;
			if (state.instrumentPositions && !(preserveSamplePlayback && instrumentHasSample(instrument))) {
				state.instrumentPositions[channelIndex] = 0;
			}
			if (!preserveSamplePlayback) {
				if (instrumentHasSample(instrument)) {
					resetChannelSamplePlayback(state, channelIndex, instrument);
				} else if (state.channelSamplePositions) {
					state.channelSamplePositions[channelIndex] = 0;
				}
				if (state.channelSamplePhase) {
					state.channelSamplePhase[channelIndex] = 0;
				}
			}
			this.resetInstrumentAccumulators(state, channelIndex, { preserveTimerPwmSweep });
		}
	}

	_processInstrument(state, channelIndex, row) {
		if (!state.channelInstruments || !state.instruments) return;
		if (state.channelMuted[channelIndex]) return;

		if (row.instrument > 0) {
			const instrumentIndex = state.instrumentIdToIndex.get(row.instrument);
			if (instrumentIndex !== undefined && state.instruments[instrumentIndex]) {
				const instrument = state.instruments[instrumentIndex];
				state.channelInstruments[channelIndex] = instrumentIndex;
				const preserveSamplePlayback = this.shouldPreserveSamplePlayback(state, channelIndex, row);
				if (!(preserveSamplePlayback && instrumentHasSample(instrument))) {
					state.instrumentPositions[channelIndex] = 0;
				}
				if (instrumentHasSample(instrument) && !preserveSamplePlayback) {
					resetChannelSamplePlayback(state, channelIndex, instrument);
				}
				const preserveTimerPwmSweep = this.shouldPreserveTimerPwmSweep(state, channelIndex, row);
				this.resetInstrumentAccumulators(state, channelIndex, { preserveTimerPwmSweep });
			} else {
				state.channelInstruments[channelIndex] = -1;
			}
		}
	}

	rowHasPortamentoCommand(row) {
		return (
			row.effects?.some((effect) => effect && effect.effect === EffectAlgorithms.PORTAMENTO) ??
			false
		);
	}

	resolveInstrumentIndexForPreserve(state, channelIndex, row) {
		if (row?.instrument > 0) {
			const nextIndex = state.instrumentIdToIndex?.get(row.instrument);
			if (nextIndex !== undefined) {
				return nextIndex;
			}
		}
		return state.channelInstruments?.[channelIndex];
	}

	instrumentPreserveTimerPwmSweepOnNewNote(state, instrumentIndex, effectType = 'sid') {
		return this.effectPreserveTimerPwmSweepOnNewNote(state, instrumentIndex, effectType);
	}

	instrumentReverseTimerPwmSweep(state, instrumentIndex, effectType = 'sid') {
		return this.effectReverseTimerPwmSweep(state, instrumentIndex, effectType);
	}

	shouldPreserveSamplePlayback(state, channelIndex, row) {
		if (this.rowHasPortamentoCommand(row)) {
			return true;
		}
		return state.channelPortamentoActive?.[channelIndex] ?? false;
	}

	shouldPreserveTimerPwmSweep(state, channelIndex, row) {
		if (this.shouldPreserveSamplePlayback(state, channelIndex, row)) {
			return true;
		}
		const instrumentIndex = this.resolveInstrumentIndexForPreserve(state, channelIndex, row);
		return this.timerEffectPwmPriority.some((effectType) =>
			this.effectPreserveTimerPwmSweepOnNewNote(state, instrumentIndex, effectType)
		);
	}

	_processEnvelope(state, channelIndex, row, patternRow, registerState) {
		if (!state.channelEnvelopeEnabled) return;
		if (state.channelMuted[channelIndex]) return;
		if (state.channelInstruments[channelIndex] < 0) {
			state.channelEnvelopeEnabled[channelIndex] = false;
			this.channelMixerState[channelIndex].envelope = false;
			registerState.channels[channelIndex].mixer.envelope = false;
			return;
		}

		const shapeSet = isPatternEnvelopeShapeSet(row.envelopeShape);
		const envelopeValueNum =
			patternRow.envelopeValue != null && patternRow.envelopeValue >= 0
				? Number(patternRow.envelopeValue)
				: null;

		const hasPortamento =
			patternRow.envelopeEffect?.effect === EffectAlgorithms.PORTAMENTO &&
			envelopeValueNum !== null &&
			envelopeValueNum > 0;

		if (envelopeValueNum !== null && envelopeValueNum > 0 && !hasPortamento) {
			state.envelopeBaseValue = envelopeValueNum;
			this._resetAllEnvelopeEffects(state);
			registerState.envelopePeriod = envelopeValueNum;
		} else if (shapeSet && (envelopeValueNum === 0 || envelopeValueNum === null)) {
			state.envelopeBaseValue = 0;
			state.envelopeSlideCurrent = 0;
			state.envelopeSlideDelta = 0;
			state.envelopeSlideDelay = 0;
			state.envelopeSlideDelayCounter = 0;
			if (envelopeValueNum === 0) {
				this._resetAllEnvelopeEffects(state);
			}
			registerState.envelopePeriod = 0;
		}

		if (shapeSet) {
			if (envelopeValueNum === null || envelopeValueNum >= 0) {
				registerState.envelopeShape = row.envelopeShape;
				registerState.forceEnvelopeShapeWrite = true;
				state.channelEnvelopeEnabled[channelIndex] = true;

				const envelopeOnOffActive = state.envelopeOnOffCounter > 0;
				const envelopeDisabledByOnOff = envelopeOnOffActive && !state.envelopeOnOffEnabled;

				if (!envelopeDisabledByOnOff) {
					this.channelMixerState[channelIndex].envelope = true;
					registerState.channels[channelIndex].mixer.envelope = true;
				} else {
					this.channelMixerState[channelIndex].envelope = false;
					registerState.channels[channelIndex].mixer.envelope = false;
				}
			}
		} else if (row.envelopeShape === 15) {
			state.channelEnvelopeEnabled[channelIndex] = false;
			this.channelMixerState[channelIndex].envelope = false;
			registerState.channels[channelIndex].mixer.envelope = false;
		}

		this._processEnvelopeEffects(state, channelIndex, row, patternRow);
	}

	_resetAllEnvelopeEffects(state) {
		state.envelopeSlideCurrent = 0;
		state.envelopeSlideDelta = 0;
		state.envelopeSlideDelay = 0;
		state.envelopeSlideDelayCounter = 0;
		state.envelopePortamentoActive = false;
		state.envelopeVibratoCounter = 0;
		state.envelopeVibratoSliding = 0;
		state.envelopeArpeggioCounter = 0;
		state.envelopeOnOffCounter = 0;
		state.envelopeEffectTable = -1;
		state.autoEnvelopeActive = false;
	}

	_processEnvelopeEffects(state, channelIndex, row, patternRow) {
		if (!patternRow || !patternRow.envelopeEffect) return;

		const effect = patternRow.envelopeEffect;
		const hasTableIndex =
			'tableIndex' in effect &&
			effect.tableIndex !== undefined &&
			effect.tableIndex !== null &&
			effect.tableIndex >= 0;

		if (hasTableIndex) {
			this._initEnvelopeEffectTable(state, effect);
		} else {
			state.envelopeEffectTable = -1;
		}

		const resets = EffectAlgorithms.getEffectActivationResets(effect.effect);
		if (resets.portamento) {
			state.envelopePortamentoActive = false;
		}
		if (resets.slide) {
			state.envelopeSlideDelta = 0;
			state.envelopeSlideDelayCounter = 0;
		}

		switch (effect.effect) {
			case EffectAlgorithms.ARPEGGIO:
				this._initEnvelopeArpeggio(state, effect, hasTableIndex);
				break;
			case EffectAlgorithms.VIBRATO:
				this._initEnvelopeVibrato(state, effect, hasTableIndex);
				break;
			case EffectAlgorithms.SLIDE_UP:
				this._initEnvelopeSlide(state, effect, hasTableIndex, 1);
				break;
			case EffectAlgorithms.SLIDE_DOWN:
				this._initEnvelopeSlide(state, effect, hasTableIndex, -1);
				break;
			case EffectAlgorithms.PORTAMENTO:
				this._initEnvelopePortamento(state, effect, patternRow, hasTableIndex);
				break;
			case EffectAlgorithms.ON_OFF:
				this._initEnvelopeOnOff(state, effect, hasTableIndex);
				break;
			case EffectAlgorithms.DETUNE:
				this._initEnvelopeDetune(state, effect, hasTableIndex);
				break;
			case EffectAlgorithms.AUTO_ENVELOPE:
				this._initAutoEnvelope(state, effect);
				break;
		}
	}

	_initEnvelopeArpeggio(state, effect, hasTableIndex) {
		if (hasTableIndex) {
			const arpeggioState = EffectAlgorithms.initArpeggio(0, effect.delay);
			state.envelopeArpeggioSemitone1 = 0;
			state.envelopeArpeggioSemitone2 = 0;
			state.envelopeArpeggioDelay = arpeggioState.delay;
			state.envelopeArpeggioCounter = arpeggioState.counter;
			state.envelopeArpeggioPosition = arpeggioState.position;
		} else {
			const arpeggioState = EffectAlgorithms.initArpeggio(effect.parameter, effect.delay);
			state.envelopeArpeggioSemitone1 = arpeggioState.semitone1;
			state.envelopeArpeggioSemitone2 = arpeggioState.semitone2;
			state.envelopeArpeggioDelay = arpeggioState.delay;
			state.envelopeArpeggioCounter = arpeggioState.counter;
			state.envelopeArpeggioPosition = arpeggioState.position;
		}
	}

	_initEnvelopeVibrato(state, effect, hasTableIndex) {
		const param = hasTableIndex ? this._getEnvelopeEffectTableValue(state) : effect.parameter;
		const vibratoState = EffectAlgorithms.initVibrato(param, effect.delay);
		state.envelopeVibratoSpeed = vibratoState.speed;
		state.envelopeVibratoDepth = vibratoState.depth;
		state.envelopeVibratoDelay = vibratoState.delay;
		state.envelopeVibratoCounter = vibratoState.counter;
		state.envelopeVibratoPosition = vibratoState.position;
	}

	_initEnvelopeSlide(state, effect, hasTableIndex, direction) {
		const param = hasTableIndex ? this._getEnvelopeEffectTableValue(state) : effect.parameter;
		const slideState = EffectAlgorithms.initSlide(direction * param, effect.delay);
		state.envelopeSlideDelay = slideState.delay;
		state.envelopeSlideDelayCounter = slideState.counter;
		state.envelopeSlideDelta = slideState.step;
	}

	_initEnvelopePortamento(state, effect, patternRow, hasTableIndex) {
		if (patternRow.envelopeValue < 0) return;

		const targetValue = patternRow.envelopeValue;
		const currentValue = state.envelopeBaseValue;
		if (currentValue < 0) return;

		const param = hasTableIndex ? this._getEnvelopeEffectTableValue(state) : effect.parameter;
		const portamentoState = EffectAlgorithms.initPortamento(
			currentValue,
			targetValue,
			param,
			effect.delay
		);
		state.envelopePortamentoTarget = portamentoState.target;
		state.envelopePortamentoDelta = portamentoState.delta;
		state.envelopePortamentoActive = portamentoState.active;
		state.envelopePortamentoStep = portamentoState.step;
		state.envelopePortamentoDelay = portamentoState.delay;
		state.envelopePortamentoCount = portamentoState.counter;
	}

	_initEnvelopeOnOff(state, effect, hasTableIndex) {
		const param = hasTableIndex ? this._getEnvelopeEffectTableValue(state) : effect.parameter;
		const onOffState = EffectAlgorithms.initOnOff(param);
		state.envelopeOffDuration = onOffState.offDuration;
		state.envelopeOnDuration = onOffState.onDuration;
		state.envelopeOnOffCounter = onOffState.counter;
		state.envelopeOnOffEnabled = onOffState.enabled;
	}

	_initEnvelopeDetune(state, effect, hasTableIndex) {
		const param = hasTableIndex ? this._getEnvelopeEffectTableValue(state) : effect.parameter;
		state.envelopeDetune = (param & 0xff) - 0x80;
	}

	_initAutoEnvelope(state, effect) {
		const numerator = (effect.parameter >> 4) & 0xf;
		const denominator = effect.parameter & 0xf;
		if (numerator > 0 && denominator > 0) {
			state.autoEnvelopeActive = true;
			state.autoEnvelopeNumerator = numerator;
			state.autoEnvelopeDenominator = denominator;
		}
	}

	_initEnvelopeEffectTable(state, effect) {
		state.envelopeEffectTable = effect.tableIndex;
		state.envelopeEffectTablePosition = 0;
		state.envelopeEffectTableCounter = effect.delay || 1;
		state.envelopeEffectTableDelay = effect.delay || 1;
		state.envelopeEffectType = effect.effect;
	}

	_getEnvelopeEffectTableValue(state) {
		const tableIndex = state.envelopeEffectTable;
		if (tableIndex < 0) return 0;

		const table = state.getTable(tableIndex);
		if (!table || !table.rows || table.rows.length === 0) return 0;

		const position = state.envelopeEffectTablePosition;
		return table.rows[position] || 0;
	}

	processEnvelopeEffectTable(state) {
		const tableIndex = state.envelopeEffectTable;
		if (tableIndex < 0) return;
		if (state.envelopeEffectType === EffectAlgorithms.ARPEGGIO) return;

		const table = state.getTable(tableIndex);
		if (!table || !table.rows || table.rows.length === 0) return;

		state.envelopeEffectTableCounter--;
		if (state.envelopeEffectTableCounter <= 0) {
			state.envelopeEffectTableCounter = state.envelopeEffectTableDelay;
			state.envelopeEffectTablePosition++;

			if (state.envelopeEffectTablePosition >= table.rows.length) {
				if (table.loop >= 0 && table.loop < table.rows.length) {
					state.envelopeEffectTablePosition = table.loop;
				} else {
					state.envelopeEffectTablePosition = 0;
				}
			}

			this._applyEnvelopeEffectTableParameter(state);
		}
	}

	_applyEnvelopeEffectTableParameter(state) {
		const effectType = state.envelopeEffectType;
		const param = this._getEnvelopeEffectTableValue(state);

		switch (effectType) {
			case EffectAlgorithms.VIBRATO: {
				const { speed, depth } = EffectAlgorithms.parseVibratoParameter(param);
				state.envelopeVibratoSpeed = speed;
				state.envelopeVibratoDepth = depth;
				break;
			}
			case EffectAlgorithms.SLIDE_UP:
				state.envelopeSlideDelta = param;
				break;
			case EffectAlgorithms.SLIDE_DOWN:
				state.envelopeSlideDelta = -param;
				break;
			case EffectAlgorithms.PORTAMENTO: {
				const delta = state.envelopePortamentoDelta;
				const currentSliding = state.envelopeSlideCurrent;
				state.envelopePortamentoStep =
					param * EffectAlgorithms.getPortamentoStepSign(delta, currentSliding);
				break;
			}
			case EffectAlgorithms.ON_OFF: {
				const { offDuration, onDuration } = EffectAlgorithms.parseOnOffParameter(param);
				state.envelopeOffDuration = offDuration;
				state.envelopeOnDuration = onDuration;
				break;
			}
		}
	}

	processSampleInstrument(
		state,
		registerState,
		channelIndex,
		instrument,
		isSoundEnabled,
		onOffHalted
	) {
		const hasRows = instrument.rows && instrument.rows.length > 0;
		const defaultInstrumentRow = {
			tone: false,
			noise: false,
			envelope: false,
			retriggerEnvelope: false,
			toneAdd: 0,
			noiseAdd: 0,
			envelopeAdd: 0,
			volume: 15,
			amplitudeSliding: false,
			amplitudeSlideUp: false,
			toneAccumulation: false,
			noiseAccumulation: false,
			envelopeAccumulation: false
		};
		const effectiveRows = hasRows ? instrument.rows : [defaultInstrumentRow];
		const effectiveRowsLength = effectiveRows.length;
		const effectiveLoop = hasRows ? instrument.loop : 0;
		const rowIndex = state.instrumentPositions[channelIndex] % effectiveRowsLength;
		const instrumentRow = effectiveRows[rowIndex];
		if (!instrumentRow) {
			registerState.channels[channelIndex].mixer.tone = false;
			registerState.channels[channelIndex].mixer.noise = false;
			registerState.channels[channelIndex].mixer.envelope = false;
			this.channelMixerState[channelIndex].tone = false;
			this.channelMixerState[channelIndex].noise = false;
			this.channelMixerState[channelIndex].envelope = false;
			disableTimerEffect(registerState.channels[channelIndex].timerEffect);
			if (!onOffHalted) {
				state.instrumentPositions[channelIndex]++;
				if (state.instrumentPositions[channelIndex] >= effectiveRowsLength) {
					if (effectiveLoop > 0 && effectiveLoop < effectiveRowsLength) {
						state.instrumentPositions[channelIndex] = effectiveLoop;
					} else {
						state.instrumentPositions[channelIndex] = 0;
					}
				}
			}
			return;
		}

		if (instrumentRow.volume >= 0) {
			state.channelInstrumentVolumes[channelIndex] = instrumentRow.volume;
		}

		if (instrumentRow.amplitudeSliding) {
			if (instrumentRow.amplitudeSlideUp) {
				if (state.channelAmplitudeSliding[channelIndex] < 15) {
					state.channelAmplitudeSliding[channelIndex]++;
				}
			} else if (state.channelAmplitudeSliding[channelIndex] > -15) {
				state.channelAmplitudeSliding[channelIndex]--;
			}
		}

		const patternVolume = state.channelPatternVolumes[channelIndex];
		const instrumentVolume = state.channelInstrumentVolumes[channelIndex];
		const amplitudeSliding = state.channelAmplitudeSliding[channelIndex];
		const envelopeOnOffActive = state.envelopeOnOffCounter > 0;
		const envelopeDisabledByOnOff = envelopeOnOffActive && !state.envelopeOnOffEnabled;
		const finalVolume = this.calculateVolume(
			patternVolume,
			instrumentVolume,
			amplitudeSliding,
			false,
			false,
			false,
			envelopeDisabledByOnOff
		);

		if (!isSoundEnabled) {
			registerState.channels[channelIndex].volume = 0;
			registerState.channels[channelIndex].mixer.tone = false;
			registerState.channels[channelIndex].mixer.noise = false;
			registerState.channels[channelIndex].mixer.envelope = false;
			disableTimerEffect(registerState.channels[channelIndex].timerEffect);
			this.channelMixerState[channelIndex].tone = false;
			this.channelMixerState[channelIndex].noise = false;
			this.channelMixerState[channelIndex].envelope = false;
		} else {
			registerState.channels[channelIndex].mixer.tone = false;
			registerState.channels[channelIndex].mixer.noise = false;
			registerState.channels[channelIndex].mixer.envelope = false;
			this.channelMixerState[channelIndex].tone = false;
			this.channelMixerState[channelIndex].noise = false;
			this.channelMixerState[channelIndex].envelope = false;
			state.channelEnvelopeEnabled[channelIndex] = false;
			registerState.channels[channelIndex].volume = finalVolume;

			const sidPeriod = computeSampleSidPeriod(
				state.aymFrequency,
				resolveSamplePlaybackRate(instrument, 44100)
			);
			const sidBaseVolume = getAySidBaseVolume(finalVolume);
			registerState.channels[channelIndex].timerEffect = createVolumeTimerEffect({
				enabled: true,
				pwm: false,
				period: sidPeriod,
				periodLow: sidPeriod,
				baseVolume: sidBaseVolume,
				waveform: [15, 0],
				waveformLoop: 0,
				resetPhase: state.channelTimerEffectReset?.[channelIndex] ?? false
			});
			if (state.channelTimerEffectReset) {
				state.channelTimerEffectReset[channelIndex] = false;
			}
		}

		if (!onOffHalted) {
			state.instrumentPositions[channelIndex]++;
			if (state.instrumentPositions[channelIndex] >= effectiveRowsLength) {
				if (effectiveLoop > 0 && effectiveLoop < effectiveRowsLength) {
					state.instrumentPositions[channelIndex] = effectiveLoop;
				} else {
					state.instrumentPositions[channelIndex] = 0;
				}
			}
		}
	}

	updateSamplePlayback(
		state,
		registerState,
		ayumiEngine,
		outputSampleRate,
		resolveAyumiChannelIndex = (channelIndex) => channelIndex
	) {
		if (!ayumiEngine || !outputSampleRate) {
			return;
		}

		for (let channelIndex = 0; channelIndex < state.channelInstruments.length; channelIndex++) {
			if (state.channelMuted[channelIndex]) {
				continue;
			}
			if (!state.channelSoundEnabled[channelIndex]) {
				continue;
			}

			const instrumentIndex = state.channelInstruments[channelIndex];
			const instrument = instrumentIndex >= 0 ? state.instruments[instrumentIndex] : null;
			if (!instrumentHasSample(instrument)) {
				continue;
			}

			const timerEffect = registerState.channels[channelIndex]?.timerEffect;
			if (!timerEffect?.enabled || (timerEffect.targetMask & TIMER_EFFECT_TARGET_VOLUME) === 0) {
				continue;
			}

			const effectiveTone = this.getEffectiveTone(state, channelIndex);
			if (effectiveTone <= 0) {
				continue;
			}

			const playback = advanceSamplePosition(
				state,
				channelIndex,
				instrument,
				outputSampleRate,
				effectiveTone
			);
			if (!playback.active) {
				disableTimerEffect(registerState.channels[channelIndex].timerEffect);
				state.channelSoundEnabled[channelIndex] = false;
				continue;
			}

			const ayumiChannelIndex = resolveAyumiChannelIndex(channelIndex);
			if (ayumiChannelIndex < 0 || ayumiChannelIndex >= 3) {
				continue;
			}
			ayumiEngine.applySampleSidVolume(ayumiChannelIndex, playback.volume);
		}
	}

	processInstruments(state, registerState) {
		state.envelopeAddValue = 0;
		if (state.autoEnvelopeActive) {
			this.processAutoEnvelope(state, registerState);
		}
		this.processEnvelopeArpeggio(state);
		this.processEnvelopeEffectTable(state);
		this.processEnvelopeSlide(state);
		this.processEnvelopePortamento(state);
		this.processEnvelopeVibrato(state);

		for (let channelIndex = 0; channelIndex < state.channelInstruments.length; channelIndex++) {
			const isMuted = state.channelMuted[channelIndex];
			const isSoundEnabled = state.channelSoundEnabled[channelIndex];
			const onOffHalted =
				state.channelOnOffCounter[channelIndex] > 0 && !state.channelSoundEnabled[channelIndex];

			if (isMuted) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer.tone = false;
				registerState.channels[channelIndex].mixer.noise = false;
				registerState.channels[channelIndex].mixer.envelope = false;
				this.channelMixerState[channelIndex].tone = false;
				this.channelMixerState[channelIndex].noise = false;
				this.channelMixerState[channelIndex].envelope = false;
				state.channelEnvelopeEnabled[channelIndex] = false;
				continue;
			}

			const instrumentIndex = state.channelInstruments[channelIndex];
			const instrument = state.instruments[instrumentIndex];

			if (instrumentHasSample(instrument)) {
				this.processSampleInstrument(
					state,
					registerState,
					channelIndex,
					instrument,
					isSoundEnabled,
					onOffHalted
				);
				continue;
			}

			if (instrumentIndex < 0 || !instrument) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer.tone = false;
				registerState.channels[channelIndex].mixer.noise = false;
				registerState.channels[channelIndex].mixer.envelope = false;
				this.channelMixerState[channelIndex].tone = false;
				this.channelMixerState[channelIndex].noise = false;
				this.channelMixerState[channelIndex].envelope = false;
				state.channelEnvelopeEnabled[channelIndex] = false;
				continue;
			}

			const hasRows = instrument.rows && instrument.rows.length > 0;
			const defaultInstrumentRow = {
				tone: true,
				noise: false,
				envelope: false,
				retriggerEnvelope: false,
				toneAdd: 0,
				noiseAdd: 0,
				envelopeAdd: 0,
				volume: 15,
				amplitudeSliding: false,
				amplitudeSlideUp: false,
				toneAccumulation: false,
				noiseAccumulation: false,
				envelopeAccumulation: false
			};
			const effectiveRows = hasRows ? instrument.rows : [defaultInstrumentRow];
			const effectiveRowsLength = effectiveRows.length;
			const effectiveLoop = hasRows ? instrument.loop : 0;
			const rowIndex = state.instrumentPositions[channelIndex] % effectiveRowsLength;
			const instrumentRow = effectiveRows[rowIndex];
			if (!instrumentRow) {
				registerState.channels[channelIndex].mixer.tone = false;
				registerState.channels[channelIndex].mixer.noise = false;
				registerState.channels[channelIndex].mixer.envelope = false;
				this.channelMixerState[channelIndex].tone = false;
				this.channelMixerState[channelIndex].noise = false;
				this.channelMixerState[channelIndex].envelope = false;
				if (!onOffHalted) {
					state.instrumentPositions[channelIndex]++;
					if (state.instrumentPositions[channelIndex] >= effectiveRowsLength) {
						if (effectiveLoop > 0 && effectiveLoop < effectiveRowsLength) {
							state.instrumentPositions[channelIndex] = effectiveLoop;
						} else {
							state.instrumentPositions[channelIndex] = 0;
						}
					}
				}
				continue;
			}

			const effectiveTone = this.getEffectiveTone(state, channelIndex);
			if (effectiveTone === 0) {
				if (!onOffHalted) {
					state.instrumentPositions[channelIndex]++;
					if (state.instrumentPositions[channelIndex] >= effectiveRowsLength) {
						if (effectiveLoop > 0 && effectiveLoop < effectiveRowsLength) {
							state.instrumentPositions[channelIndex] = effectiveLoop;
						} else {
							state.instrumentPositions[channelIndex] = 0;
						}
					}
				}
				continue;
			}

			let sampleTone = state.channelToneAccumulator[channelIndex];
			if (instrumentRow.toneAdd !== 0) {
				sampleTone = sampleTone + instrumentRow.toneAdd;
			}

			if (instrumentRow.toneAccumulation) {
				state.channelToneAccumulator[channelIndex] = sampleTone;
			}

			const finalTone = (effectiveTone + sampleTone) & 0xfff;
			registerState.channels[channelIndex].tone = finalTone;

			if (instrumentRow.noise) {
				const noiseValue =
					state.channelNoiseAccumulator[channelIndex] + instrumentRow.noiseAdd;
				if (instrumentRow.noiseAccumulation) {
					state.channelNoiseAccumulator[channelIndex] = noiseValue & 31;
				}
				state.noiseAddValue = noiseValue & 31;
			}

			//not sure about this "if" condition logic from vt2, for now lets leave it there
			if (!instrumentRow.noise) {
				const envelopeAddValue = instrumentRow.envelopeAdd || 0;
				const envelopeValue =
					state.channelEnvelopeAccumulator[channelIndex] + envelopeAddValue;
				if (instrumentRow.envelopeAccumulation) {
					state.channelEnvelopeAccumulator[channelIndex] = envelopeValue & 0xffff;
				}
				state.envelopeAddValue += envelopeValue;
			}

			if (instrumentRow.volume >= 0) {
				state.channelInstrumentVolumes[channelIndex] = instrumentRow.volume;
			}

			if (instrumentRow.amplitudeSliding) {
				if (instrumentRow.amplitudeSlideUp) {
					if (state.channelAmplitudeSliding[channelIndex] < 15) {
						state.channelAmplitudeSliding[channelIndex]++;
					}
				} else {
					if (state.channelAmplitudeSliding[channelIndex] > -15) {
						state.channelAmplitudeSliding[channelIndex]--;
					}
				}
			}

			const patternVolume = state.channelPatternVolumes[channelIndex];
			const instrumentVolume = state.channelInstrumentVolumes[channelIndex];
			const amplitudeSliding = state.channelAmplitudeSliding[channelIndex];

			const envelopeOnOffActive = state.envelopeOnOffCounter > 0;
			const envelopeDisabledByOnOff = envelopeOnOffActive && !state.envelopeOnOffEnabled;

			let finalVolume = this.calculateVolume(
				patternVolume,
				instrumentVolume,
				amplitudeSliding,
				instrumentRow.envelope,
				state.channelEnvelopeEnabled[channelIndex],
				false,
				envelopeDisabledByOnOff
			);

			if (!isSoundEnabled) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer.tone = false;
				registerState.channels[channelIndex].mixer.noise = false;
				registerState.channels[channelIndex].mixer.envelope = false;
				disableTimerEffect(registerState.channels[channelIndex].timerEffect);
				this.channelMixerState[channelIndex].tone = false;
				this.channelMixerState[channelIndex].noise = false;
				this.channelMixerState[channelIndex].envelope = false;
			} else {
				registerState.channels[channelIndex].mixer.tone = instrumentRow.tone;
				registerState.channels[channelIndex].mixer.noise = instrumentRow.noise;
				this.channelMixerState[channelIndex].tone = instrumentRow.tone;
				this.channelMixerState[channelIndex].noise = instrumentRow.noise;

				const ayFields = normalizeAyInstrumentFields(instrument);
				const timerRow = ayFields.timerRows[rowIndex] ?? {
					sid: false,
					syncbuzzer: false,
					fm: false,
					envFm: false
				};
				const sidActive = timerRow.sid && !instrumentRow.envelope;
				const syncbuzzerActive =
					timerRow.syncbuzzer &&
					instrumentRow.envelope &&
					state.channelEnvelopeEnabled[channelIndex] &&
					!envelopeDisabledByOnOff;
				const fmActive = timerRow.fm && instrumentRow.tone;
				const envFmActive =
					timerRow.envFm &&
					instrumentRow.envelope &&
					state.channelEnvelopeEnabled[channelIndex] &&
					!envelopeDisabledByOnOff;
				const activeEffects = {
					sid: sidActive,
					syncbuzzer: syncbuzzerActive,
					fm: fmActive,
					envFm: envFmActive
				};
				const timerEffectPeriod = computeTimerEffectPeriod(finalTone, timerRow);
				const { pwmMode, period, periodLow } = this.resolveCompositeTimerPwmPeriods(
					state,
					channelIndex,
					ayFields,
					timerRow,
					activeEffects,
					timerEffectPeriod
				);

				if (
					instrumentRow.envelope &&
					state.channelEnvelopeEnabled[channelIndex] &&
					!envelopeDisabledByOnOff
				) {
					registerState.channels[channelIndex].mixer.envelope = true;
					this.channelMixerState[channelIndex].envelope = true;
					if (instrumentRow.retriggerEnvelope) {
						registerState.forceEnvelopeShapeWrite = true;
					}
				} else {
					registerState.channels[channelIndex].mixer.envelope = false;
					this.channelMixerState[channelIndex].envelope = false;
				}

				registerState.channels[channelIndex].volume = finalVolume;

				const timerEffectReset = state.channelTimerEffectReset?.[channelIndex] ?? false;
				let targetMask = 0;
				if (sidActive) {
					targetMask |= TIMER_EFFECT_TARGET_VOLUME;
				}
				if (syncbuzzerActive) {
					targetMask |= TIMER_EFFECT_TARGET_ENVELOPE_SHAPE;
				}
				if (fmActive) {
					targetMask |= TIMER_EFFECT_TARGET_TONE;
				}
				if (envFmActive && this.getEffectiveEnvelopePeriod(state) > 0) {
					targetMask |= TIMER_EFFECT_TARGET_ENVELOPE_PERIOD;
				}

				if (targetMask === 0) {
					registerState.channels[channelIndex].timerEffect = createDefaultTimerEffect();
				} else {
					registerState.channels[channelIndex].timerEffect = this.buildChannelCompositeTimerEffect(
						{
							targetMask,
							pwmMode,
							period,
							periodLow,
							finalVolume,
							finalTone,
							baseEnvelopePeriod: this.getEffectiveEnvelopePeriod(state),
							fmOffsetMode: this.resolveCompositeTimerFmOffsetMode(activeEffects, timerRow),
							timerRow,
							patternEnvelopeShape: registerState.envelopeShape,
							tuningTable: state.currentTuningTable,
							timerEffectReset
						}
					);
				}
				if (state.channelTimerEffectReset) {
					state.channelTimerEffectReset[channelIndex] = false;
				}
			}

			if (!onOffHalted) {
				state.instrumentPositions[channelIndex]++;
				if (state.instrumentPositions[channelIndex] >= effectiveRowsLength) {
					if (effectiveLoop > 0 && effectiveLoop < effectiveRowsLength) {
						state.instrumentPositions[channelIndex] = effectiveLoop;
					} else {
						state.instrumentPositions[channelIndex] = 0;
					}
				}
			}
		}

		for (let channelIndex = 0; channelIndex < state.channelInstruments.length; channelIndex++) {
			if (state.channelOnOffCounter[channelIndex] > 0) {
				const result = EffectAlgorithms.processOnOffCounter(
					state.channelOnOffCounter[channelIndex],
					state.channelOnDuration[channelIndex],
					state.channelOffDuration[channelIndex],
					state.channelSoundEnabled[channelIndex]
				);
				state.channelOnOffCounter[channelIndex] = result.counter;
				state.channelSoundEnabled[channelIndex] = result.enabled;
			}
		}

		this.processEnvelopeOnOff(state);

		for (let channelIndex = 0; channelIndex < state.channelInstruments.length; channelIndex++) {
			if (state.channelMuted[channelIndex]) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer = {
					tone: false,
					noise: false,
					envelope: false
				};
				state.channelEnvelopeEnabled[channelIndex] = false;
			}
		}

		registerState.noise = (state.noiseBaseValue + state.noiseAddValue) & 0x1f;

		this.updateEnvelopeWithSlide(state, registerState);
	}

	getEffectiveTone(state, channelIndex) {
		const noteIndex = state.channelCurrentNotes[channelIndex];
		if (noteIndex < 0 || noteIndex >= state.currentTuningTable.length) return 0;
		const baseTone = state.currentTuningTable[noteIndex];
		if (baseTone <= 0) return 0;
		const toneSliding = state.channelToneSliding
			? state.channelToneSliding[channelIndex] || 0
			: 0;
		const vibratoSliding =
			state.channelVibratoSliding && state.channelVibratoSliding[channelIndex]
				? state.channelVibratoSliding[channelIndex]
				: 0;
		const detune = state.channelDetune ? state.channelDetune[channelIndex] || 0 : 0;
		return (baseTone + toneSliding + vibratoSliding + detune) & 0xfff;
	}

	getEffectiveBaseTone(state, channelIndex) {
		const noteIndex = state.channelBaseNotes[channelIndex];
		if (noteIndex < 0 || noteIndex >= state.currentTuningTable.length) return 0;
		const baseTone = state.currentTuningTable[noteIndex];
		if (baseTone <= 0) return 0;
		const toneSliding = state.channelToneSliding
			? state.channelToneSliding[channelIndex] || 0
			: 0;
		const vibratoSliding =
			state.channelVibratoSliding && state.channelVibratoSliding[channelIndex]
				? state.channelVibratoSliding[channelIndex]
				: 0;
		const detune = state.channelDetune ? state.channelDetune[channelIndex] || 0 : 0;
		return (baseTone + toneSliding + vibratoSliding + detune) & 0xfff;
	}

	processAutoEnvelope(state, registerState) {
		const envelopeShape = registerState.envelopeShape;
		const divisor = this.getAutoEnvelopeDivisor(envelopeShape);
		if (divisor === null) return;

		for (let ch = state.channelInstruments.length - 1; ch >= 0; ch--) {
			if (!state.channelEnvelopeEnabled[ch]) continue;
			if (state.channelMuted[ch]) continue;
			if (!state.channelSoundEnabled[ch]) continue;

			const effectiveBaseTone = this.getEffectiveBaseTone(state, ch);
			if (effectiveBaseTone <= 0) continue;

			const envelopeValue = Math.round(
				(effectiveBaseTone * state.autoEnvelopeNumerator) /
					(state.autoEnvelopeDenominator * divisor)
			);
			state.envelopeBaseValue = envelopeValue;
			return;
		}
	}

	getAutoEnvelopeDivisor(envelopeShape) {
		switch (envelopeShape) {
			case 8:
			case 12:
				return 16;
			case 10:
			case 14:
				return 32;
			default:
				return null;
		}
	}

	processEnvelopeVibrato(state) {
		if (state.envelopeVibratoCounter <= 0) {
			state.envelopeVibratoSliding = 0;
			return;
		}
		const result = EffectAlgorithms.processVibratoCounter(
			state.envelopeVibratoCounter,
			state.envelopeVibratoDelay,
			state.envelopeVibratoSpeed,
			state.envelopeVibratoPosition
		);
		state.envelopeVibratoCounter = result.counter;
		state.envelopeVibratoPosition = result.position;
		state.envelopeVibratoSliding = EffectAlgorithms.getVibratoOffset(
			state.envelopeVibratoPosition,
			state.envelopeVibratoSpeed,
			state.envelopeVibratoDepth
		);
	}

	processEnvelopeSlide(state) {
		if (state.envelopeSlideDelayCounter > 0) {
			state.envelopeSlideDelayCounter--;
			if (state.envelopeSlideDelayCounter === 0) {
				state.envelopeSlideDelayCounter = state.envelopeSlideDelay;
				state.envelopeSlideCurrent += state.envelopeSlideDelta;
			}
		}
	}

	processEnvelopePortamento(state) {
		if (state.envelopePortamentoActive && state.envelopePortamentoCount > 0) {
			const result = EffectAlgorithms.processPortamentoCounter(
				state.envelopePortamentoCount,
				state.envelopePortamentoDelay,
				state.envelopePortamentoStep,
				state.envelopeSlideCurrent,
				state.envelopePortamentoDelta,
				state.envelopePortamentoTarget,
				state.envelopeBaseValue
			);
			state.envelopePortamentoCount = result.counter;
			state.envelopeSlideCurrent = result.currentSliding;
			state.envelopeBaseValue = result.baseValue;
			state.envelopePortamentoActive = result.active;
		}
	}

	processEnvelopeOnOff(state) {
		if (state.envelopeOnOffCounter > 0) {
			const result = EffectAlgorithms.processOnOffCounter(
				state.envelopeOnOffCounter,
				state.envelopeOnDuration,
				state.envelopeOffDuration,
				state.envelopeOnOffEnabled
			);
			state.envelopeOnOffCounter = result.counter;
			state.envelopeOnOffEnabled = result.enabled;
		}
	}

	processEnvelopeArpeggio(state) {
		if (state.envelopeArpeggioCounter > 0) {
			const tableIndex = state.envelopeEffectTable;
			const isArpeggioTable =
				tableIndex >= 0 && state.envelopeEffectType === EffectAlgorithms.ARPEGGIO;

			let result;
			let semitoneOffset;

			if (isArpeggioTable) {
				const table = state.getTable(tableIndex);
				const rows = table?.rows ?? [];
				const tableLength = rows.length;
				const tableLoop =
					table?.loop != null && table.loop >= 0 && table.loop < tableLength
						? table.loop
						: -1;
				const pos = state.envelopeEffectTablePosition;

				result = EffectAlgorithms.processArpeggioCounterTable(
					state.envelopeArpeggioCounter,
					state.envelopeArpeggioDelay,
					pos,
					tableLength,
					tableLoop
				);
				state.envelopeEffectTablePosition = result.position;
				semitoneOffset = tableLength > 0 ? (rows[pos] ?? 0) : 0;
			} else {
				const currentPosition = state.envelopeArpeggioPosition;
				result = EffectAlgorithms.processArpeggioCounter(
					state.envelopeArpeggioCounter,
					state.envelopeArpeggioDelay,
					currentPosition
				);
				semitoneOffset = EffectAlgorithms.getArpeggioOffset(
					currentPosition,
					state.envelopeArpeggioSemitone1,
					state.envelopeArpeggioSemitone2
				);
			}

			state.envelopeArpeggioCounter = result.counter;
			state.envelopeArpeggioPosition = result.position;

			const baseEnvelopePeriod = state.envelopeBaseValue;
			if (baseEnvelopePeriod > 0) {
				const baseNoteIndex = this.envelopePeriodToNote(
					baseEnvelopePeriod,
					state.currentTuningTable
				);
				if (baseNoteIndex !== null) {
					const arpeggioNoteIndex = baseNoteIndex + semitoneOffset;
					const maxNote = state.currentTuningTable.length - 1;
					let finalNoteIndex = arpeggioNoteIndex;
					if (finalNoteIndex < 0) finalNoteIndex = 0;
					if (finalNoteIndex > maxNote) finalNoteIndex = maxNote;

					const arpeggioEnvelopePeriod = Math.round(
						state.currentTuningTable[finalNoteIndex] / 16
					);
					state.envelopeArpeggioBaseValue = arpeggioEnvelopePeriod;
				} else {
					state.envelopeArpeggioBaseValue = baseEnvelopePeriod;
				}
			} else {
				state.envelopeArpeggioBaseValue = 0;
			}
		} else {
			state.envelopeArpeggioBaseValue = 0;
		}
	}

	envelopePeriodToNote(envelopePeriod, tuningTable) {
		if (envelopePeriod === 0) {
			return null;
		}

		let nearestNote = -1;
		let bestDistance = Infinity;

		for (let i = 0; i < tuningTable.length; i++) {
			const noteEnvelopePeriod = Math.round(tuningTable[i] / 16);
			if (noteEnvelopePeriod === envelopePeriod) {
				return i;
			}

			const distance = Math.abs(noteEnvelopePeriod - envelopePeriod);
			if (distance < bestDistance) {
				bestDistance = distance;
				nearestNote = i;
			}
		}

		return nearestNote >= 0 ? nearestNote : null;
	}

	updateEnvelopeWithSlide(state, registerState) {
		const wrappedValue = this.getEffectiveEnvelopePeriod(state);
		if (wrappedValue > 0) {
			registerState.envelopePeriod = wrappedValue;
		}
	}

	getEffectiveEnvelopePeriod(state) {
		const baseValue =
			state.envelopeArpeggioCounter > 0
				? state.envelopeArpeggioBaseValue
				: state.envelopeBaseValue;

		if (baseValue <= 0) {
			return 0;
		}

		const vibratoOffset = state.envelopeVibratoSliding ?? 0;
		const detuneOffset = state.envelopeDetune ?? 0;
		const finalEnvelopeValue =
			baseValue +
			state.envelopeSlideCurrent +
			state.envelopeAddValue +
			vibratoOffset +
			detuneOffset;
		return ((finalEnvelopeValue % 0x10000) + 0x10000) % 0x10000;
	}
}

export default AYAudioDriver;
