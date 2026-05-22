import {
	allRegistersApplyMask,
	AY_REGISTER_COUNT,
	envelopeShapeRegisterApplyMask,
	registerApplyMask,
	sidVolumeLevel,
	volumeRegisterIndex,
	type HardwareSidState,
	type HardwareSyncBuzzerState,
	type SongCaptureFrame
} from './ay-export-utils';
import { encodeEventList } from './tmr-event-list';
import {
	encodeEventPsgApplyMask,
	registerMaskFromEventPsgApplyMask,
	TMR_FRAME_SIZE,
	TMR_HEADER_SIZE,
	TMR_TIMER_EVENT_STOP,
	type TmrEventItemRecord
} from './tmr-format';

export {
	encodeEventPsgApplyMask,
	registerMaskFromEventPsgApplyMask,
	timerIndexFromEventPsgApplyMask,
	TMR_FRAME_SIZE,
	TMR_HEADER_SIZE,
	TMR_ITEM_SIZE,
	TMR_TIMER_EVENT_STOP,
	TMR_PSG_MASK_TIMER_BITS,
	type TmrEventItemRecord
} from './tmr-format';

export type TmrEncodeOptions = {
	chipFrequency: number;
	interruptFrequency: number;
	isYm?: boolean;
	chipIndex?: number;
};

type TimerCommand = {
	interval: number;
	eventIndex: number;
};

type EventItem = TmrEventItemRecord;

export type EncodedTmrFiles = {
	tmr: ArrayBuffer;
	eventList: ArrayBuffer;
	eventItems: EventItem[];
};

export function encodeTMR(
	frames: SongCaptureFrame[],
	options: TmrEncodeOptions
): EncodedTmrFiles {
	const eventItems: EventItem[] = [];
	const chainStartByKey = new Map<string, number>();
	const tmrFrames: Array<{ psgMask: number; timers: TimerCommand[] }> = [];
	const previousSid: HardwareSidState[] = Array.from({ length: 3 }, () => ({
		enabled: false,
		period: 0,
		baseVolume: 0,
		waveform: [15, 0],
		waveformLoop: 0
	}));
	const previousSyncbuzzer: HardwareSyncBuzzerState[] = Array.from({ length: 3 }, () => ({
		enabled: false,
		period: 0,
		shape: 0
	}));

	for (const frame of frames) {
		let psgMask = allRegistersApplyMask();
		const timers: TimerCommand[] = [];

		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			const sid = frame.sid[channelIndex]!;
			const syncbuzzer = frame.syncbuzzer?.[channelIndex] ?? {
				enabled: false,
				period: 0,
				shape: 0
			};
			const prevSid = previousSid[channelIndex]!;
			const prevSyncbuzzer = previousSyncbuzzer[channelIndex]!;

			if (syncbuzzer.enabled) {
				psgMask &= ~envelopeShapeRegisterApplyMask();
				if (!prevSyncbuzzer.enabled || prevSyncbuzzer.shape !== syncbuzzer.shape) {
					const eventIndex = getOrCreateSyncBuzzerEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						syncbuzzer
					);
					timers.push({
						interval: Math.max(1, syncbuzzer.period & 0xffff),
						eventIndex
					});
				} else if (prevSyncbuzzer.period !== syncbuzzer.period) {
					const eventIndex = getOrCreateSyncBuzzerEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						syncbuzzer
					);
					timers.push({
						interval: Math.max(1, syncbuzzer.period & 0xffff),
						eventIndex
					});
				} else {
					timers.push({ interval: 0, eventIndex: 0 });
				}
			} else if (sid.enabled) {
				psgMask &= ~registerApplyMask(volumeRegisterIndex(channelIndex));

				if (!prevSid.enabled || !sidWaveformConfigEqual(prevSid, sid)) {
					const eventIndex = getOrCreateSidEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						sid
					);
					timers.push({
						interval: Math.max(1, sid.period & 0xffff),
						eventIndex
					});
				} else if (prevSid.period !== sid.period) {
					const eventIndex = getOrCreateSidEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						sid
					);
					timers.push({
						interval: Math.max(1, sid.period & 0xffff),
						eventIndex
					});
				} else {
					timers.push({ interval: 0, eventIndex: 0 });
				}
			} else if (prevSid.enabled || prevSyncbuzzer.enabled) {
				timers.push({ interval: 0, eventIndex: TMR_TIMER_EVENT_STOP });
			} else {
				timers.push({ interval: 0, eventIndex: 0 });
			}

			previousSid[channelIndex] = {
				enabled: sid.enabled,
				period: sid.period,
				baseVolume: sid.baseVolume,
				waveform: [...sid.waveform],
				waveformLoop: sid.waveformLoop
			};
			previousSyncbuzzer[channelIndex] = {
				enabled: syncbuzzer.enabled,
				period: syncbuzzer.period,
				shape: syncbuzzer.shape
			};
		}

		tmrFrames.push({ psgMask: registerMaskFromEventPsgApplyMask(psgMask), timers });
	}

	const bodySize = TMR_HEADER_SIZE + tmrFrames.length * TMR_FRAME_SIZE;
	const buffer = new ArrayBuffer(bodySize);
	const view = new DataView(buffer);

	writeHeader(view, tmrFrames.length, options);

	let offset = TMR_HEADER_SIZE;
	for (const frame of tmrFrames) {
		writeU16(view, offset, frame.psgMask);
		offset += 2;
		for (const timer of frame.timers) {
			writeU32(view, offset, timer.interval);
			offset += 4;
			writeU16(view, offset, timer.eventIndex);
			offset += 2;
		}
	}

	return {
		tmr: buffer,
		eventList: encodeEventList(eventItems),
		eventItems
	};
}

function sidWaveformConfigEqual(a: HardwareSidState, b: HardwareSidState): boolean {
	return (
		a.baseVolume === b.baseVolume &&
		a.waveformLoop === b.waveformLoop &&
		a.waveform.length === b.waveform.length &&
		a.waveform.every((value, index) => value === b.waveform[index])
	);
}

export function sidEventChainKey(channelIndex: number, sid: HardwareSidState): string {
	return `${channelIndex}:${sid.baseVolume}:${sid.waveform.join(',')}:${sid.waveformLoop}`;
}

export function syncBuzzerEventChainKey(
	channelIndex: number,
	syncbuzzer: HardwareSyncBuzzerState
): string {
	return `sync:${channelIndex}:${syncbuzzer.shape}`;
}

function getOrCreateSyncBuzzerEventChain(
	eventItems: EventItem[],
	chainStartByKey: Map<string, number>,
	channelIndex: number,
	syncbuzzer: HardwareSyncBuzzerState
): number {
	const key = syncBuzzerEventChainKey(channelIndex, syncbuzzer);
	const existing = chainStartByKey.get(key);
	if (existing !== undefined) {
		return existing;
	}

	const startIndex = eventItems.length;
	chainStartByKey.set(key, startIndex);
	const shapeMask = envelopeShapeRegisterApplyMask();
	const psgData = new Array(AY_REGISTER_COUNT).fill(0);
	psgData[13] = syncbuzzer.shape & 0xf;
	eventItems.push({
		psgData,
		psgMask: encodeEventPsgApplyMask(shapeMask, channelIndex),
		timerInterval: 0,
		timerEventIndex: startIndex
	});

	return startIndex;
}

function getOrCreateSidEventChain(
	eventItems: EventItem[],
	chainStartByKey: Map<string, number>,
	channelIndex: number,
	sid: HardwareSidState
): number {
	const key = sidEventChainKey(channelIndex, sid);
	const existing = chainStartByKey.get(key);
	if (existing !== undefined) {
		return existing;
	}

	const startIndex = eventItems.length;
	chainStartByKey.set(key, startIndex);
	const volumeReg = volumeRegisterIndex(channelIndex);
	const volumeMask = registerApplyMask(volumeReg);

	for (let stepIndex = 0; stepIndex < sid.waveform.length; stepIndex++) {
		const psgData = new Array(AY_REGISTER_COUNT).fill(0);
		psgData[volumeReg] = sidVolumeLevel(sid.waveform[stepIndex]!, sid.baseVolume);
		const relativeNext = resolveNextWaveformIndex(stepIndex, sid);
		eventItems.push({
			psgData,
			psgMask: encodeEventPsgApplyMask(volumeMask, channelIndex),
			timerInterval: 0,
			timerEventIndex: startIndex + relativeNext
		});
	}

	return startIndex;
}

function resolveNextWaveformIndex(stepIndex: number, sid: HardwareSidState): number {
	const nextStep = stepIndex + 1;
	if (nextStep < sid.waveform.length) {
		return nextStep;
	}
	if (sid.waveformLoop >= 0 && sid.waveformLoop < sid.waveform.length) {
		return sid.waveformLoop;
	}
	return 0;
}

function writeHeader(view: DataView, frameCount: number, options: TmrEncodeOptions): void {
	view.setUint8(0, 0x54);
	view.setUint8(1, 0x4d);
	view.setUint8(2, 0x52);
	view.setUint8(3, 0x1a);
	writeU16(view, 4, 1);
	writeU16(view, 6, TMR_HEADER_SIZE);
	writeU16(view, 8, options.isYm ? 1 : 0);
	view.setUint8(10, options.chipIndex ?? 0);
	view.setUint8(11, 0);
	writeU32(view, 12, Math.round(options.interruptFrequency * 65536));
	writeU32(view, 16, options.chipFrequency >>> 0);
	writeU32(view, 20, frameCount >>> 0);
	for (let index = 0; index < 8; index++) {
		view.setUint8(24 + index, 0);
	}
}

function writeU16(view: DataView, offset: number, value: number): void {
	view.setUint16(offset, value & 0xffff, true);
}

function writeU32(view: DataView, offset: number, value: number): void {
	view.setUint32(offset, value >>> 0, true);
}
