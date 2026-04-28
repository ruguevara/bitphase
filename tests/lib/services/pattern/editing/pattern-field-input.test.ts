import { describe, expect, it } from 'vitest';
import { Pattern } from '../../../../../src/lib/models/song';
import { AYConverter } from '../../../../../src/lib/chips/ay/adapter';
import { AYFormatter } from '../../../../../src/lib/chips/ay/formatter';
import { AY_CHIP_SCHEMA } from '../../../../../src/lib/chips/ay/schema';
import { PatternFieldInput } from '../../../../../src/lib/services/pattern/editing/pattern-field-input';
import type {
	EditingContext,
	FieldInfo
} from '../../../../../src/lib/services/pattern/editing/editing-context';

function createContext(pattern: Pattern): EditingContext {
	return {
		pattern,
		selectedRow: 0,
		selectedColumn: 0,
		cellPositions: [],
		converter: new AYConverter(),
		formatter: new AYFormatter(),
		schema: AY_CHIP_SCHEMA
	};
}

function createFieldInfo(fieldKey: string, fieldType: string): FieldInfo {
	return {
		fieldKey,
		fieldType,
		isGlobal: false,
		channelIndex: 0,
		charOffset: 0
	};
}

describe('PatternFieldInput', () => {
	it('returns a non-mutating result when typed hex character matches the current value', () => {
		const pattern = new Pattern(0, 1, AY_CHIP_SCHEMA);
		pattern.channels[0].rows[0].volume = 0xf;

		const result = PatternFieldInput.handleHexInput(
			createContext(pattern),
			createFieldInfo('volume', 'hex'),
			'F',
			'KeyF'
		);

		expect(result).toEqual({
			updatedPattern: pattern,
			shouldMoveNext: false,
			didChange: false
		});
	});

	it('returns a non-mutating result when typed envelope shape matches the current value', () => {
		const pattern = new Pattern(0, 1, AY_CHIP_SCHEMA);
		pattern.channels[0].rows[0].envelopeShape = 0xa;

		const result = PatternFieldInput.handleHexInput(
			createContext(pattern),
			createFieldInfo('envelopeShape', 'hex'),
			'A',
			'KeyA'
		);

		expect(result).toEqual({
			updatedPattern: pattern,
			shouldMoveNext: false,
			didChange: false
		});
	});

	it('updates hex fields when typed character changes the current value', () => {
		const pattern = new Pattern(0, 1, AY_CHIP_SCHEMA);
		pattern.channels[0].rows[0].volume = 0xe;

		const result = PatternFieldInput.handleHexInput(
			createContext(pattern),
			createFieldInfo('volume', 'hex'),
			'F',
			'KeyF'
		);

		expect(result).not.toBeNull();
		expect(result?.updatedPattern.channels[0].rows[0].volume).toBe(0xf);
	});
});
