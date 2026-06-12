import type { Pattern } from '../../models/song';
import type { ChipSchema, ChipField } from '../../chips/base/schema';

export interface CatchUpSegment {
	pattern: Pattern;
	patternOrderIndex: number;
	numRows: number;
}

function toNum(v: unknown): number {
	if (v === undefined || v === null) return NaN;
	const n = Number(v);
	return Number.isNaN(n) ? NaN : n;
}

function isGlobalFieldValueSet(key: string, value: unknown, field: ChipField): boolean {
	if (value === undefined || value === null) return false;
	const n = toNum(value);
	if (Number.isNaN(n)) return false;
	const when = field.backtrackWhen ?? 'any';
	if (when === 'nonZero') return n !== 0;
	return true;
}

function isChannelFieldValueSet(key: string, value: unknown, field: ChipField): boolean {
	if (value === undefined || value === null) return false;
	if (field.type === 'note' || key === 'note') {
		const note = value as { name?: number } | undefined;
		const name = note?.name;
		return name !== undefined && name !== null && name !== 0;
	}
	const n = toNum(value);
	if (Number.isNaN(n)) return false;
	if (key === 'table') return n === -1 || n > 0;
	const when = field.backtrackWhen ?? 'any';
	if (when === 'nonZero') return n !== 0;
	return true;
}

function isExtraFieldValueSet(value: unknown): boolean {
	if (value === undefined || value === null) return false;
	if (typeof value === 'object') {
		const effect = (value as { effect?: unknown }).effect;
		return typeof effect === 'number' && effect !== 0;
	}
	const n = toNum(value);
	return !Number.isNaN(n) && n !== 0;
}

function positionAfter(aOrder: number, aRow: number, bOrder: number, bRow: number): boolean {
	return aOrder > bOrder || (aOrder === bOrder && aRow > bRow);
}

export function computeStateHorizon(
	patternOrder: number[],
	getPattern: (patternId: number) => Pattern | undefined,
	targetOrderIndex: number,
	targetRow: number,
	schema: ChipSchema
): { orderIndex: number; row: number } | null {
	const channelCount = schema.channelLabels?.length ?? 0;
	const channelFieldEntries = schema.fields
		? Object.entries(schema.fields).filter(([_, f]) => f.usedForBacktracking === true)
		: [];
	const globalFieldEntries = schema.globalFields
		? Object.entries(schema.globalFields).filter(([_, f]) => f.usedForBacktracking === true)
		: [];

	let horizonOrderIndex = -1;
	let horizonRow = -1;

	for (let orderIndex = targetOrderIndex; orderIndex >= 0; orderIndex--) {
		const patternId = patternOrder[orderIndex];
		const pattern = getPattern(patternId);
		if (!pattern || !pattern.channels?.length || !pattern.patternRows) continue;

		const rowStart = orderIndex === targetOrderIndex ? targetRow - 1 : pattern.length - 1;
		const rowEnd = 0;

		for (let rowIndex = rowStart; rowIndex >= rowEnd; rowIndex--) {
			if (rowIndex < 0 || rowIndex >= pattern.patternRows.length) continue;

			const patternRow = pattern.patternRows[rowIndex] as Record<string, unknown> | undefined;
			for (const [key, field] of globalFieldEntries) {
				const value = patternRow?.[key];
				if (isGlobalFieldValueSet(key, value, field)) {
					if (
						horizonOrderIndex < 0 ||
						positionAfter(orderIndex, rowIndex, horizonOrderIndex, horizonRow)
					) {
						horizonOrderIndex = orderIndex;
						horizonRow = rowIndex;
					}
				}
			}

			for (let ch = 0; ch < channelCount && ch < pattern.channels.length; ch++) {
				const channel = pattern.channels[ch];
				const row = channel.rows?.[rowIndex] as Record<string, unknown> | undefined;
				if (!row) continue;

				for (const [key, field] of channelFieldEntries) {
					const value = row[key];
					if (isChannelFieldValueSet(key, value, field)) {
						if (
							horizonOrderIndex < 0 ||
							positionAfter(orderIndex, rowIndex, horizonOrderIndex, horizonRow)
						) {
							horizonOrderIndex = orderIndex;
							horizonRow = rowIndex;
						}
					}
				}
			}
		}
	}

	if (horizonOrderIndex < 0 || horizonRow < 0) return null;
	return { orderIndex: horizonOrderIndex, row: horizonRow };
}

export interface EffectiveRowData {
	channelFields: Record<string, unknown>;
	globalFields: Record<string, unknown>;
}

export interface RowResolutionContext {
	patternOrder: number[];
	getPattern: (patternId: number) => Pattern | undefined;
	orderIndex: number;
	row: number;
	channelIndex: number;
	schema: ChipSchema;
}

export function resolveEffectiveRowFields(
	patternOrder: number[],
	getPattern: (patternId: number) => Pattern | undefined,
	targetOrderIndex: number,
	targetRow: number,
	channelIndex: number,
	schema: ChipSchema,
	extraGlobalKeys: string[] = []
): EffectiveRowData {
	const channelEntries = schema.fields
		? Object.entries(schema.fields).filter(([_, f]) => f.usedForBacktracking === true)
		: [];
	const globalEntries = schema.globalFields
		? Object.entries(schema.globalFields).filter(([_, f]) => f.usedForBacktracking === true)
		: [];

	const channelFields: Record<string, unknown> = {};
	const globalFields: Record<string, unknown> = {};
	const pendingChannel = new Set(channelEntries.map(([key]) => key));
	const pendingGlobal = new Set([...globalEntries.map(([key]) => key), ...extraGlobalKeys]);
	const extraGlobalKeySet = new Set(extraGlobalKeys);

	for (let orderIndex = targetOrderIndex; orderIndex >= 0; orderIndex--) {
		if (pendingChannel.size === 0 && pendingGlobal.size === 0) break;
		const pattern = getPattern(patternOrder[orderIndex]);
		if (!pattern || !pattern.patternRows) continue;

		const rowStart = orderIndex === targetOrderIndex ? targetRow : pattern.length - 1;
		for (let rowIndex = rowStart; rowIndex >= 0; rowIndex--) {
			if (pendingChannel.size === 0 && pendingGlobal.size === 0) break;

			const patternRow = pattern.patternRows[rowIndex] as Record<string, unknown> | undefined;
			for (const [key, field] of globalEntries) {
				if (!pendingGlobal.has(key)) continue;
				const value = patternRow?.[key];
				if (isGlobalFieldValueSet(key, value, field)) {
					globalFields[key] = value;
					pendingGlobal.delete(key);
				}
			}
			for (const key of extraGlobalKeySet) {
				if (!pendingGlobal.has(key)) continue;
				const value = patternRow?.[key];
				if (isExtraFieldValueSet(value)) {
					globalFields[key] = value;
					pendingGlobal.delete(key);
				}
			}

			const row = pattern.channels?.[channelIndex]?.rows?.[rowIndex] as
				| Record<string, unknown>
				| undefined;
			if (row) {
				for (const [key, field] of channelEntries) {
					if (!pendingChannel.has(key)) continue;
					const value = row[key];
					if (isChannelFieldValueSet(key, value, field)) {
						channelFields[key] = value;
						pendingChannel.delete(key);
					}
				}
			}
		}
	}

	return { channelFields, globalFields };
}

export function buildCatchUpSegmentsToHorizon(
	patternOrder: number[],
	getPattern: (patternId: number) => Pattern | undefined,
	horizonOrderIndex: number,
	horizonRow: number
): CatchUpSegment[] {
	const segments: CatchUpSegment[] = [];
	for (let i = 0; i <= horizonOrderIndex; i++) {
		const patternId = patternOrder[i];
		const pattern = getPattern(patternId);
		if (!pattern) continue;
		const numRows = i === horizonOrderIndex ? horizonRow + 1 : pattern.length;
		segments.push({ pattern, patternOrderIndex: i, numRows });
	}
	return segments;
}
