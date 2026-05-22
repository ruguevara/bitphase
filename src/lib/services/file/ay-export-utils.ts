export const AY_REGISTER_COUNT = 14;
export const TONE_CHANNELS = 3;

export type HardwareSidState = {
	enabled: boolean;
	period: number;
	baseVolume: number;
	waveform: number[];
	waveformLoop: number;
};

export type SongCaptureFrame = {
	registers: number[];
	sid: HardwareSidState[];
};

export function convertRegisterStateToAYRegisters(registerState: {
	channels: Array<{
		tone: number;
		volume: number;
		mixer: { tone: boolean; noise: boolean; envelope: boolean };
		sid?: HardwareSidState;
	}>;
	noise: number;
	envelopePeriod: number;
	envelopeShape: number;
}): number[] {
	const registers = new Array(AY_REGISTER_COUNT).fill(0);

	for (let channelIndex = 0; channelIndex < TONE_CHANNELS; channelIndex++) {
		const channel = registerState.channels[channelIndex];
		const toneReg = channelIndex * 2;
		const tone = channel.tone & 0xfff;
		registers[toneReg] = tone & 0xff;
		registers[toneReg + 1] = (tone >> 8) & 0x0f;
	}

	registers[6] = registerState.noise & 0x1f;

	let mixer = 0;
	for (let channelIndex = 0; channelIndex < TONE_CHANNELS; channelIndex++) {
		const channel = registerState.channels[channelIndex];
		if (!channel.mixer.tone) {
			mixer |= 1 << channelIndex;
		}
		if (!channel.mixer.noise) {
			mixer |= 1 << (channelIndex + 3);
		}
	}
	registers[7] = mixer;

	for (let channelIndex = 0; channelIndex < TONE_CHANNELS; channelIndex++) {
		const channel = registerState.channels[channelIndex];
		let volume = channel.volume & 0x0f;
		if (channel.mixer.envelope) {
			volume |= 0x10;
		}
		registers[8 + channelIndex] = volume;
	}

	const envelopePeriod = registerState.envelopePeriod & 0xffff;
	registers[11] = envelopePeriod & 0xff;
	registers[12] = (envelopePeriod >> 8) & 0xff;

	registers[13] = registerState.envelopeShape & 0x0f;

	return registers;
}

export function registerApplyMask(regIndex: number): number {
	return 0x8000 >> regIndex;
}

export function allRegistersApplyMask(): number {
	let mask = 0;
	for (let regIndex = 0; regIndex < AY_REGISTER_COUNT; regIndex++) {
		mask |= registerApplyMask(regIndex);
	}
	return mask;
}

export function volumeRegisterIndex(channelIndex: number): number {
	return 8 + channelIndex;
}

export function sidVolumeLevel(waveformStep: number, baseVolume: number): number {
	const w = waveformStep & 0xf;
	if (w === 0) {
		return 0;
	}
	const vol = Math.floor((w * baseVolume + 14) / 15);
	return Math.min(15, vol);
}

export function extractHardwareSidStates(registerState: {
	channels: Array<{ sid?: HardwareSidState }>;
}): HardwareSidState[] {
	const result: HardwareSidState[] = [];
	for (let channelIndex = 0; channelIndex < TONE_CHANNELS; channelIndex++) {
		const sid = registerState.channels[channelIndex]?.sid;
		result.push({
			enabled: sid?.enabled ?? false,
			period: sid?.period ?? 0,
			baseVolume: sid?.baseVolume ?? 0,
			waveform: [...(sid?.waveform ?? [15, 0])],
			waveformLoop: sid?.waveformLoop ?? 0
		});
	}
	return result;
}

export function sidStatesEqual(a: HardwareSidState, b: HardwareSidState): boolean {
	return (
		a.enabled === b.enabled &&
		a.period === b.period &&
		a.baseVolume === b.baseVolume &&
		a.waveformLoop === b.waveformLoop &&
		a.waveform.length === b.waveform.length &&
		a.waveform.every((value, index) => value === b.waveform[index])
	);
}
