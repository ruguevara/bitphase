import {
	AY_REGISTER_COUNT,
	envelopeShapeRegisterApplyMask,
	registersChangedMask,
	registerApplyMask,
	sidVolumeLevel,
	timerPwmStepPeriod,
	volumeRegisterIndex,
	type HardwareSidState,
	type HardwareSyncBuzzerState,
	type SongCaptureFrame
} from './ay-export-utils';
import { encodeEventList } from './tmr-event-list';
import {
	encodeEventPsgApplyMask,
	exportTimerFrequencyStoredFromYmPeriod,
	registerMaskFromEventPsgApplyMask,
	TMR_FRAME_SIZE,
	TMR_HEADER_SIZE,
	TMR_TIMER_EVENT_STOP,
	type TmrEventItemRecord
} from './tmr-format';

export {
	encodeEventPsgApplyMask,
	decodeTimerFrequencyHz,
	encodeTimerFrequencyHz,
	registerMaskFromEventPsgApplyMask,
	timerFrequencyHzToPeriodTicks,
	timerIndexFromEventPsgApplyMask,
	timerPeriodTicksToFrequencyHz,
	TMR_FRAME_SIZE,
	TMR_HEADER_SIZE,
	TMR_ITEM_SIZE,
	TMR_TIMER_EVENT_STOP,
	TMR_TIMER_FREQUENCY_SCALE,
	TMR_PSG_MASK_TIMER_BITS,
	type TmrEventItemRecord
} from './tmr-format';

export type TmrEncodeOptions = {
	chipFrequency: number;
	interruptFrequency: number;
	isYm?: boolean;
	chipIndex?: number;
};

function encodeExportTimerFrequencyHz(ymPeriod: number, options: TmrEncodeOptions): number {
	return exportTimerFrequencyStoredFromYmPeriod(ymPeriod, options.chipFrequency);
}

function sidStartPeriod(sid: HardwareSidState): number {
	return timerPwmStepPeriod(sid.waveform[0] ?? 0, sid.period, sid.periodLow);
}

function normalizeSidPeriods(sid: HardwareSidState): HardwareSidState {
	return {
		...sid,
		periodLow: sid.periodLow > 0 ? sid.periodLow : sid.period
	};
}

function isSidPwmActive(sid: HardwareSidState): boolean {
	const normalized = normalizeSidPeriods(sid);
	return normalized.pwm || normalized.period !== normalized.periodLow;
}

function pwmDutyRatio(sid: HardwareSidState): number {
	const normalized = normalizeSidPeriods(sid);
	const high = Math.max(1, normalized.period);
	const low = Math.max(1, normalized.periodLow);
	return high / (high + low);
}

export function isSidPwmDutySweep(prev: HardwareSidState, next: HardwareSidState): boolean {
	if (!prev.enabled || !next.enabled) {
		return false;
	}
	if (!sidWaveformConfigEqual(prev, next)) {
		return false;
	}
	const previous = normalizeSidPeriods(prev);
	const current = normalizeSidPeriods(next);
	if (previous.period === current.period && previous.periodLow === current.periodLow) {
		return false;
	}
	if (!isSidPwmActive(current)) {
		return false;
	}
	return pwmDutyRatio(previous) !== pwmDutyRatio(current);
}

function sidEventStepPeriod(sid: HardwareSidState, stepIndex: number): number {
	return timerPwmStepPeriod(sid.waveform[stepIndex] ?? 0, sid.period, sid.periodLow);
}

function previousWaveformStepIndex(stepIndex: number, sid: HardwareSidState): number {
	if (stepIndex > 0) {
		return stepIndex - 1;
	}
	for (let index = sid.waveform.length - 1; index >= 0; index--) {
		if (resolveNextWaveformIndex(index, sid) === stepIndex) {
			return index;
		}
	}
	return sid.waveform.length - 1;
}

export function encodeSidEventTimerFrequency(
	stepIndex: number,
	sid: HardwareSidState,
	options: TmrEncodeOptions
): number {
	const currentPeriod = sidEventStepPeriod(sid, stepIndex);
	const previousPeriod = sidEventStepPeriod(sid, previousWaveformStepIndex(stepIndex, sid));
	if (currentPeriod === previousPeriod) {
		return 0;
	}
	return encodeExportTimerFrequencyHz(currentPeriod, options);
}

function appendSidEventChain(
	eventItems: EventItem[],
	channelIndex: number,
	sid: HardwareSidState,
	options: TmrEncodeOptions
): number {
	const startIndex = eventItems.length;
	const volumeReg = volumeRegisterIndex(channelIndex);
	const volumeMask = registerApplyMask(volumeReg);

	for (let stepIndex = 0; stepIndex < sid.waveform.length; stepIndex++) {
		const psgData = new Array(AY_REGISTER_COUNT).fill(0);
		psgData[volumeReg] = sidVolumeLevel(sid.waveform[stepIndex]!, sid.baseVolume);
		const nextIndex = resolveNextWaveformIndex(stepIndex, sid);
		eventItems.push({
			psgData,
			psgMask: encodeEventPsgApplyMask(volumeMask, channelIndex),
			timerFrequency: encodeSidEventTimerFrequency(stepIndex, sid, options),
			timerEventIndex: startIndex + nextIndex
		});
	}

	return startIndex;
}

type TimerCommand = {
	frequency: number;
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
		pwm: false,
		period: 0,
		periodLow: 0,
		baseVolume: 0,
		waveform: [15, 0],
		waveformLoop: 0
	}));
	const previousSyncbuzzer: HardwareSyncBuzzerState[] = Array.from({ length: 3 }, () => ({
		enabled: false,
		period: 0,
		shape: 0
	}));
	let previousRegisters = new Array(AY_REGISTER_COUNT).fill(0);

	for (const frame of frames) {
		const psgMask = registersChangedMask(frame.registers, previousRegisters);
		previousRegisters = [...frame.registers];
		const timers: TimerCommand[] = [];

		for (let channelIndex = 0; channelIndex < 3; channelIndex++) {
			const sid = frame.sid[channelIndex]!;
			const effectiveSid: HardwareSidState = sid.enabled
				? {
						...sid,
						pwm: true,
						periodLow: sid.periodLow > 0 ? sid.periodLow : sid.period
					}
				: sid;
			const syncbuzzer = frame.syncbuzzer?.[channelIndex] ?? {
				enabled: false,
				period: 0,
				shape: 0
			};
			const prevSid = previousSid[channelIndex]!;
			const prevSyncbuzzer = previousSyncbuzzer[channelIndex]!;

			if (syncbuzzer.enabled) {
				if (!prevSyncbuzzer.enabled || prevSyncbuzzer.shape !== syncbuzzer.shape) {
					const eventIndex = getOrCreateSyncBuzzerEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						syncbuzzer
					);
					timers.push({
						frequency: encodeExportTimerFrequencyHz(syncbuzzer.period, options),
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
						frequency: encodeExportTimerFrequencyHz(syncbuzzer.period, options),
						eventIndex
					});
				} else {
					timers.push({ frequency: 0, eventIndex: 0 });
				}
			} else if (sid.enabled) {
				const sidWaveformChanged =
					!prevSid.enabled || !sidWaveformConfigEqual(prevSid, effectiveSid);
				const sidPeriodChanged =
					prevSid.period !== effectiveSid.period ||
					prevSid.periodLow !== effectiveSid.periodLow;
				if (sidWaveformChanged) {
					const eventIndex = getOrCreateSidEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						effectiveSid,
						options
					);
					timers.push({
						frequency: encodeExportTimerFrequencyHz(sidStartPeriod(effectiveSid), options),
						eventIndex
					});
				} else if (sidPeriodChanged && isSidPwmDutySweep(prevSid, effectiveSid)) {
					const eventIndex = appendSidEventChain(
						eventItems,
						channelIndex,
						effectiveSid,
						options
					);
					timers.push({
						frequency: encodeExportTimerFrequencyHz(sidStartPeriod(effectiveSid), options),
						eventIndex
					});
				} else if (sidPeriodChanged) {
					const eventIndex = getOrCreateSidEventChain(
						eventItems,
						chainStartByKey,
						channelIndex,
						effectiveSid,
						options
					);
					timers.push({
						frequency: encodeExportTimerFrequencyHz(effectiveSid.period, options),
						eventIndex
					});
				} else {
					timers.push({ frequency: 0, eventIndex: 0 });
				}
			} else if (prevSid.enabled || prevSyncbuzzer.enabled) {
				timers.push({ frequency: 0, eventIndex: TMR_TIMER_EVENT_STOP });
			} else {
				timers.push({ frequency: 0, eventIndex: 0 });
			}

			previousSid[channelIndex] = {
				enabled: sid.enabled,
				pwm: effectiveSid.pwm,
				period: effectiveSid.period,
				periodLow: effectiveSid.periodLow,
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
			writeU32(view, offset, timer.frequency);
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
		timerFrequency: 0,
		timerEventIndex: startIndex
	});

	return startIndex;
}

function getOrCreateSidEventChain(
	eventItems: EventItem[],
	chainStartByKey: Map<string, number>,
	channelIndex: number,
	sid: HardwareSidState,
	options: TmrEncodeOptions
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
		const nextIndex = resolveNextWaveformIndex(stepIndex, sid);
		eventItems.push({
			psgData,
			psgMask: encodeEventPsgApplyMask(volumeMask, channelIndex),
			timerFrequency: encodeSidEventTimerFrequency(stepIndex, sid, options),
			timerEventIndex: startIndex + nextIndex
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
