import type { ChipSchema, ChipSetting, ChipSettingSideEffect } from './schema';

export function buildChipSettingsContext(
	settings: ChipSetting[],
	values: Record<string, unknown>
): Record<string, unknown> {
	return Object.fromEntries(settings.map((s) => [s.key, values[s.key] ?? s.defaultValue]));
}

export function resolveChipSettingDisplayValue(
	setting: ChipSetting,
	value: unknown,
	context: Record<string, unknown>
): unknown {
	return setting.resolveDisplayValue?.(value, context) ?? value;
}

export function collectSettingSideEffects(
	schema: ChipSchema,
	key: string,
	value: unknown,
	context: Record<string, unknown>
): ChipSettingSideEffect[] {
	return schema.applySettingSideEffects?.(key, value, context) ?? [];
}

export function normalizeChipSettingsRecord(
	schema: ChipSchema,
	record: Record<string, unknown>
): Record<string, unknown> {
	return schema.normalizeSettings?.(record) ?? record;
}
