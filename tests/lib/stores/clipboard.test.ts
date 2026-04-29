import { describe, it, expect, beforeEach } from 'vitest';
import {
	BITPHASE_PATTERN_CLIPBOARD_HEADER,
	clipboardStore,
	type ClipboardCell
} from '../../../src/lib/stores/clipboard.svelte';

describe('ClipboardStore', () => {
	beforeEach(() => {
		clipboardStore.clear();
	});

	it('should start empty', () => {
		expect(clipboardStore.hasData).toBe(false);
		expect(clipboardStore.clipboardData).toBeNull();
	});

	it('should copy single cell', () => {
		const cells: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			}
		];

		clipboardStore.copy(cells, 0, 0, 0, 0);

		expect(clipboardStore.hasData).toBe(true);
		expect(clipboardStore.clipboardData).toBeDefined();
		expect(clipboardStore.clipboardData?.cells).toHaveLength(1);
		expect(clipboardStore.clipboardData?.rowCount).toBe(1);
		expect(clipboardStore.clipboardData?.columnCount).toBe(1);
	});

	it('should copy multiple cells', () => {
		const cells: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			},
			{
				row: 1,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'D-4'
			},
			{
				row: 2,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'E-4'
			}
		];

		clipboardStore.copy(cells, 0, 0, 2, 0);

		expect(clipboardStore.hasData).toBe(true);
		expect(clipboardStore.clipboardData?.cells).toHaveLength(3);
		expect(clipboardStore.clipboardData?.rowCount).toBe(3);
		expect(clipboardStore.clipboardData?.columnCount).toBe(1);
	});

	it('should copy rectangular selection', () => {
		const cells: ClipboardCell[] = [];
		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 2; col++) {
				cells.push({
					row,
					column: col,
					fieldKey: 'note',
					fieldType: 'note',
					value: `R${row}C${col}`
				});
			}
		}

		clipboardStore.copy(cells, 0, 0, 2, 1);

		expect(clipboardStore.hasData).toBe(true);
		expect(clipboardStore.clipboardData?.cells).toHaveLength(6);
		expect(clipboardStore.clipboardData?.rowCount).toBe(3);
		expect(clipboardStore.clipboardData?.columnCount).toBe(2);
	});

	it('should clear clipboard', () => {
		const cells: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			}
		];

		clipboardStore.copy(cells, 0, 0, 0, 0);
		expect(clipboardStore.hasData).toBe(true);

		clipboardStore.clear();
		expect(clipboardStore.hasData).toBe(false);
		expect(clipboardStore.clipboardData).toBeNull();
	});

	it('should preserve cell data when copying', () => {
		const cells: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			}
		];

		clipboardStore.copy(cells, 5, 3, 5, 3);

		const data = clipboardStore.clipboardData;
		expect(data?.minRow).toBe(5);
		expect(data?.minColumn).toBe(3);
		expect(data?.maxRow).toBe(5);
		expect(data?.maxColumn).toBe(3);
	});

	it('should clone cells to prevent mutation', () => {
		const cells: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			}
		];

		clipboardStore.copy(cells, 0, 0, 0, 0);

		cells[0].value = 'D-4';

		const data = clipboardStore.clipboardData;
		expect(data?.cells[0].value).toBe('C-4');
	});

	it('should overwrite previous clipboard data', () => {
		const cells1: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'C-4'
			}
		];

		const cells2: ClipboardCell[] = [
			{
				row: 0,
				column: 0,
				fieldKey: 'note',
				fieldType: 'note',
				value: 'D-4'
			}
		];

		clipboardStore.copy(cells1, 0, 0, 0, 0);
		expect(clipboardStore.clipboardData?.cells[0].value).toBe('C-4');

		clipboardStore.copy(cells2, 0, 0, 0, 0);
		expect(clipboardStore.clipboardData?.cells[0].value).toBe('D-4');
	});

	it('should serialize and parse versioned system clipboard text', () => {
		const data = clipboardStore.copy(
			[
				{
					row: 0,
					column: 0,
					fieldKey: 'effect',
					fieldType: 'hex',
					value: { effect: 1, delay: 2, parameter: 3 }
				}
			],
			0,
			0,
			0,
			0
		);

		const serialized = clipboardStore.serialize(data);
		const parsed = clipboardStore.parse(serialized);

		expect(serialized.startsWith(`${BITPHASE_PATTERN_CLIPBOARD_HEADER}\n`)).toBe(true);
		expect(parsed).toEqual(data);
	});

	it('should reject unrelated system clipboard text', () => {
		expect(clipboardStore.parse('C-4 01 F')).toBeNull();
	});
});

