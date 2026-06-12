<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		variant = 'error',
		class: className,
		children
	}: {
		variant?: 'error' | 'warning' | 'info' | 'callout' | 'error-inline';
		class?: ClassValue;
		children: Snippet;
	} = $props();

	const variantClasses = $derived(
		variant === 'warning'
			? 'rounded border border-[var(--color-pattern-note-off)]/40 bg-[var(--color-pattern-note-off)]/10 text-[var(--color-app-text-primary)]'
			: variant === 'info'
				? 'rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-3 py-2 text-xs text-[var(--color-app-text-primary)]'
				: variant === 'callout'
					? 'shrink-0 border-b border-l-4 border-[var(--color-app-border)] border-l-[var(--color-pattern-effect)] bg-[color-mix(in_srgb,var(--color-pattern-effect)_14%,var(--color-app-surface))] px-4 py-2 pl-3 text-xs text-[var(--color-app-text-primary)]'
					: variant === 'error-inline'
						? 'rounded bg-red-900/20 px-3 py-2 text-xs text-red-400'
						: 'rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-400'
	);
</script>

<div class="{variantClasses} {className}">
	{@render children()}
</div>
