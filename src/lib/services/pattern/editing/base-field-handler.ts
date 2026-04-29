import type { EditingContext, FieldInfo } from './editing-context';
import type { Pattern } from '../../../models/song';
import { PatternValueUpdates } from './pattern-value-updates';

export abstract class BaseFieldHandler {
	protected getField(
		context: EditingContext,
		fieldInfo: FieldInfo
	): { key: string; type: string; length: number } {
		const field = PatternValueUpdates.getFieldDefinition(context, fieldInfo.fieldKey);
		if (!field) {
			throw new Error(`Field not found: ${fieldInfo.fieldKey}`);
		}
		return field;
	}

	protected getCurrentValue(
		context: EditingContext,
		fieldInfo: FieldInfo
	): string | number | null | Record<string, unknown> {
		return PatternValueUpdates.getFieldValue(context, fieldInfo);
	}

	protected updateValue(
		context: EditingContext,
		fieldInfo: FieldInfo,
		newValue: string | number | null
	): Pattern {
		return PatternValueUpdates.updateFieldValue(context, fieldInfo, newValue);
	}

	protected createResult(
		updatedPattern: Pattern,
		shouldMoveNext: boolean = false
	): { updatedPattern: Pattern; shouldMoveNext: boolean } {
		return { updatedPattern, shouldMoveNext };
	}

	abstract handle(
		context: EditingContext,
		fieldInfo: FieldInfo,
		key: string
	): { updatedPattern: Pattern; shouldMoveNext: boolean } | null;
}
