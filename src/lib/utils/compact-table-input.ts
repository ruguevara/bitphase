import { ROW_SELECTION_STYLES } from './row-selection';

export function compactTableInputClass(options: {
	selected?: boolean;
	isExpanded?: boolean;
	width?: 'full' | 'compact';
	inactive?: boolean;
} = {}): string {
	const { selected = false, isExpanded = true, width = 'full', inactive = false } = options;
	const widthClass =
		width === 'compact' ? 'w-9 max-w-9 shrink-0' : 'w-full min-w-0 overflow-x-auto';
	const sizeClass = isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]';
	const bgClass = selected ? ROW_SELECTION_STYLES.input : 'bg-[var(--color-app-surface)]';
	const textClass = inactive
		? 'text-[var(--color-app-text-tertiary)] opacity-60'
		: 'text-[var(--color-app-text-secondary)]';
	return `${widthClass} rounded border border-[var(--color-app-border)] ${bgClass} ${sizeClass} ${textClass} placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
}
