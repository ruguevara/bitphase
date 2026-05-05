import type { Theme, ThemeColors } from '../../types/theme';
import { BUILTIN_THEMES } from '../../config/themes';
import { CSS_VAR_MAP } from '../../config/theme-colors';

function mergeThemeColors(colors: ThemeColors): ThemeColors {
	return { ...BUILTIN_THEMES[0].colors, ...colors };
}

export { mergeThemeColors };

export class ThemeService {
	private colorChangeListeners: Set<() => void> = new Set();

	applyTheme(theme: Theme | null): void {
		if (!theme) return;

		const root = document.documentElement;
		const colors = mergeThemeColors(theme.colors);

		for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
			const colorKey = key as keyof ThemeColors;
			root.style.setProperty(cssVar, colors[colorKey]);
		}

		this.notifyColorChange();
	}

	applyPreviewColors(colors: ThemeColors | null): void {
		if (!colors) {
			return;
		}

		const root = document.documentElement;
		const merged = mergeThemeColors(colors);

		for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
			const colorKey = key as keyof ThemeColors;
			root.style.setProperty(cssVar, merged[colorKey]);
		}

		this.notifyColorChange();
	}

	onColorChange(callback: () => void): () => void {
		this.colorChangeListeners.add(callback);
		return () => {
			this.colorChangeListeners.delete(callback);
		};
	}

	private notifyColorChange(): void {
		this.colorChangeListeners.forEach((callback) => callback());
	}
}

export const themeService = new ThemeService();
