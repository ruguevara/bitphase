export interface ClipboardCell {
	row: number;
	column: number;
	fieldKey: string;
	fieldType: string;
	value: unknown;
}

export interface ClipboardData {
	cells: ClipboardCell[];
	minRow: number;
	minColumn: number;
	maxRow: number;
	maxColumn: number;
	rowCount: number;
	columnCount: number;
}

export const BITPHASE_PATTERN_CLIPBOARD_HEADER = 'BITPHASE_PATTERN_CLIPBOARD_V1';

class ClipboardStore {
	clipboardData: ClipboardData | null = $state(null);

	get hasData(): boolean {
		return this.clipboardData !== null && this.clipboardData.cells.length > 0;
	}

	copy(
		cells: ClipboardCell[],
		minRow: number,
		minColumn: number,
		maxRow: number,
		maxColumn: number
	): ClipboardData {
		const data = {
			cells: cells.map((cell) => ({ ...cell, value: this.cloneValue(cell.value) })),
			minRow,
			minColumn,
			maxRow,
			maxColumn,
			rowCount: maxRow - minRow + 1,
			columnCount: maxColumn - minColumn + 1
		};
		this.clipboardData = data;
		return this.cloneData(data);
	}

	set(data: ClipboardData): void {
		this.clipboardData = this.cloneData(data);
	}

	clear(): void {
		this.clipboardData = null;
	}

	serialize(data: ClipboardData): string {
		return `${BITPHASE_PATTERN_CLIPBOARD_HEADER}\n${JSON.stringify(data)}`;
	}

	parse(text: string): ClipboardData | null {
		if (!text.startsWith(`${BITPHASE_PATTERN_CLIPBOARD_HEADER}\n`)) return null;
		const json = text.slice(BITPHASE_PATTERN_CLIPBOARD_HEADER.length + 1);
		try {
			const parsed = JSON.parse(json);
			if (!this.isClipboardData(parsed)) return null;
			return this.cloneData(parsed);
		} catch {
			return null;
		}
	}

	private cloneData(data: ClipboardData): ClipboardData {
		return {
			...data,
			cells: data.cells.map((cell) => ({ ...cell, value: this.cloneValue(cell.value) }))
		};
	}

	private cloneValue(value: unknown): unknown {
		if (Array.isArray(value)) return value.map((item) => this.cloneValue(item));
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
					key,
					this.cloneValue(nested)
				])
			);
		}
		return value;
	}

	private isClipboardData(value: unknown): value is ClipboardData {
		if (!value || typeof value !== 'object') return false;
		const data = value as ClipboardData;
		return (
			Array.isArray(data.cells) &&
			Number.isInteger(data.minRow) &&
			Number.isInteger(data.minColumn) &&
			Number.isInteger(data.maxRow) &&
			Number.isInteger(data.maxColumn) &&
			Number.isInteger(data.rowCount) &&
			Number.isInteger(data.columnCount) &&
			data.cells.every((cell) => this.isClipboardCell(cell))
		);
	}

	private isClipboardCell(value: unknown): value is ClipboardCell {
		if (!value || typeof value !== 'object') return false;
		const cell = value as ClipboardCell;
		return (
			Number.isInteger(cell.row) &&
			Number.isInteger(cell.column) &&
			typeof cell.fieldKey === 'string' &&
			typeof cell.fieldType === 'string' &&
			Object.hasOwn(cell, 'value')
		);
	}
}

export const clipboardStore = new ClipboardStore();
