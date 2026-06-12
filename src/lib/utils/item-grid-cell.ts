export function itemGridCellBackground(isSelected: boolean, isUsed: boolean): string {
	if (isSelected) return 'bg-[var(--color-app-primary)]';
	if (isUsed) {
		return 'bg-[var(--color-app-surface-secondary)]/40 hover:bg-[var(--color-app-surface-secondary)]/70';
	}
	return 'bg-[var(--color-app-background)]/60 hover:bg-[var(--color-app-background)]/80';
}

export function itemGridIdTextClass(isSelected: boolean, isUsed: boolean): string {
	if (isSelected) return 'text-[var(--color-app-on-primary)]';
	if (isUsed) {
		return 'text-[var(--color-app-text-tertiary)] group-hover:text-[var(--color-app-text-primary)]';
	}
	return 'text-[var(--color-app-text-muted)] group-hover:text-[var(--color-app-text-tertiary)]';
}

export function itemGridNameTextClass(isSelected: boolean, isUsed: boolean): string {
	if (isSelected) return 'text-[var(--color-app-on-primary)]';
	if (isUsed) {
		return 'text-[var(--color-app-text-muted)] group-hover:text-[var(--color-app-text-tertiary)]';
	}
	return 'text-[var(--color-app-text-muted)] group-hover:text-[var(--color-app-text-muted)]';
}
