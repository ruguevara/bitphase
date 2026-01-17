const DEFAULT_SONG_HZ = 50;
const DEFAULT_SPEED = 3;

class TrackerState {
	constructor(channelCount = 3) {
		this.currentPattern = null;
		this.currentTuningTable = [];

		this.patternOrder = [];
		this.currentPatternOrderIndex = 0;

		this.intFrequency = DEFAULT_SONG_HZ;
		this.samplesPerTick = 0;
		this.sampleCounter = 0;
		this.currentRow = 0;
		this.currentTick = 0;
		this.currentSpeed = DEFAULT_SPEED;

		this.channelPatternVolumes = Array(channelCount).fill(15);

		this.tables = [];
		this.channelTables = Array(channelCount).fill(-1);
		this.tablePositions = Array(channelCount).fill(0);
		this.tableCounters = Array(channelCount).fill(0);
		this.channelBaseNotes = Array(channelCount).fill(0);
		this.channelCurrentNotes = Array(channelCount).fill(0);
		this.channelToneSliding = Array(channelCount).fill(0);
		this.channelSlideStep = Array(channelCount).fill(0);
		this.channelSlideDelay = Array(channelCount).fill(0);
		this.channelSlideCount = Array(channelCount).fill(0);
		this.channelPreviousNotes = Array(channelCount).fill(0);
		this.channelPortamentoTarget = Array(channelCount).fill(-1);
		this.channelPortamentoDelta = Array(channelCount).fill(0);
		this.channelPortamentoActive = Array(channelCount).fill(false);
		this.channelPortamentoDelay = Array(channelCount).fill(0);
		this.channelPortamentoCount = Array(channelCount).fill(0);
		this.channelOnDuration = Array(channelCount).fill(0);
		this.channelOffDuration = Array(channelCount).fill(0);
		this.channelOnOffCounter = Array(channelCount).fill(0);
		this.channelArpeggioSemitone1 = Array(channelCount).fill(0);
		this.channelArpeggioSemitone2 = Array(channelCount).fill(0);
		this.channelArpeggioDelay = Array(channelCount).fill(0);
		this.channelArpeggioCounter = Array(channelCount).fill(0);
		this.channelArpeggioPosition = Array(channelCount).fill(0);
		this.channelPWMEnabled = Array(channelCount).fill(false);
		this.channelPWMDutyCycle = Array(channelCount).fill(128);
		this.channelPWMMinDuty = Array(channelCount).fill(0);
		this.channelPWMMaxDuty = Array(channelCount).fill(255);
		this.channelPWMAutomationSpeed = Array(channelCount).fill(0);
		this.channelPWMAutomationDirection = Array(channelCount).fill(1);
		this.channelPWMPhase = Array(channelCount).fill(0);
		this.channelPWMOriginalVolume = Array(channelCount).fill(0);
	}

	reset() {
		this.sampleCounter = 0;
		this.currentRow = 0;
		this.currentTick = 0;
		this.channelPatternVolumes.fill(15);
		this.channelTables.fill(-1);
		this.tablePositions.fill(0);
		this.tableCounters.fill(0);
		this.channelBaseNotes.fill(0);
		this.channelCurrentNotes.fill(0);
		this.channelToneSliding.fill(0);
		this.channelSlideStep.fill(0);
		this.channelSlideDelay.fill(0);
		this.channelSlideCount.fill(0);
		this.channelPreviousNotes.fill(0);
		this.channelPortamentoTarget.fill(-1);
		this.channelPortamentoDelta.fill(0);
		this.channelPortamentoActive.fill(false);
		this.channelPortamentoDelay.fill(0);
		this.channelPortamentoCount.fill(0);
		this.channelOnDuration.fill(0);
		this.channelOffDuration.fill(0);
		this.channelOnOffCounter.fill(0);
		this.channelArpeggioSemitone1.fill(0);
		this.channelArpeggioSemitone2.fill(0);
		this.channelArpeggioDelay.fill(0);
		this.channelArpeggioCounter.fill(0);
		this.channelArpeggioPosition.fill(0);
		this.channelPWMEnabled.fill(false);
		this.channelPWMDutyCycle.fill(128);
		this.channelPWMMinDuty.fill(0);
		this.channelPWMMaxDuty.fill(255);
		this.channelPWMAutomationSpeed.fill(0);
		this.channelPWMAutomationDirection.fill(1);
		this.channelPWMPhase.fill(0);
		this.channelPWMOriginalVolume.fill(0);
	}

	setTuningTable(table) {
		this.currentTuningTable = table;
	}

	updateSamplesPerTick(sampleRate) {
		this.samplesPerTick = Math.floor(sampleRate / this.intFrequency);
	}

	setPattern(pattern, orderIndex) {
		this.currentPattern = pattern;
		if (orderIndex !== undefined) {
			this.currentPatternOrderIndex = orderIndex;
		}
		// Ensure current row is within valid bounds for the new pattern
		if (this.currentPattern && this.currentRow >= this.currentPattern.length) {
			this.currentRow = Math.max(0, this.currentPattern.length - 1);
		}
	}

	setSpeed(speed) {
		this.currentSpeed = speed;
	}

	setPatternOrder(order) {
		this.patternOrder = order;
	}

	setTables(tables) {
		this.tables = tables;
	}

	setIntFrequency(frequency, sampleRate) {
		this.intFrequency = frequency;
		this.updateSamplesPerTick(sampleRate);
	}

	advancePosition() {
		this.currentTick++;
		if (this.currentTick >= this.currentSpeed) {
			this.currentTick = 0;
			this.currentRow++;
			if (this.currentRow >= this.currentPattern.length) {
				this.currentRow = 0;
				this.currentPatternOrderIndex++;
				if (this.currentPatternOrderIndex >= this.patternOrder.length) {
					this.currentPatternOrderIndex = 0;
				}
				return true;
			}
		}
		return false;
	}
}

export default TrackerState;
