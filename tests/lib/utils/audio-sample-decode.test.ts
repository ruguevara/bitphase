import { describe, expect, it } from 'vitest';
import {
	assertInstrumentSampleByteLength,
	buildWaveformPeaksFromUint8Mono,
	floatMonoToUint8Mono,
	floatSampleToUint8,
	InstrumentSampleTooLargeError,
	isValidInstrumentSampleByteLength,
	MAX_INSTRUMENT_SAMPLE_BYTES,
	mixAudioBufferToMono,
	prepareInstrumentSampleBytes,
	tryParseWavPcmMono,
	uint8SampleToFloat
} from '@/lib/utils/audio-sample-decode';

function writeFourCc(view: DataView, offset: number, value: string): void {
	for (let i = 0; i < 4; i++) {
		view.setUint8(offset + i, value.charCodeAt(i));
	}
}

function createWavPcmMono8(samples: Uint8Array, sampleRate: number): ArrayBuffer {
	const dataSize = samples.length;
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	writeFourCc(view, 0, 'RIFF');
	view.setUint32(4, 36 + dataSize, true);
	writeFourCc(view, 8, 'WAVE');
	writeFourCc(view, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	writeFourCc(view, 36, 'data');
	view.setUint32(40, dataSize, true);
	new Uint8Array(buffer, 44).set(samples);

	return buffer;
}

describe('audio-sample-decode', () => {
	it('encodes float samples to unsigned 8-bit centered at 128', () => {
		expect(floatSampleToUint8(0)).toBe(128);
		expect(floatSampleToUint8(-1)).toBe(0);
		expect(floatSampleToUint8(1)).toBe(255);
		expect(floatSampleToUint8(0.5)).toBe(191);
	});

	it('decodes uint8 samples back to centered float', () => {
		expect(uint8SampleToFloat(128)).toBeCloseTo(0.0039, 3);
		expect(uint8SampleToFloat(0)).toBe(-1);
		expect(uint8SampleToFloat(255)).toBe(1);
	});

	it('converts float mono buffer to uint8 mono', () => {
		const mono = new Float32Array([0, 1, -1, 0.5]);
		const encoded = floatMonoToUint8Mono(mono);
		expect(encoded).toEqual(new Uint8Array([128, 255, 0, 191]));
	});

	it('mixes stereo audio buffer to mono', () => {
		const audioBuffer = {
			length: 2,
			numberOfChannels: 2,
			getChannelData: (channel: number) =>
				channel === 0 ? new Float32Array([1, 0]) : new Float32Array([-1, 0])
		} as AudioBuffer;

		const mono = mixAudioBufferToMono(audioBuffer);
		expect(mono[0]).toBe(0);
		expect(mono[1]).toBe(0);
	});

	it('rejects 8-bit mono samples larger than 16 KB', () => {
		expect(() => assertInstrumentSampleByteLength(MAX_INSTRUMENT_SAMPLE_BYTES)).not.toThrow();
		expect(() => assertInstrumentSampleByteLength(MAX_INSTRUMENT_SAMPLE_BYTES + 1)).toThrow(
			InstrumentSampleTooLargeError
		);
	});

	it('validates 8-bit mono sample byte length', () => {
		expect(isValidInstrumentSampleByteLength(0)).toBe(false);
		expect(isValidInstrumentSampleByteLength(1)).toBe(true);
		expect(isValidInstrumentSampleByteLength(MAX_INSTRUMENT_SAMPLE_BYTES)).toBe(true);
		expect(isValidInstrumentSampleByteLength(MAX_INSTRUMENT_SAMPLE_BYTES + 1)).toBe(false);
	});

	it('prepares 8-bit mono sample bytes and rejects oversized data', () => {
		const data = new Array(MAX_INSTRUMENT_SAMPLE_BYTES).fill(300);
		expect(prepareInstrumentSampleBytes(data)).toHaveLength(MAX_INSTRUMENT_SAMPLE_BYTES);
		expect(prepareInstrumentSampleBytes(data)[0]).toBe(44);

		const oversized = new Array(MAX_INSTRUMENT_SAMPLE_BYTES + 1).fill(128);
		expect(() => prepareInstrumentSampleBytes(oversized)).toThrow(InstrumentSampleTooLargeError);
	});

	it('imports 8-bit mono WAV at native sample rate without upsampling', () => {
		const samples = new Uint8Array(3_891);
		samples.fill(128);
		samples[0] = 0;
		samples[1] = 255;
		samples[2] = 128;

		const parsed = tryParseWavPcmMono(createWavPcmMono8(samples, 8_000));

		expect(parsed).not.toBeNull();
		expect(parsed?.sampleRate).toBe(8_000);
		expect(parsed?.data).toEqual(samples);
		expect(parsed?.data.length).toBe(3_891);
	});

	it('builds waveform peaks from uint8 mono data', () => {
		const data = new Uint8Array([128, 255, 0, 128, 128]);
		const peaks = buildWaveformPeaksFromUint8Mono(data, 1);
		expect(peaks).toHaveLength(1);
		expect(peaks[0].max).toBe(1);
		expect(peaks[0].min).toBe(-1);
	});
});
