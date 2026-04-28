import type { EditingContext, FieldInfo } from './editing-context';
import type { Pattern } from '../../../models/song';
import { PatternValueUpdates } from './pattern-value-updates';
import { StringManipulation } from './string-manipulation';
import { FieldStrategyFactory } from './field-strategies';
import { EffectField } from './effect-field';
import { PatternEnvelopeNoteInput } from './pattern-envelope-note-input';
import { editorStateStore } from '../../../stores/editor-state.svelte';

export class PatternFieldInput {
	static handleHexInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string,
		code: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		if (fieldInfo.fieldKey === 'envelopeValue' && context.tuningTable) {
			const envelopeAsNote = editorStateStore.envelopeAsNote;
			if (envelopeAsNote) {
				const noteInputResult = PatternEnvelopeNoteInput.handleEnvelopeNoteInput(
					context,
					fieldInfo,
					key,
					code
				);
				if (noteInputResult) {
					return noteInputResult;
				}
				return null;
			}
		}

		const upperKey = key.toUpperCase();
		const isEffectField = EffectField.isEffectField(fieldInfo.fieldKey);

		if (isEffectField) {
			if (!/^[0-9A-V\.]$/i.test(key)) {
				return null;
			}
		} else {
			if (!/^[0-9A-F]$/.test(upperKey)) {
				return null;
			}
		}

		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) return null;

		if (isEffectField) {
			return this.handleEffectFieldInput(context, fieldInfo, upperKey);
		}

		const strategy = FieldStrategyFactory.getStrategy('hex');
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const currentStr = strategy.format(currentValue, field.length, field.allowZeroValue);
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			upperKey
		);
		const newValue = strategy.parse(newStr, field.length, field.allowZeroValue);

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newValue);
		return { updatedPattern, shouldMoveNext: false };
	}

	static handleDecInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		if (!/^[0-9]$/.test(key)) {
			return null;
		}

		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) return null;

		const strategy = FieldStrategyFactory.getStrategy('dec');
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const currentStr = strategy.format(currentValue, field.length, field.allowZeroValue);
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			key
		);
		const newValue = strategy.parse(newStr, field.length, field.allowZeroValue);

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newValue);
		return { updatedPattern, shouldMoveNext: false };
	}

	static handleSymbolInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		const upperKey = key.toUpperCase();
		const isTableField = fieldInfo.fieldKey === 'table';

		if (isTableField && (upperKey === 'A' || upperKey === 'O')) {
			const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, -1);
			return { updatedPattern, shouldMoveNext: false };
		}
		if (!/^[A-Z0-9]$/i.test(key)) {
			return null;
		}

		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) return null;

		const strategy = FieldStrategyFactory.getStrategy('symbol');
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const currentStr = strategy.format(currentValue, field.length, field.allowZeroValue);
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			upperKey
		);
		const newValue = strategy.parse(newStr, field.length, field.allowZeroValue);

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newValue);
		return { updatedPattern, shouldMoveNext: false };
	}

	static handleTextInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		if (key.length !== 1) {
			return null;
		}

		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) return null;

		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const currentStr =
			typeof currentValue === 'number' ? currentValue.toString() : String(currentValue);
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			key
		);

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newStr);
		return { updatedPattern, shouldMoveNext: false };
	}

	private static handleEffectFieldInput(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		let currentStr = EffectField.formatValue(currentValue);
		if (currentStr === null) {
			currentStr = '...';
		}
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			key
		);
		const newEffectObj = EffectField.parseValue(newStr);

		const updatedPattern = PatternValueUpdates.updateFieldValue(
			context,
			fieldInfo,
			newEffectObj
		);
		return { updatedPattern, shouldMoveNext: false };
	}
}
