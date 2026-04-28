import type { EditingContext, FieldInfo, PatternEditingResult } from './editing-context';
import { PatternValueUpdates } from './pattern-value-updates';
import { editorStateStore } from '../../../stores/editor-state.svelte';
import { formatNoteFromEnum, midiNoteToNoteString } from '../../../utils/note-utils';
import { noteStringToEnvelopePeriod } from '../../../utils/envelope-note-conversion';
import { PatternNoteInput } from './pattern-note-input';

export class PatternEnvelopeNoteInput {
	static handleEnvelopeNoteInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string,
		code: string
	): PatternEditingResult | null {
		if (!context.tuningTable) {
			return null;
		}

		const keyboardNote = PatternNoteInput.mapKeyboardCodeToNote(code);
		if (keyboardNote) {
			const noteStr = formatNoteFromEnum(keyboardNote.noteName, keyboardNote.octave);
			const envelopePeriod = noteStringToEnvelopePeriod(
				noteStr,
				context.tuningTable,
				editorStateStore.octave
			);
			return this.applyEnvelopePeriod(context, fieldInfo, envelopePeriod);
		}

		const upperKey = key.toUpperCase();
		if (upperKey === 'A') {
			return this.applyEnvelopePeriod(context, fieldInfo, 0);
		}

		const letterNote = PatternNoteInput.getLetterNote(key);
		if (letterNote) {
			const currentOctave = editorStateStore.octave;
			const noteStr = formatNoteFromEnum(letterNote, currentOctave);
			const envelopePeriod = noteStringToEnvelopePeriod(
				noteStr,
				context.tuningTable,
				currentOctave
			);
			return this.applyEnvelopePeriod(context, fieldInfo, envelopePeriod);
		}

		return null;
	}

	static handleMidiNoteInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		midiNote: number
	): PatternEditingResult | null {
		if (!context.tuningTable) {
			return null;
		}
		const noteStr = midiNoteToNoteString(midiNote);
		if (!noteStr) return null;
		const envelopePeriod = noteStringToEnvelopePeriod(
			noteStr,
			context.tuningTable,
			editorStateStore.octave
		);
		return this.applyEnvelopePeriod(context, fieldInfo, envelopePeriod);
	}

	private static applyEnvelopePeriod(
		context: EditingContext,
		fieldInfo: FieldInfo,
		envelopePeriod: number
	): PatternEditingResult {
		if (PatternValueUpdates.getFieldValue(context, fieldInfo) === envelopePeriod) {
			return { updatedPattern: context.pattern, shouldMoveNext: false, didChange: false };
		}
		const updatedPattern = PatternValueUpdates.updateFieldValue(
			context,
			fieldInfo,
			envelopePeriod
		);
		return { updatedPattern, shouldMoveNext: false };
	}
}
