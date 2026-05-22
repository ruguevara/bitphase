import { describe, expect, it } from 'vitest';
import {
	allRegistersApplyMask,
	registerApplyMask,
	volumeRegisterIndex,
	type SongCaptureFrame
} from '@/lib/services/file/ay-export-utils';
import {
	encodeEventPsgApplyMask,
	encodeTMR,
	TMR_FRAME_SIZE,
	TMR_HEADER_SIZE,
	TMR_ITEM_SIZE,
	TMR_TIMER_EVENT_STOP
} from '@/lib/services/file/tmr-encoder';
import { parseEventList, TEL_HEADER_SIZE } from '@/lib/services/file/tmr-event-list';
import { attachEventListToTmrFile, parseTMR } from '@/lib/services/file/tmr-parser';

function readU16LE(buffer: ArrayBuffer, offset: number): number {
	return new DataView(buffer).getUint16(offset, true);
}

function readU32LE(buffer: ArrayBuffer, offset: number): number {
	return new DataView(buffer).getUint32(offset, true);
}

function disabledSidFrame(registers: number[] = new Array(14).fill(0)): SongCaptureFrame {
	return {
		registers,
		sid: [
			{ enabled: false, period: 0, baseVolume: 0, waveform: [15, 0], waveformLoop: 0 },
			{ enabled: false, period: 0, baseVolume: 0, waveform: [15, 0], waveformLoop: 0 },
			{ enabled: false, period: 0, baseVolume: 0, waveform: [15, 0], waveformLoop: 0 }
		],
		syncbuzzer: [
			{ enabled: false, period: 0, shape: 0 },
			{ enabled: false, period: 0, shape: 0 },
			{ enabled: false, period: 0, shape: 0 }
		]
	};
}

function parseEncoded(frames: SongCaptureFrame[], options = { chipFrequency: 1773400, interruptFrequency: 50 }) {
	const encoded = encodeTMR(frames, options);
	const tmr = parseTMR(encoded.tmr);
	const tel = parseEventList(encoded.eventList);
	expect(tmr.ok).toBe(true);
	expect(tel.ok).toBe(true);
	if (!tmr.ok || !tel.ok) {
		throw new Error('encode/decode failed');
	}
	return attachEventListToTmrFile(tmr.file, tel.file.eventItems);
}

describe('tmr encoder', () => {
	it('writes little-endian header and frame count', () => {
		const encoded = encodeTMR([disabledSidFrame(), disabledSidFrame()], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});
		const bytes = new Uint8Array(encoded.tmr);
		expect(bytes[0]).toBe(0x54);
		expect(bytes[1]).toBe(0x4d);
		expect(bytes[2]).toBe(0x52);
		expect(bytes[3]).toBe(0x1a);
		expect(readU16LE(encoded.tmr, 4)).toBe(1);
		expect(readU16LE(encoded.tmr, 6)).toBe(TMR_HEADER_SIZE);
		expect(readU32LE(encoded.tmr, 12)).toBe(Math.round(50 * 65536));
		expect(readU32LE(encoded.tmr, 16)).toBe(1773400);
		expect(readU32LE(encoded.tmr, 20)).toBe(2);
		expect(encoded.tmr.byteLength).toBe(TMR_HEADER_SIZE + 2 * TMR_FRAME_SIZE);
		expect(encoded.eventList.byteLength).toBe(TEL_HEADER_SIZE);
	});

	it('starts timer 1 with SID event chain on channel A', () => {
		const frame = disabledSidFrame();
		frame.sid[0] = {
			enabled: true,
			period: 1000,
			baseVolume: 15,
			waveform: [15, 0],
			waveformLoop: 0
		};

		const encoded = encodeTMR([frame], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		const volumeMask = registerApplyMask(volumeRegisterIndex(0));
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE)).toBe(allRegistersApplyMask() & ~volumeMask);
		expect(readU32LE(encoded.tmr, TMR_HEADER_SIZE + 2)).toBe(1000);
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE + 6)).toBe(0);
		expect(encoded.tmr.byteLength).toBe(TMR_HEADER_SIZE + TMR_FRAME_SIZE);
		expect(encoded.eventList.byteLength).toBe(TEL_HEADER_SIZE + 2 * TMR_ITEM_SIZE);
		expect(readU16LE(encoded.eventList, TEL_HEADER_SIZE + 14)).toBe(
			encodeEventPsgApplyMask(volumeMask, 0)
		);
	});

	it('emits timer stop when SID turns off', () => {
		const onFrame = disabledSidFrame();
		onFrame.sid[0] = {
			enabled: true,
			period: 500,
			baseVolume: 15,
			waveform: [15, 0],
			waveformLoop: 0
		};

		const encoded = encodeTMR([onFrame, disabledSidFrame()], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		const secondFrameOffset = TMR_HEADER_SIZE + TMR_FRAME_SIZE;
		expect(readU16LE(encoded.tmr, secondFrameOffset + 6)).toBe(TMR_TIMER_EVENT_STOP);
	});

	it('encodes timer index in event item psg mask bits 0-1', () => {
		const frame = disabledSidFrame();
		frame.sid[1] = {
			enabled: true,
			period: 800,
			baseVolume: 15,
			waveform: [15, 0],
			waveformLoop: 0
		};

		const encoded = encodeTMR([frame], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		const volumeMask = registerApplyMask(volumeRegisterIndex(1));
		const encodedMask = readU16LE(encoded.eventList, TEL_HEADER_SIZE + 14);
		expect(encodedMask & volumeMask).toBe(volumeMask);
		expect(encodedMask).toBe(encodeEventPsgApplyMask(volumeMask, 1));
	});

	it('keeps timer bits clear in player frame psg mask', () => {
		const frame = disabledSidFrame();
		frame.sid[1] = {
			enabled: true,
			period: 800,
			baseVolume: 15,
			waveform: [15, 0],
			waveformLoop: 0
		};

		const encoded = encodeTMR([frame], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE) & 0x0003).toBe(0);
	});

	it('reuses one event chain when only SID period changes', () => {
		const frames = [500, 520, 540, 560].map((period) => {
			const frame = disabledSidFrame();
			frame.sid[0] = {
				enabled: true,
				period,
				baseVolume: 15,
				waveform: [0, 13],
				waveformLoop: 0
			};
			return frame;
		});

		const encoded = encodeTMR(frames, {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		expect(encoded.tmr.byteLength).toBe(TMR_HEADER_SIZE + frames.length * TMR_FRAME_SIZE);
		expect(encoded.eventList.byteLength).toBe(TEL_HEADER_SIZE + 2 * TMR_ITEM_SIZE);
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE + 6)).toBe(0);
		expect(readU32LE(encoded.tmr, TMR_HEADER_SIZE + 2)).toBe(500);
		expect(readU32LE(encoded.tmr, TMR_HEADER_SIZE + TMR_FRAME_SIZE + 2)).toBe(520);
	});

	it('reuses event chain after stop and start with same waveform config', () => {
		const sidConfig = {
			enabled: true,
			period: 800,
			baseVolume: 15,
			waveform: [0, 13],
			waveformLoop: 0
		};
		const onFrame = disabledSidFrame();
		onFrame.sid[0] = { ...sidConfig };
		const offFrame = disabledSidFrame();
		const onAgainFrame = disabledSidFrame();
		onAgainFrame.sid[0] = { ...sidConfig, period: 900 };

		const encoded = encodeTMR([onFrame, offFrame, onAgainFrame], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});

		expect(encoded.eventList.byteLength).toBe(TEL_HEADER_SIZE + 2 * TMR_ITEM_SIZE);
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE + 6)).toBe(0);
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE + TMR_FRAME_SIZE + 6)).toBe(TMR_TIMER_EVENT_STOP);
		expect(readU16LE(encoded.tmr, TMR_HEADER_SIZE + 2 * TMR_FRAME_SIZE + 6)).toBe(0);
	});
});

describe('tmr split files', () => {
	it('parses tmr without embedded event list until tel is attached', () => {
		const onFrame = disabledSidFrame();
		onFrame.sid[0] = {
			enabled: true,
			period: 1000,
			baseVolume: 15,
			waveform: [15, 0],
			waveformLoop: 0
		};
		const encoded = encodeTMR([onFrame, disabledSidFrame()], {
			chipFrequency: 1773400,
			interruptFrequency: 50
		});
		const tmrOnly = parseTMR(encoded.tmr);
		expect(tmrOnly.ok).toBe(true);
		if (!tmrOnly.ok) {
			return;
		}
		expect(tmrOnly.file.eventItems).toHaveLength(0);

		const merged = parseEncoded([onFrame, disabledSidFrame()]);
		expect(merged.eventItems).toHaveLength(2);
	});
});
