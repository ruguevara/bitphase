class EffectAlgorithms {
	static initSlide(parameter, delay) {
		const normalizedDelay = delay || 1;
		const effectiveDelay = normalizedDelay === 0 ? 1 : normalizedDelay;
		return {
			step: parameter,
			delay: effectiveDelay,
			counter: effectiveDelay,
			current: parameter
		};
	}

	static processSlideCounter(counter, delay, step, current, alreadyApplied) {
		if (counter > 0) {
			const newCounter = counter - 1;
			if (newCounter === 0) {
				const newCurrent = alreadyApplied ? current : current + step;
				return {
					counter: delay,
					current: newCurrent,
					applied: false
				};
			}
			return {
				counter: newCounter,
				current,
				applied: alreadyApplied
			};
		}
		return { counter, current, applied: alreadyApplied };
	}

	static initPortamento(currentValue, targetValue, parameter, delay) {
		const delta = targetValue - currentValue;
		let step = parameter;
		if (delta < 0) {
			step = -parameter;
		}

		const normalizedDelay = delay || 1;
		const effectiveDelay = normalizedDelay === 0 ? 1 : normalizedDelay;

		return {
			target: targetValue,
			delta,
			step,
			delay: effectiveDelay,
			counter: effectiveDelay,
			active: true,
			currentSliding: 0
		};
	}

	static processPortamentoCounter(
		counter,
		delay,
		step,
		currentSliding,
		delta,
		target,
		baseValue
	) {
		if (counter > 0) {
			const newCounter = counter - 1;
			if (newCounter === 0) {
				if ((step >= 0 && currentSliding >= delta) || (step < 0 && currentSliding <= delta)) {
					return {
						counter: 0,
						currentSliding: 0,
						baseValue: target,
						active: false
					};
				}
				return {
					counter: delay,
					currentSliding: currentSliding + step,
					baseValue,
					active: true
				};
			}
			return {
				counter: newCounter,
				currentSliding,
				baseValue,
				active: true
			};
		}
		return {
			counter,
			currentSliding,
			baseValue,
			active: true
		};
	}

	static initOnOff(parameter) {
		const offDuration = parameter & 15;
		const onDuration = parameter >> 4;
		return {
			onDuration,
			offDuration,
			counter: onDuration,
			enabled: true
		};
	}

	static processOnOffCounter(counter, onDuration, offDuration, enabled) {
		if (counter > 0) {
			const newCounter = counter - 1;
			if (newCounter === 0) {
				const newEnabled = !enabled;
				return {
					counter: newEnabled ? onDuration : offDuration,
					enabled: newEnabled
				};
			}
			return {
				counter: newCounter,
				enabled
			};
		}
		return { counter, enabled };
	}

	static initArpeggio(parameter, delay) {
		const semitone1 = (parameter >> 4) & 15;
		const semitone2 = parameter & 15;
		const normalizedDelay = delay || 1;
		const effectiveDelay = normalizedDelay === 0 ? 1 : normalizedDelay;
		return {
			semitone1,
			semitone2,
			delay: effectiveDelay,
			counter: effectiveDelay,
			position: 0
		};
	}

	static processArpeggioCounter(counter, delay, position) {
		if (counter > 0) {
			const newCounter = counter - 1;
			if (newCounter === 0) {
				const newPosition = (position + 1) % 3;
				return {
					counter: delay,
					position: newPosition
				};
			}
			return {
				counter: newCounter,
				position
			};
		}
		return { counter, position };
	}

	static getArpeggioOffset(position, semitone1, semitone2) {
		if (position === 1) return semitone1;
		if (position === 2) return semitone2;
		return 0;
	}

	static initPWM(parameter, automationSpeed) {
		const minDutyNibble = (parameter >> 4) & 0xF;
		const maxDutyNibble = parameter & 0xF;

		const minDuty = minDutyNibble * 17;
		const maxDuty = maxDutyNibble * 17;

		return {
			dutyCycle: minDuty,
			minDuty: minDuty,
			maxDuty: maxDuty,
			automationSpeed: automationSpeed,
			direction: 1,
			enabled: true
		};
	}

	static processPWMAutomation(currentDutyCycle, minDuty, maxDuty, speed, direction) {
		if (speed === 0) {
			return {
				dutyCycle: currentDutyCycle,
				direction: direction
			};
		}

		let newDutyCycle = currentDutyCycle + (speed * direction);

		let newDirection = direction;
		if (newDutyCycle >= maxDuty) {
			newDutyCycle = maxDuty;
			newDirection = -1;
		} else if (newDutyCycle <= minDuty) {
			newDutyCycle = minDuty;
			newDirection = 1;
		}

		return {
			dutyCycle: newDutyCycle,
			direction: newDirection
		};
	}
}

export default EffectAlgorithms;
