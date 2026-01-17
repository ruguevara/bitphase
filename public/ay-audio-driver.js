import AYChipRegisterState from './ay-chip-register-state.js';
import EffectAlgorithms from './effect-algorithms.js';

const PT3_VOL = [
	[
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00
	],
	[
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
		0x01
	],
	[
		0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x02, 0x02, 0x02,
		0x02
	],
	[
		0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, 0x03,
		0x03
	],
	[
		0x00, 0x00, 0x01, 0x01, 0x01, 0x01, 0x02, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04,
		0x04
	],
	[
		0x00, 0x00, 0x01, 0x01, 0x01, 0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x04, 0x04, 0x04, 0x05,
		0x05
	],
	[
		0x00, 0x00, 0x01, 0x01, 0x02, 0x02, 0x02, 0x03, 0x03, 0x04, 0x04, 0x04, 0x05, 0x05, 0x06,
		0x06
	],
	[
		0x00, 0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x04, 0x05, 0x05, 0x06, 0x06, 0x07,
		0x07
	],
	[
		0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x04, 0x05, 0x05, 0x06, 0x06, 0x07, 0x07,
		0x08
	],
	[
		0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x04, 0x04, 0x05, 0x05, 0x06, 0x07, 0x07, 0x08, 0x08,
		0x09
	],
	[
		0x00, 0x01, 0x01, 0x02, 0x03, 0x03, 0x04, 0x05, 0x05, 0x06, 0x07, 0x07, 0x08, 0x09, 0x09,
		0x0a
	],
	[
		0x00, 0x01, 0x01, 0x02, 0x03, 0x04, 0x04, 0x05, 0x06, 0x07, 0x07, 0x08, 0x09, 0x0a, 0x0a,
		0x0b
	],
	[
		0x00, 0x01, 0x02, 0x02, 0x03, 0x04, 0x05, 0x06, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0a, 0x0b,
		0x0c
	],
	[
		0x00, 0x01, 0x02, 0x03, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0a, 0x0b, 0x0c,
		0x0d
	],
	[
		0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
		0x0e
	],
	[0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]
];

class AYAudioDriver {
	constructor() {
		this.channelMixerState = [
			{ tone: true, noise: true, envelope: false },
			{ tone: true, noise: true, envelope: false },
			{ tone: true, noise: true, envelope: false }
		];
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

		let finalVolume = PT3_VOL[patternVolume][vol];

		if (instrumentEnvelopeEnabled && channelEnvelopeEnabled && !envelopeDisabledByOnOff) {
			finalVolume = finalVolume | 16;
		}

		return finalVolume;
	}

	resetInstrumentAccumulators(state, channelIndex) {
		state.channelToneAccumulator[channelIndex] = 0;
		state.channelNoiseAccumulator[channelIndex] = 0;
		state.channelEnvelopeAccumulator[channelIndex] = 0;
		state.channelAmplitudeSliding[channelIndex] = 0;
		if (state.channelToneSliding) {
			const hasActiveSlide =
				state.channelSlideStep && state.channelSlideStep[channelIndex] !== 0;
			const hasActivePortamento =
				state.channelPortamentoActive && state.channelPortamentoActive[channelIndex];
			if (!hasActiveSlide && !hasActivePortamento) {
				state.channelToneSliding[channelIndex] = 0;
			}
		}
	}

	processPatternRow(state, pattern, rowIndex, patternRow, registerState) {
		state.noiseBaseValue = patternRow.noiseValue || 0;
		state.noiseAddValue = 0;

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
				this._processEnvelope(state, channelIndex, row, patternRow, registerState);
			}
		}
	}

	_processNote(state, channelIndex, row, registerState) {
		if (state.channelMuted[channelIndex]) return;

		if (row.note.name === 1) {
			state.channelSoundEnabled[channelIndex] = false;
			registerState.channels[channelIndex].tone = 0;
			this.resetInstrumentAccumulators(state, channelIndex);
			state.instrumentPositions[channelIndex] = 0;
		} else if (row.note.name !== 0) {
			state.channelSoundEnabled[channelIndex] = true;
			const noteValue = row.note.name - 2 + (row.note.octave - 1) * 12;
			if (noteValue >= 0 && noteValue < state.currentTuningTable.length) {
				const regValue = state.currentTuningTable[noteValue];
				registerState.channels[channelIndex].tone = regValue;
			}
			if (state.instrumentPositions) {
				state.instrumentPositions[channelIndex] = 0;
			}
			this.resetInstrumentAccumulators(state, channelIndex);
		}
	}

	_processInstrument(state, channelIndex, row) {
		if (!state.channelInstruments || !state.instruments) return;
		if (state.channelMuted[channelIndex]) return;

		if (row.instrument > 0) {
			const instrumentIndex = state.instrumentIdToIndex.get(row.instrument);
			if (instrumentIndex !== undefined && state.instruments[instrumentIndex]) {
				state.channelInstruments[channelIndex] = instrumentIndex;
				state.instrumentPositions[channelIndex] = 0;
				this.resetInstrumentAccumulators(state, channelIndex);
			}
		}

		if (state.channelInstruments[channelIndex] < 0) {
			state.channelInstruments[channelIndex] = 0;
		}
	}

	_processEnvelope(state, channelIndex, row, patternRow, registerState) {
		if (!state.channelEnvelopeEnabled) return;
		if (state.channelMuted[channelIndex]) return;

		if (row.envelopeShape !== 0 && row.envelopeShape !== 15) {
			if (patternRow.envelopeValue >= 0) {
				state.envelopeBaseValue = patternRow.envelopeValue;
				state.envelopeSlideCurrent = 0;
				state.envelopeSlideDelta = 0;
				state.envelopeSlideDelay = 0;
				state.envelopeSlideDelayCounter = 0;
				const finalEnvelopeValue = patternRow.envelopeValue;
				registerState.envelopePeriod = finalEnvelopeValue;
				registerState.envelopeShape = row.envelopeShape;
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

	_processEnvelopeEffects(state, channelIndex, row, patternRow) {
		if (!patternRow || !patternRow.envelopeEffect) return;

		const effect = patternRow.envelopeEffect;
		const ARPEGGIO = 'A'.charCodeAt(0);
		const SLIDE_UP = 1;
		const SLIDE_DOWN = 2;
		const PORTAMENTO = 'P'.charCodeAt(0);
		const ON_OFF = 6;

		if (effect.effect === ARPEGGIO) {
			const arpeggioState = EffectAlgorithms.initArpeggio(effect.parameter, effect.delay);
			state.envelopeArpeggioSemitone1 = arpeggioState.semitone1;
			state.envelopeArpeggioSemitone2 = arpeggioState.semitone2;
			state.envelopeArpeggioDelay = arpeggioState.delay;
			state.envelopeArpeggioCounter = arpeggioState.counter;
			state.envelopeArpeggioPosition = arpeggioState.position;
		} else if (effect.effect === SLIDE_UP) {
			const slideState = EffectAlgorithms.initSlide(effect.parameter, effect.delay);
			state.envelopeSlideDelay = slideState.delay;
			state.envelopeSlideDelayCounter = slideState.counter;
			state.envelopeSlideDelta = slideState.step;
			state.envelopePortamentoActive = false;
			state.envelopeOnOffCounter = 0;
		} else if (effect.effect === SLIDE_DOWN) {
			const slideState = EffectAlgorithms.initSlide(-effect.parameter, effect.delay);
			state.envelopeSlideDelay = slideState.delay;
			state.envelopeSlideDelayCounter = slideState.counter;
			state.envelopeSlideDelta = slideState.step;
			state.envelopePortamentoActive = false;
			state.envelopeOnOffCounter = 0;
		} else if (effect.effect === PORTAMENTO) {
			if (patternRow.envelopeValue >= 0) {
				const targetValue = patternRow.envelopeValue;
				const currentValue = state.envelopeBaseValue;

				if (currentValue >= 0) {
					const portamentoState = EffectAlgorithms.initPortamento(
						currentValue,
						targetValue,
						effect.parameter,
						effect.delay
					);
					state.envelopePortamentoTarget = portamentoState.target;
					state.envelopePortamentoDelta = portamentoState.delta;
					state.envelopePortamentoActive = portamentoState.active;
					state.envelopePortamentoStep = portamentoState.step;
					state.envelopePortamentoDelay = portamentoState.delay;
					state.envelopePortamentoCount = portamentoState.counter;

					state.envelopeSlideDelta = 0;
					state.envelopeSlideDelayCounter = 0;
					state.envelopeOnOffCounter = 0;
				}
			}
		} else if (effect.effect === ON_OFF) {
			const onOffState = EffectAlgorithms.initOnOff(effect.parameter);
			state.envelopeOffDuration = onOffState.offDuration;
			state.envelopeOnDuration = onOffState.onDuration;
			state.envelopeOnOffCounter = onOffState.counter;
			state.envelopeOnOffEnabled = onOffState.enabled;
			state.envelopeSlideDelta = 0;
			state.envelopeSlideDelayCounter = 0;
			state.envelopePortamentoActive = false;
		}
	}

	processInstruments(state, registerState) {
		this.processEnvelopeSlide(state);
		this.processEnvelopePortamento(state);
		this.processEnvelopeOnOff(state);
		this.updateEnvelopeWithSlide(state, registerState);
		this.processEnvelopeArpeggio(state, registerState);

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

			const isMuted = state.channelMuted[channelIndex];
			const isSoundEnabled = state.channelSoundEnabled[channelIndex];

			if (isMuted || !isSoundEnabled) {
				registerState.channels[channelIndex].volume = 0;
				registerState.channels[channelIndex].mixer.tone = false;
				registerState.channels[channelIndex].mixer.noise = false;
				registerState.channels[channelIndex].mixer.envelope = false;
				this.channelMixerState[channelIndex].tone = false;
				this.channelMixerState[channelIndex].noise = false;
				this.channelMixerState[channelIndex].envelope = false;
				if (isMuted) {
					state.channelEnvelopeEnabled[channelIndex] = false;
				}
				continue;
			}

			const instrumentIndex = state.channelInstruments[channelIndex];
			const instrument = state.instruments[instrumentIndex];

			if (!instrument || !instrument.rows || instrument.rows.length === 0) {
				continue;
			}

			const instrumentRow = instrument.rows[state.instrumentPositions[channelIndex]];
			if (!instrumentRow) {
				state.instrumentPositions[channelIndex]++;
				if (state.instrumentPositions[channelIndex] >= instrument.rows.length) {
					if (instrument.loop > 0 && instrument.loop < instrument.rows.length) {
						state.instrumentPositions[channelIndex] = instrument.loop;
					} else {
						state.instrumentPositions[channelIndex] = 0;
					}
				}
				continue;
			}

			const currentNote = state.channelCurrentNotes[channelIndex];
			let noteTone = 0;
			if (currentNote >= 0 && currentNote < state.currentTuningTable.length) {
				noteTone = state.currentTuningTable[currentNote];
			}

			if (noteTone === 0) {
				state.instrumentPositions[channelIndex]++;
				if (state.instrumentPositions[channelIndex] >= instrument.rows.length) {
					if (instrument.loop > 0 && instrument.loop < instrument.rows.length) {
						state.instrumentPositions[channelIndex] = instrument.loop;
					} else {
						state.instrumentPositions[channelIndex] = 0;
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

			const toneSliding = state.channelToneSliding
				? state.channelToneSliding[channelIndex] || 0
				: 0;
			const finalTone = (noteTone + sampleTone + toneSliding) & 0xfff;
			registerState.channels[channelIndex].tone = finalTone;

			if (instrumentRow.noise) {
				const noiseValue =
					state.channelNoiseAccumulator[channelIndex] + instrumentRow.noiseAdd;
				if (instrumentRow.noiseAccumulation) {
					state.channelNoiseAccumulator[channelIndex] = noiseValue & 31;
				}
				state.noiseAddValue = noiseValue & 31;
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

			registerState.channels[channelIndex].mixer.tone = instrumentRow.tone;
			registerState.channels[channelIndex].mixer.noise = instrumentRow.noise;
			this.channelMixerState[channelIndex].tone = instrumentRow.tone;
			this.channelMixerState[channelIndex].noise = instrumentRow.noise;

			if (
				instrumentRow.envelope &&
				state.channelEnvelopeEnabled[channelIndex] &&
				!envelopeDisabledByOnOff
			) {
				registerState.channels[channelIndex].mixer.envelope = true;
				this.channelMixerState[channelIndex].envelope = true;
			} else {
				registerState.channels[channelIndex].mixer.envelope = false;
				this.channelMixerState[channelIndex].envelope = false;
			}

			registerState.channels[channelIndex].volume = finalVolume;

			state.instrumentPositions[channelIndex]++;
			if (state.instrumentPositions[channelIndex] >= instrument.rows.length) {
				if (instrument.loop > 0 && instrument.loop < instrument.rows.length) {
					state.instrumentPositions[channelIndex] = instrument.loop;
				} else {
					state.instrumentPositions[channelIndex] = 0;
				}
			}
		}

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

	processEnvelopeArpeggio(state, registerState) {
		if (state.envelopeArpeggioCounter > 0) {
			const result = EffectAlgorithms.processArpeggioCounter(
				state.envelopeArpeggioCounter,
				state.envelopeArpeggioDelay,
				state.envelopeArpeggioPosition
			);
			state.envelopeArpeggioCounter = result.counter;
			state.envelopeArpeggioPosition = result.position;

			const baseEnvelopePeriod = state.envelopeBaseValue;
			if (baseEnvelopePeriod > 0) {
				const semitoneOffset = EffectAlgorithms.getArpeggioOffset(
					result.position,
					state.envelopeArpeggioSemitone1,
					state.envelopeArpeggioSemitone2
				);

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
					registerState.envelopePeriod = arpeggioEnvelopePeriod;
				}
			}
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
		if (state.envelopeBaseValue > 0) {
			const finalEnvelopeValue = state.envelopeBaseValue + state.envelopeSlideCurrent;
			const wrappedValue = ((finalEnvelopeValue % 0x10000) + 0x10000) % 0x10000;
			registerState.envelopePeriod = wrappedValue;
		}
	}

	processPWMAutomation(state) {
		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			if (state.channelPWMEnabled[channelIndex]) {
				const result = EffectAlgorithms.processPWMAutomation(
					state.channelPWMDutyCycle[channelIndex],
					state.channelPWMMinDuty[channelIndex],
					state.channelPWMMaxDuty[channelIndex],
					state.channelPWMAutomationSpeed[channelIndex],
					state.channelPWMAutomationDirection[channelIndex]
				);
				state.channelPWMDutyCycle[channelIndex] = result.dutyCycle;
				state.channelPWMAutomationDirection[channelIndex] = result.direction;
			}
		}
	}

	savePWMOriginalVolumes(state, registerState) {
		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			if (state.channelPWMEnabled[channelIndex]) {
				state.channelPWMOriginalVolume[channelIndex] =
					registerState.channels[channelIndex].volume;
			}
		}
	}

	processPWMPerSample(state, registerState, aymFrequency, sampleRate) {
		const clocksPerSample = aymFrequency / sampleRate / 8;

		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			if (!state.channelPWMEnabled[channelIndex]) {
				continue;
			}

			const tonePeriod = registerState.channels[channelIndex].tone;
			if (tonePeriod === 0) {
				continue;
			}

			const dutyCycle = state.channelPWMDutyCycle[channelIndex];
			const phase = state.channelPWMPhase[channelIndex];

			const normalizedPhase = (phase % tonePeriod) / tonePeriod;
			const normalizedDuty = Math.min(dutyCycle / 255, 1.0);

			if (normalizedPhase < normalizedDuty) {
				registerState.channels[channelIndex].volume =
					state.channelPWMOriginalVolume[channelIndex];
			} else {
				registerState.channels[channelIndex].volume = 0;
			}

			state.channelPWMPhase[channelIndex] = (phase + clocksPerSample) % tonePeriod;
		}
	}
}

export default AYAudioDriver;
