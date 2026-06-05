import { describe, expect, it } from 'vitest';
import { PatternValueUpdates } from '@/lib/services/pattern/editing/pattern-value-updates';
import {
	formatNoteFromEnum,
	tuningTableIndexToNote,
	TUNING_TABLE_NOTE_COUNT
} from '@/lib/utils/note-utils';

describe('PatternValueUpdates note range', () => {
	it('does not increment into notes below the tuning table', () => {
		expect(PatternValueUpdates.incrementNoteValue('C-1', -1)).toBe('C-1');
	});

	it('does not increment into notes above the tuning table', () => {
		const highestNote = tuningTableIndexToNote(TUNING_TABLE_NOTE_COUNT - 1);
		expect(highestNote).not.toBeNull();
		const highestNoteStr = formatNoteFromEnum(highestNote!.noteName, highestNote!.octave);
		expect(PatternValueUpdates.incrementNoteValue(highestNoteStr, 1)).toBe(highestNoteStr);
	});

	it('increments within the tuning table using tracker octave indexing', () => {
		expect(PatternValueUpdates.incrementNoteValue('C-4', 1)).toBe('C#4');
		expect(PatternValueUpdates.incrementNoteValue('B-3', 1)).toBe('C-4');
	});
});
