import { describe, it, expect } from 'vitest';
import {
	isNoteInTuningTable,
	isTrackerNoteStringInTuningTable,
	midiNoteToNoteNameAndOctave,
	midiNoteToNoteString,
	noteToTuningTableIndex,
	parseNoteFromString,
	formatNoteFromEnum,
	tuningTableIndexToNote,
	TUNING_TABLE_NOTE_COUNT
} from '@/lib/utils/note-utils';
import { NoteName } from '@/lib/models/song';

describe('note-utils MIDI', () => {
	describe('midiNoteToNoteNameAndOctave', () => {
		it('returns null for midiNote less than 0', () => {
			expect(midiNoteToNoteNameAndOctave(-1)).toBeNull();
		});

		it('returns null for midiNote greater than 127', () => {
			expect(midiNoteToNoteNameAndOctave(128)).toBeNull();
		});

		it('maps MIDI 60 (C4) to C and octave 4', () => {
			const result = midiNoteToNoteNameAndOctave(60);
			expect(result).not.toBeNull();
			expect(result!.noteName).toBe(NoteName.C);
			expect(result!.octave).toBe(4);
		});

		it('rejects MIDI notes below the tuning table range', () => {
			expect(midiNoteToNoteNameAndOctave(0)).toBeNull();
			expect(midiNoteToNoteNameAndOctave(12)).toBeNull();
			expect(midiNoteToNoteString(12)).toBeNull();
		});

		it('maps MIDI 69 (A4) to A and octave 4', () => {
			const result = midiNoteToNoteNameAndOctave(69);
			expect(result).not.toBeNull();
			expect(result!.noteName).toBe(NoteName.A);
			expect(result!.octave).toBe(4);
		});

		it('maps MIDI 61 to C# and octave 4', () => {
			const result = midiNoteToNoteNameAndOctave(61);
			expect(result).not.toBeNull();
			expect(result!.noteName).toBe(NoteName.CSharp);
			expect(result!.octave).toBe(4);
		});

		it('rejects MIDI notes above the tuning table range', () => {
			expect(midiNoteToNoteNameAndOctave(120)).toBeNull();
		});

		it('maps all 12 pitch classes correctly', () => {
			const expected: [number, NoteName][] = [
				[60, NoteName.C],
				[61, NoteName.CSharp],
				[62, NoteName.D],
				[63, NoteName.DSharp],
				[64, NoteName.E],
				[65, NoteName.F],
				[66, NoteName.FSharp],
				[67, NoteName.G],
				[68, NoteName.GSharp],
				[69, NoteName.A],
				[70, NoteName.ASharp],
				[71, NoteName.B]
			];
			for (const [midiNote, noteName] of expected) {
				const result = midiNoteToNoteNameAndOctave(midiNote);
				expect(result!.noteName).toBe(noteName);
			}
		});
	});

	describe('tuning table note range', () => {
		it('maps C-1 to index 0 and C-4 to index 36', () => {
			expect(noteToTuningTableIndex(NoteName.C, 1)).toBe(0);
			expect(noteToTuningTableIndex(NoteName.C, 4)).toBe(36);
		});

		it('rejects notes outside the 96-entry tuning table', () => {
			expect(noteToTuningTableIndex(NoteName.C, 0)).toBeNull();
			expect(noteToTuningTableIndex(NoteName.A, 0)).toBeNull();
			expect(noteToTuningTableIndex(NoteName.B, 9)).toBeNull();
			expect(noteToTuningTableIndex(NoteName.C, 9)).toBeNull();
		});

		it('round-trips tuning table indices', () => {
			for (const index of [0, 36, TUNING_TABLE_NOTE_COUNT - 1]) {
				const note = tuningTableIndexToNote(index);
				expect(note).not.toBeNull();
				expect(noteToTuningTableIndex(note!.noteName, note!.octave)).toBe(index);
			}
		});

		it('parses sharp note strings without a dash before the octave', () => {
			const parsed = parseNoteFromString('A#8');
			expect(parsed.noteName).toBe(NoteName.ASharp);
			expect(parsed.octave).toBe(8);
			expect(noteToTuningTableIndex(parsed.noteName, parsed.octave)).toBe(94);
		});

		it('validates tracker note strings against the tuning table', () => {
			expect(isTrackerNoteStringInTuningTable('C-1')).toBe(true);
			expect(isTrackerNoteStringInTuningTable('C-0')).toBe(false);
			expect(isTrackerNoteStringInTuningTable('A-0')).toBe(false);
			expect(isTrackerNoteStringInTuningTable('---')).toBe(true);
			expect(isTrackerNoteStringInTuningTable('OFF')).toBe(true);
			expect(isNoteInTuningTable(NoteName.A, 0)).toBe(false);
		});
	});

	describe('midiNoteToNoteString', () => {
		it('returns null for invalid midiNote', () => {
			expect(midiNoteToNoteString(-1)).toBeNull();
			expect(midiNoteToNoteString(128)).toBeNull();
		});

		it('returns tracker format for MIDI 60', () => {
			const result = midiNoteToNoteString(60);
			expect(result).toBe('C-4');
		});

		it('returns tracker format for MIDI 69', () => {
			const result = midiNoteToNoteString(69);
			expect(result).toBe('A-4');
		});

		it('matches formatNoteFromEnum for valid range', () => {
			for (const midiNote of [24, 60, 72, 108]) {
				const str = midiNoteToNoteString(midiNote);
				const parsed = midiNoteToNoteNameAndOctave(midiNote);
				expect(parsed).not.toBeNull();
				expect(str).toBe(formatNoteFromEnum(parsed!.noteName, parsed!.octave));
			}
		});
	});
});
