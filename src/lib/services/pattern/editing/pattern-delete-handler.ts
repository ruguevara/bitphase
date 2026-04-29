import type { EditingContext, FieldInfo } from './editing-context';
import type { Pattern } from '../../../models/song';
import type { GenericPattern } from '../../../models/song/generic';
import type { ChipSchema } from '../../../chips/base/schema';
import { PatternFieldDetection } from './pattern-field-detection';
import { PatternValueUpdates } from './pattern-value-updates';
import { StringManipulation } from './string-manipulation';
import { FieldStrategyFactory } from './field-strategies';
import { EffectField } from './effect-field';
import { settingsStore } from '../../../stores/settings.svelte';

export class PatternDeleteHandler {
	static handleDelete(
		context: EditingContext
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		const fieldInfo = PatternFieldDetection.detectFieldAtCursor(context);
		if (!fieldInfo) {
			return null;
		}

		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) return null;

		const isEffectField = EffectField.isEffectField(fieldInfo.fieldKey);

		if (field.type === 'note') {
			if (fieldInfo.isGlobal) {
				return null;
			}
			let updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, '---');
			if (settingsStore.autoEnterInstrument) {
				const instrumentFieldDef = context.schema.fields?.instrument;
				if (instrumentFieldDef) {
					const instrumentFieldInfo: FieldInfo = {
						fieldKey: 'instrument',
						fieldType: instrumentFieldDef.type,
						isGlobal: false,
						channelIndex: fieldInfo.channelIndex,
						charOffset: 0
					};
					updatedPattern = PatternValueUpdates.updateFieldValue(
						{ ...context, pattern: updatedPattern },
						instrumentFieldInfo,
						0
					);
				}
			}
			return { updatedPattern, shouldMoveNext: false };
		}

		if (isEffectField) {
			return this.handleEffectFieldDelete(context, fieldInfo);
		}

		if (fieldInfo.fieldKey === 'envelopeValue' && context.tuningTable) {
			// Special handling for envelope value when displayed as note
			const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, 0);
			return { updatedPattern, shouldMoveNext: false };
		}

		if (field.type === 'hex' || field.type === 'dec' || field.type === 'symbol') {
			return this.handleNumericFieldDelete(context, fieldInfo, field);
		}

		if (field.type === 'text') {
			const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
			const currentStr =
				typeof currentValue === 'number' ? currentValue.toString() : String(currentValue);
			const newStr = StringManipulation.replaceCharAtOffset(
				currentStr,
				fieldInfo.charOffset,
				''
			);
			const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newStr);
			return { updatedPattern, shouldMoveNext: false };
		}

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, '');
		return { updatedPattern, shouldMoveNext: false };
	}

	private static handleNumericFieldDelete(
		context: EditingContext,
		fieldInfo: FieldInfo,
		field: { key: string; type: string; length: number; allowZeroValue?: boolean }
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const ZERO_VALUE = -1;

		if (!FieldStrategyFactory.isSupported(field.type)) {
			return null;
		}
		if (typeof currentValue === 'object' && currentValue !== null) {
			return null;
		}

		if (currentValue === ZERO_VALUE) {
			const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, 0);
			return { updatedPattern, shouldMoveNext: false };
		}

		if (field.allowZeroValue) {
			if (currentValue === 0) return null;
			const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, 0);
			return { updatedPattern, shouldMoveNext: false };
		}

		const strategy = FieldStrategyFactory.getStrategy(field.type);
		const currentStr = strategy.format(currentValue, field.length, field.allowZeroValue);

		if (fieldInfo.charOffset < 0 || fieldInfo.charOffset >= currentStr.length) {
			return null;
		}

		const charAtOffset = currentStr[fieldInfo.charOffset];

		if (charAtOffset === '.' || charAtOffset === '0') {
			return null;
		}

		const replacementChar =
			fieldInfo.fieldKey === 'instrument' || field.length === 1 ? '.' : '0';
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			replacementChar
		);

		const newValue = strategy.parse(newStr, field.length, field.allowZeroValue);

		const updatedPattern = PatternValueUpdates.updateFieldValue(context, fieldInfo, newValue);
		return { updatedPattern, shouldMoveNext: false };
	}

	private static handleEffectFieldDelete(
		context: EditingContext,
		fieldInfo: FieldInfo
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null {
		const currentValue = PatternValueUpdates.getFieldValue(context, fieldInfo);
		const currentStr = EffectField.formatValue(currentValue);

		if (currentStr === null) {
			return null;
		}

		if (fieldInfo.charOffset < 0 || fieldInfo.charOffset >= currentStr.length) {
			return null;
		}

		const charAtOffset = currentStr[fieldInfo.charOffset];

		if (charAtOffset === '.' || (fieldInfo.charOffset > 0 && charAtOffset === '0')) {
			return null;
		}

		const replacementChar = fieldInfo.charOffset === 0 ? '.' : '0';
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			replacementChar
		);
		const newEffectObj = EffectField.parseValue(newStr);

		const updatedPattern = PatternValueUpdates.updateFieldValue(
			context,
			fieldInfo,
			newEffectObj
		);
		return { updatedPattern, shouldMoveNext: false };
	}

	static deleteFieldInGeneric(
		generic: GenericPattern,
		row: number,
		fieldInfo: FieldInfo,
		field: { type: string; length: number; allowZeroValue?: boolean },
		schema: ChipSchema,
		tuningTable?: number[]
	): void {
		if (field.type === 'note') {
			if (fieldInfo.isGlobal) return;
			this.setGenericValue(generic, row, fieldInfo, '---');
			if (settingsStore.autoEnterInstrument) {
				const instrumentFieldDef = schema.fields?.instrument;
				if (instrumentFieldDef) {
					const instrumentFieldInfo: FieldInfo = {
						fieldKey: 'instrument',
						fieldType: instrumentFieldDef.type,
						isGlobal: false,
						channelIndex: fieldInfo.channelIndex,
						charOffset: 0
					};
					this.setGenericValue(generic, row, instrumentFieldInfo, 0);
				}
			}
			return;
		}

		if (EffectField.isEffectField(fieldInfo.fieldKey)) {
			this.deleteEffectFieldInGeneric(generic, row, fieldInfo);
			return;
		}

		if (fieldInfo.fieldKey === 'envelopeValue' && tuningTable) {
			this.setGenericValue(generic, row, fieldInfo, 0);
			return;
		}

		if (field.type === 'hex' || field.type === 'dec' || field.type === 'symbol') {
			this.deleteNumericFieldInGeneric(generic, row, fieldInfo, field);
			return;
		}

		if (field.type === 'text') {
			const currentValue = PatternValueUpdates.getValueFromGeneric(generic, row, fieldInfo);
			const currentStr =
				typeof currentValue === 'number' ? currentValue.toString() : String(currentValue);
			const newStr = StringManipulation.replaceCharAtOffset(
				currentStr,
				fieldInfo.charOffset,
				''
			);
			this.setGenericValue(generic, row, fieldInfo, newStr);
			return;
		}

		this.setGenericValue(generic, row, fieldInfo, '');
	}

	private static deleteNumericFieldInGeneric(
		generic: GenericPattern,
		row: number,
		fieldInfo: FieldInfo,
		field: { type: string; length: number; allowZeroValue?: boolean }
	): void {
		const currentValue = PatternValueUpdates.getValueFromGeneric(generic, row, fieldInfo);
		const ZERO_VALUE = -1;
		if (!FieldStrategyFactory.isSupported(field.type)) return;
		if (typeof currentValue === 'object' && currentValue !== null) return;

		if (currentValue === ZERO_VALUE) {
			this.setGenericValue(generic, row, fieldInfo, 0);
			return;
		}

		if (field.allowZeroValue) {
			if (currentValue === 0) return;
			this.setGenericValue(generic, row, fieldInfo, 0);
			return;
		}

		const strategy = FieldStrategyFactory.getStrategy(field.type);
		const currentStr = strategy.format(currentValue, field.length, field.allowZeroValue);
		if (fieldInfo.charOffset < 0 || fieldInfo.charOffset >= currentStr.length) return;
		const charAtOffset = currentStr[fieldInfo.charOffset];
		if (charAtOffset === '.' || charAtOffset === '0') return;
		const replacementChar =
			fieldInfo.fieldKey === 'instrument' || field.length === 1 ? '.' : '0';
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			replacementChar
		);
		this.setGenericValue(
			generic,
			row,
			fieldInfo,
			strategy.parse(newStr, field.length, field.allowZeroValue)
		);
	}

	private static deleteEffectFieldInGeneric(
		generic: GenericPattern,
		row: number,
		fieldInfo: FieldInfo
	): void {
		const currentValue = PatternValueUpdates.getValueFromGeneric(generic, row, fieldInfo);
		const currentStr = EffectField.formatValue(currentValue);
		if (!currentStr) return;
		if (fieldInfo.charOffset < 0 || fieldInfo.charOffset >= currentStr.length) return;
		const charAtOffset = currentStr[fieldInfo.charOffset];
		if (charAtOffset === '.' || (fieldInfo.charOffset > 0 && charAtOffset === '0')) return;
		const replacementChar = fieldInfo.charOffset === 0 ? '.' : '0';
		const newStr = StringManipulation.replaceCharAtOffset(
			currentStr,
			fieldInfo.charOffset,
			replacementChar
		);
		this.setGenericValue(generic, row, fieldInfo, EffectField.parseValue(newStr));
	}

	private static setGenericValue(
		generic: GenericPattern,
		row: number,
		fieldInfo: FieldInfo,
		value: string | number | null | undefined | Record<string, unknown>
	): void {
		if (fieldInfo.isGlobal) {
			generic.patternRows[row][fieldInfo.fieldKey] = value;
		} else {
			generic.channels[fieldInfo.channelIndex].rows[row][fieldInfo.fieldKey] = value;
		}
	}
}
