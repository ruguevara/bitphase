export const PATTERN_EDITOR_COLOR_KEYS = [
	'patternBg',
	'patternText',
	'patternEmpty',
	'patternEmptySelected',
	'patternNote',
	'patternInstrument',
	'patternEffect',
	'patternEnvelope',
	'patternNoise',
	'patternSelected',
	'patternCellSelected',
	'patternRowNum',
	'patternAlternate',
	'patternAlternateEmpty',
	'patternTable',
	'patternRowNumAlternate',
	'patternNoteOff',
	'patternTableOff',
	'patternChannelSeparator'
] as const;

export const PATTERN_ORDER_COLOR_KEYS = [
	'orderBg',
	'orderText',
	'orderEmpty',
	'orderSelected',
	'orderHovered',
	'orderAlternate',
	'orderBorder'
] as const;

export const APP_COLOR_KEYS = [
	'appBackground',
	'appSurface',
	'appSurfaceSecondary',
	'appSurfaceHover',
	'appSurfaceActive',
	'appTextPrimary',
	'appTextSecondary',
	'appTextTertiary',
	'appTextMuted',
	'appBorder',
	'appBorderHover',
	'appPrimary',
	'appPrimaryHover',
	'appOnPrimary',
	'appSecondary',
	'appSecondaryHover'
] as const;

export const ALL_THEME_COLOR_KEYS = [
	...PATTERN_EDITOR_COLOR_KEYS,
	...PATTERN_ORDER_COLOR_KEYS,
	...APP_COLOR_KEYS
] as const;

export type PatternEditorColorKey = (typeof PATTERN_EDITOR_COLOR_KEYS)[number];
export type PatternOrderColorKey = (typeof PATTERN_ORDER_COLOR_KEYS)[number];
export type AppColorKey = (typeof APP_COLOR_KEYS)[number];
export type ThemeColorKey = (typeof ALL_THEME_COLOR_KEYS)[number];

function toCssVarName(key: string): string {
	return `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

export const CSS_VAR_MAP = Object.fromEntries(
	ALL_THEME_COLOR_KEYS.map((key) => [key, toCssVarName(key)])
) as Record<ThemeColorKey, string>;
