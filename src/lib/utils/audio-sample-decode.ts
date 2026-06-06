export type WaveformPeak = {
	min: number;
	max: number;
};

export type DecodedAudioSample = {
	fileName: string;
	sampleRate: number;
	durationSeconds: number;
	channelCount: 1;
	data: Uint8Array;
	peaks: WaveformPeak[];
};

export const MAX_INSTRUMENT_SAMPLE_BYTES = 16 * 1024;

export class InstrumentSampleTooLargeError extends Error {
	constructor(byteLength: number) {
		super(
			`Decoded 8-bit mono sample is too large (${byteLength.toLocaleString()} bytes). Maximum is ${MAX_INSTRUMENT_SAMPLE_BYTES.toLocaleString()} bytes (16 KB of 8-bit mono audio).`
		);
		this.name = 'InstrumentSampleTooLargeError';
	}
}

export function isValidInstrumentSampleByteLength(byteLength: number): boolean {
	return byteLength > 0 && byteLength <= MAX_INSTRUMENT_SAMPLE_BYTES;
}

export function assertInstrumentSampleByteLength(byteLength: number): void {
	if (byteLength > MAX_INSTRUMENT_SAMPLE_BYTES) {
		throw new InstrumentSampleTooLargeError(byteLength);
	}
}

export function prepareInstrumentSampleBytes(data: ArrayLike<number>): number[] {
	const bytes = Array.from(data, (value) => value & 0xff);
	assertInstrumentSampleByteLength(bytes.length);
	return bytes;
}

const PREVIEW_BUCKET_COUNT = 2048;
const UINT8_ENCODE_SCALE = 127.5;
const CONVERSION_CHUNK_SAMPLES = 65536;
const YIELD_SAMPLE_THRESHOLD = 32768;

let decodeAudioContext: AudioContext | null = null;

export function floatSampleToUint8(value: number): number {
	const scaled = Math.round((value + 1) * UINT8_ENCODE_SCALE);
	return Math.max(0, Math.min(255, scaled));
}

export function uint8SampleToFloat(value: number): number {
	return value / UINT8_ENCODE_SCALE - 1;
}

function getDecodeAudioContext(): AudioContext {
	if (!decodeAudioContext) {
		decodeAudioContext = new AudioContext();
	}
	return decodeAudioContext;
}

function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function readFourCc(view: DataView, offset: number): string {
	return String.fromCharCode(
		view.getUint8(offset),
		view.getUint8(offset + 1),
		view.getUint8(offset + 2),
		view.getUint8(offset + 3)
	);
}

export type ParsedWavPcmMono = {
	sampleRate: number;
	data: Uint8Array;
};

function int16SampleToUint8(sample: number): number {
	return floatSampleToUint8(sample / 32768);
}

function mixWavPcmToUint8Mono(
	pcmBytes: Uint8Array,
	channelCount: number,
	bitsPerSample: number
): Uint8Array | null {
	if (bitsPerSample === 8) {
		if (channelCount === 1) {
			return pcmBytes.slice();
		}
		if (channelCount === 2) {
			const frameCount = Math.floor(pcmBytes.length / 2);
			const mono = new Uint8Array(frameCount);
			for (let i = 0; i < frameCount; i++) {
				const left = pcmBytes[i * 2];
				const right = pcmBytes[i * 2 + 1];
				const mixed = Math.round((left + right) / 2);
				mono[i] = Math.max(0, Math.min(255, mixed));
			}
			return mono;
		}
		return null;
	}

	if (bitsPerSample === 16) {
		const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
		const frameCount = Math.floor(pcmBytes.length / (2 * channelCount));
		const mono = new Uint8Array(frameCount);
		for (let i = 0; i < frameCount; i++) {
			let sum = 0;
			for (let ch = 0; ch < channelCount; ch++) {
				sum += view.getInt16((i * channelCount + ch) * 2, true);
			}
			mono[i] = int16SampleToUint8(sum / channelCount);
		}
		return mono;
	}

	return null;
}

export function tryParseWavPcmMono(arrayBuffer: ArrayBuffer): ParsedWavPcmMono | null {
	if (arrayBuffer.byteLength < 44) {
		return null;
	}

	const view = new DataView(arrayBuffer);
	if (readFourCc(view, 0) !== 'RIFF' || readFourCc(view, 8) !== 'WAVE') {
		return null;
	}

	let sampleRate = 0;
	let channelCount = 0;
	let bitsPerSample = 0;
	let formatTag = 0;
	let dataOffset = -1;
	let dataSize = 0;
	let offset = 12;

	while (offset + 8 <= arrayBuffer.byteLength) {
		const chunkId = readFourCc(view, offset);
		const chunkSize = view.getUint32(offset + 4, true);
		const chunkStart = offset + 8;

		if (chunkStart + chunkSize > arrayBuffer.byteLength) {
			break;
		}

		if (chunkId === 'fmt ' && chunkSize >= 16) {
			formatTag = view.getUint16(chunkStart, true);
			channelCount = view.getUint16(chunkStart + 2, true);
			sampleRate = view.getUint32(chunkStart + 4, true);
			bitsPerSample = view.getUint16(chunkStart + 14, true);
		} else if (chunkId === 'data') {
			dataOffset = chunkStart;
			dataSize = chunkSize;
		}

		offset = chunkStart + chunkSize;
		if (chunkSize % 2 !== 0) {
			offset += 1;
		}
	}

	if (formatTag !== 1 || !sampleRate || dataOffset < 0 || dataSize <= 0) {
		return null;
	}
	if (channelCount < 1 || channelCount > 2) {
		return null;
	}
	if (bitsPerSample !== 8 && bitsPerSample !== 16) {
		return null;
	}

	const pcmBytes = new Uint8Array(arrayBuffer, dataOffset, dataSize);
	const data = mixWavPcmToUint8Mono(pcmBytes, channelCount, bitsPerSample);
	if (!data?.length) {
		return null;
	}

	return { sampleRate, data };
}

function mixSampleAtIndex(
	channelData: Float32Array[],
	channelCount: number,
	index: number
): number {
	if (channelCount === 0) {
		return 0;
	}
	if (channelCount === 1) {
		return channelData[0][index];
	}
	let sum = 0;
	for (let ch = 0; ch < channelCount; ch++) {
		sum += channelData[ch][index];
	}
	return sum / channelCount;
}

function normalizePeaksInPlace(peaks: WaveformPeak[]): WaveformPeak[] {
	let peakAbs = 0;
	for (const bucket of peaks) {
		peakAbs = Math.max(peakAbs, Math.abs(bucket.min), Math.abs(bucket.max));
	}
	if (peakAbs < 1e-8) {
		return peaks;
	}
	const scale = 1 / peakAbs;
	for (const bucket of peaks) {
		bucket.min *= scale;
		bucket.max *= scale;
	}
	return peaks;
}

function buildDecodedAudioSample(
	fileName: string,
	sourceData: Uint8Array,
	sourceSampleRate: number
): DecodedAudioSample {
	assertInstrumentSampleByteLength(sourceData.length);
	const peaks = normalizeWaveformPeaksForDisplay(buildWaveformPeaksFromUint8Mono(sourceData));

	return {
		fileName,
		sampleRate: sourceSampleRate,
		durationSeconds: sourceData.length / sourceSampleRate,
		channelCount: 1,
		data: sourceData,
		peaks
	};
}

export function mixAudioBufferToMono(audioBuffer: AudioBuffer): Float32Array {
	const length = audioBuffer.length;
	const channels = audioBuffer.numberOfChannels;
	const mono = new Float32Array(length);

	if (channels === 0) {
		return mono;
	}

	if (channels === 1) {
		mono.set(audioBuffer.getChannelData(0));
		return mono;
	}

	const channelData = Array.from({ length: channels }, (_, ch) =>
		audioBuffer.getChannelData(ch)
	);
	for (let i = 0; i < length; i++) {
		mono[i] = mixSampleAtIndex(channelData, channels, i);
	}

	return mono;
}

export function floatMonoToUint8Mono(samples: Float32Array): Uint8Array {
	const out = new Uint8Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		out[i] = floatSampleToUint8(samples[i]);
	}
	return out;
}

export function convertAudioBufferToUint8Mono(audioBuffer: AudioBuffer): Uint8Array {
	return floatMonoToUint8Mono(mixAudioBufferToMono(audioBuffer));
}

export function buildWaveformPeaksFromUint8Mono(
	data: Uint8Array,
	bucketCount: number = PREVIEW_BUCKET_COUNT
): WaveformPeak[] {
	const length = data.length;
	if (length === 0 || bucketCount < 1) {
		return [];
	}

	const peaks: WaveformPeak[] = [];
	const samplesPerBucket = length / bucketCount;

	for (let b = 0; b < bucketCount; b++) {
		const start = Math.floor(b * samplesPerBucket);
		const end = Math.min(length, Math.floor((b + 1) * samplesPerBucket));
		let min = 0;
		let max = 0;
		let initialized = false;

		for (let i = start; i < end; i++) {
			const value = uint8SampleToFloat(data[i]);
			if (!initialized) {
				min = value;
				max = value;
				initialized = true;
			} else {
				if (value < min) min = value;
				if (value > max) max = value;
			}
		}

		peaks.push({ min: initialized ? min : 0, max: initialized ? max : 0 });
	}

	return peaks;
}

export function normalizeWaveformPeaksForDisplay(peaks: WaveformPeak[]): WaveformPeak[] {
	return normalizePeaksInPlace(peaks.map((bucket) => ({ ...bucket })));
}

function updatePeakBucket(peaks: WaveformPeak[], bucketIndex: number, value: number): void {
	const bucket = peaks[bucketIndex];
	if (value < bucket.min) bucket.min = value;
	if (value > bucket.max) bucket.max = value;
}

function createEmptyPeaks(bucketCount: number): WaveformPeak[] {
	return Array.from({ length: bucketCount }, () => ({
		min: Number.POSITIVE_INFINITY,
		max: Number.NEGATIVE_INFINITY
	}));
}

function finalizePeaks(peaks: WaveformPeak[]): void {
	for (const bucket of peaks) {
		if (!Number.isFinite(bucket.min) || !Number.isFinite(bucket.max)) {
			bucket.min = 0;
			bucket.max = 0;
		}
	}
}

export async function convertAudioBufferToUint8MonoAndPeaks(
	audioBuffer: AudioBuffer,
	bucketCount: number = PREVIEW_BUCKET_COUNT
): Promise<{ data: Uint8Array; peaks: WaveformPeak[] }> {
	const length = audioBuffer.length;
	const channelCount = audioBuffer.numberOfChannels;
	const data = new Uint8Array(length);
	const peaks = createEmptyPeaks(bucketCount);

	if (length === 0 || bucketCount < 1) {
		return { data, peaks };
	}

	const channelData = Array.from({ length: channelCount }, (_, ch) =>
		audioBuffer.getChannelData(ch)
	);
	const samplesPerBucket = length / bucketCount;
	const shouldYield = length > YIELD_SAMPLE_THRESHOLD;

	for (let chunkStart = 0; chunkStart < length; chunkStart += CONVERSION_CHUNK_SAMPLES) {
		const chunkEnd = Math.min(length, chunkStart + CONVERSION_CHUNK_SAMPLES);

		for (let i = chunkStart; i < chunkEnd; i++) {
			const mono = mixSampleAtIndex(channelData, channelCount, i);
			data[i] = floatSampleToUint8(mono);
			const bucketIndex = Math.min(bucketCount - 1, Math.floor(i / samplesPerBucket));
			updatePeakBucket(peaks, bucketIndex, mono);
		}

		if (shouldYield && chunkEnd < length) {
			await yieldToMain();
		}
	}

	finalizePeaks(peaks);
	normalizePeaksInPlace(peaks);
	return { data, peaks };
}

export async function decodeAudioSampleFile(file: File): Promise<DecodedAudioSample> {
	const arrayBuffer = await file.arrayBuffer();

	const wavParsed = tryParseWavPcmMono(arrayBuffer);
	if (wavParsed) {
		return buildDecodedAudioSample(file.name, wavParsed.data, wavParsed.sampleRate);
	}

	const audioContext = getDecodeAudioContext();
	if (audioContext.state === 'suspended') {
		await audioContext.resume();
	}

	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
	await yieldToMain();

	const sourceMono = mixAudioBufferToMono(audioBuffer);

	return buildDecodedAudioSample(
		file.name,
		floatMonoToUint8Mono(sourceMono),
		audioBuffer.sampleRate
	);
}

export function formatAudioDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00';
	}
	const totalSeconds = Math.floor(seconds);
	const minutes = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
