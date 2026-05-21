const DEFAULT_SID = {
	enabled: false,
	period: 100,
	baseVolume: 0,
	waveform: [15, 0],
	waveformLoop: 0,
	resetPhase: false
};

class AYChipRegisterState {
	constructor(channelCount = 3) {
		this.channelCount = channelCount;
		this.channels = [];
		for (let i = 0; i < channelCount; i++) {
			this.channels.push({
				tone: 0,
				volume: 0,
				mixer: { tone: false, noise: false, envelope: false },
				sid: { ...DEFAULT_SID, waveform: [...DEFAULT_SID.waveform] }
			});
		}
		this.noise = 0;
		this.envelopePeriod = 0;
		this.envelopeShape = 0;
		this.forceEnvelopeShapeWrite = false;
	}

	reset() {
		for (let i = 0; i < this.channelCount; i++) {
			this.channels[i].tone = 0;
			this.channels[i].volume = 0;
			this.channels[i].mixer = { tone: false, noise: false, envelope: false };
			this.channels[i].sid = { ...DEFAULT_SID, waveform: [...DEFAULT_SID.waveform] };
		}
		this.noise = 0;
		this.envelopePeriod = 0;
		this.envelopeShape = 0;
		this.forceEnvelopeShapeWrite = false;
	}

	resize(newChannelCount) {
		while (this.channels.length < newChannelCount) {
			this.channels.push({
				tone: 0,
				volume: 0,
				mixer: { tone: false, noise: false, envelope: false },
				sid: { ...DEFAULT_SID, waveform: [...DEFAULT_SID.waveform] }
			});
		}
		if (this.channels.length > newChannelCount) {
			this.channels.length = newChannelCount;
		}
		this.channelCount = newChannelCount;
	}

	copy() {
		const copy = new AYChipRegisterState(this.channelCount);
		for (let i = 0; i < this.channelCount; i++) {
			copy.channels[i].tone = this.channels[i].tone;
			copy.channels[i].volume = this.channels[i].volume;
			copy.channels[i].mixer = {
				tone: this.channels[i].mixer.tone,
				noise: this.channels[i].mixer.noise,
				envelope: this.channels[i].mixer.envelope
			};
			const sid = this.channels[i].sid;
			copy.channels[i].sid = {
				enabled: sid.enabled,
				period: sid.period,
				baseVolume: sid.baseVolume,
				waveform: [...sid.waveform],
				waveformLoop: sid.waveformLoop,
				resetPhase: sid.resetPhase
			};
		}
		copy.noise = this.noise;
		copy.envelopePeriod = this.envelopePeriod;
		copy.envelopeShape = this.envelopeShape;
		copy.forceEnvelopeShapeWrite = this.forceEnvelopeShapeWrite;
		return copy;
	}
}

export default AYChipRegisterState;
