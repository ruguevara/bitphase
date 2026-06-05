import { describe, it, expect } from 'vitest';
import {
	instrumentHasSample,
	computeSampleSidPeriod,
	advanceSamplePosition,
	mapSampleByteAtPosition,
	resolveSamplePlaybackBounds,
	resetChannelSamplePlayback
} from '../../public/ay-sample-playback.js';

describe('ay-sample-playback', () => {
	it('detects instruments with sample data', () => {
		expect(instrumentHasSample({ sampleData: [128] })).toBe(true);
		expect(instrumentHasSample({ sampleData: [] })).toBe(false);
		expect(instrumentHasSample(null)).toBe(false);
	});

	it('computes SID period from clock and sample rate', () => {
		expect(computeSampleSidPeriod(1_773_400, 44_100)).toBe(5);
	});

	it('resolves separate play and loop bounds', () => {
		const bounds = resolveSamplePlaybackBounds({
			sampleData: [0, 1, 2, 3, 4],
			sampleStart: 0,
			sampleEnd: 4,
			sampleLoopStart: 2
		});
		expect(bounds).toEqual({
			start: 0,
			end: 4,
			loopStart: 2,
			length: 5,
			dataLength: 5
		});
	});

	it('plays from sample start before advancing', () => {
		const state = {
			isYM: 0,
			channelSamplePositions: [0],
			channelSamplePhase: [0]
		};
		const instrument = {
			sampleData: [0, 128, 255, 64],
			sampleRate: 3,
			sampleStart: 0,
			sampleEnd: 2,
			sampleLoopStart: 1
		};
		const first = advanceSamplePosition(state, 0, instrument, 3, 500);
		expect(first.active).toBe(true);
		expect(state.channelSamplePositions[0]).toBe(1);
	});

	it('loops from loop start after reaching sample end', () => {
		const tuningTable = Array(96).fill(0);
		tuningTable[36] = 1000;
		const state = {
			isYM: 0,
			currentTuningTable: tuningTable,
			channelSamplePositions: [3],
			channelSamplePhase: [0]
		};
		const instrument = {
			sampleData: [0, 64, 128, 192],
			sampleRate: 10,
			sampleStart: 0,
			sampleEnd: 3,
			sampleLoopStart: 2
		};
		const result = advanceSamplePosition(state, 0, instrument, 10, 1000);
		expect(result.active).toBe(true);
		expect(state.channelSamplePositions[0]).toBe(2);
	});

	it('stops at sample end when looping is disabled', () => {
		const state = {
			isYM: 0,
			channelSamplePositions: [2],
			channelSamplePhase: [0]
		};
		const instrument = {
			sampleData: [0, 64, 128, 192],
			sampleRate: 10,
			sampleStart: 1,
			sampleEnd: 2,
			sampleLoopStart: 1,
			sampleLoopEnabled: false
		};
		const result = advanceSamplePosition(state, 0, instrument, 10, 500);
		expect(result.active).toBe(false);
		expect(state.channelSamplePositions[0]).toBe(3);
	});

	it('resets playback to sample start on a new note', () => {
		const state = {
			isYM: 0,
			channelSamplePositions: [3],
			channelSamplePhase: [0.5]
		};
		const instrument = {
			sampleData: [0, 1, 2, 3],
			sampleStart: 1,
			sampleEnd: 2,
			sampleLoopStart: 2
		};
		resetChannelSamplePlayback(state, 0, instrument);
		expect(state.channelSamplePositions[0]).toBe(1);
		expect(state.channelSamplePhase[0]).toBe(0);
	});

	it('maps sample bytes through the AY lookup', () => {
		const instrument = { sampleData: [255] };
		expect(mapSampleByteAtPosition(instrument, 0, 0)).toBe(15);
	});
});
