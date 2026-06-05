export const SAMPLE_PITCH_REFERENCE_NOTE_INDEX = 36;

export function instrumentHasSample(source: { sampleData?: number[] } | null | undefined): boolean {
	return Array.isArray(source?.sampleData) && source.sampleData.length > 0;
}

export type SamplePlaybackBounds = {
	start: number;
	end: number;
	loopStart: number;
	length: number;
	dataLength: number;
};

export type SampleRegion = SamplePlaybackBounds;

type SampleBoundsSource = {
	sampleData?: number[];
	sampleStart?: number;
	sampleEnd?: number;
	sampleLoopStart?: number;
	sampleLength?: number;
	sampleLoop?: number;
};

export function normalizeSamplePlaybackBounds(source: SampleBoundsSource): SamplePlaybackBounds | null {
	const dataLength = source.sampleData?.length ?? 0;
	if (dataLength === 0) {
		return null;
	}

	let start = source.sampleStart ?? source.sampleLoop ?? 0;
	let end = source.sampleEnd;

	if (end == null && source.sampleLength != null && Number.isFinite(source.sampleLength)) {
		end = start + Math.floor(source.sampleLength) - 1;
	}
	if (end == null || !Number.isFinite(end)) {
		end = dataLength - 1;
	}

	start = Math.max(0, Math.min(dataLength - 1, Math.floor(start)));
	end = Math.max(start, Math.min(dataLength - 1, Math.floor(end)));

	let loopStart = source.sampleLoopStart ?? source.sampleLoop ?? start;
	loopStart = Math.max(start, Math.min(end, Math.floor(loopStart)));

	return {
		start,
		end,
		loopStart,
		length: end - start + 1,
		dataLength
	};
}

export function normalizeSampleRegion(source: SampleBoundsSource): SamplePlaybackBounds | null {
	return normalizeSamplePlaybackBounds(source);
}

export function defaultSampleRegionFields(dataLength: number): {
	sampleStart: number;
	sampleEnd: number;
	sampleLoopStart: number;
	sampleLoopEnabled: boolean;
} {
	const end = Math.max(0, dataLength - 1);
	return {
		sampleStart: 0,
		sampleEnd: end,
		sampleLoopStart: 0,
		sampleLoopEnabled: true
	};
}

export function resolveSampleLoopEnabled(source: { sampleLoopEnabled?: boolean }): boolean {
	return source.sampleLoopEnabled !== false;
}

export function resolveSamplePitchReferenceTone(tuningTable: readonly number[]): number {
	if (SAMPLE_PITCH_REFERENCE_NOTE_INDEX >= tuningTable.length) {
		return 0;
	}
	const tone = tuningTable[SAMPLE_PITCH_REFERENCE_NOTE_INDEX];
	return tone > 0 ? tone : 0;
}

export function computeSamplePitchScale(referenceTone: number, effectiveTone: number): number {
	if (referenceTone <= 0 || effectiveTone <= 0) {
		return 1;
	}
	return referenceTone / effectiveTone;
}

export function clampSamplePlaybackPosition(bounds: SamplePlaybackBounds, position: number): number {
	return Math.max(bounds.start, Math.min(bounds.end, Math.floor(position)));
}

export function formatSampleRegionDuration(
	sampleRate: number | undefined,
	bounds: SamplePlaybackBounds
): string {
	if (!sampleRate || sampleRate <= 0) {
		return `${bounds.length.toLocaleString()} samples`;
	}
	const seconds = bounds.length / sampleRate;
	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const millis = Math.floor((seconds % 1) * 1000);
	if (minutes > 0) {
		return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
	}
	return `${secs}.${millis.toString().padStart(3, '0')}s`;
}

export function formatLoopRegionDuration(
	sampleRate: number | undefined,
	bounds: SamplePlaybackBounds
): string {
	const loopLength = bounds.end - bounds.loopStart + 1;
	if (!sampleRate || sampleRate <= 0) {
		return `${loopLength.toLocaleString()} samples`;
	}
	const seconds = loopLength / sampleRate;
	const millis = Math.floor((seconds % 1) * 1000);
	const secs = Math.floor(seconds % 60);
	return `${secs}.${millis.toString().padStart(3, '0')}s`;
}
