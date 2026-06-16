<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		children,
		onclick,
		variant = 'default',
		size = 'default',
		disabled = false,
		title = '',
		class: className
	}: {
		children: Snippet;
		onclick: (e: MouseEvent) => void;
		variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive' | 'header';
		size?: 'default' | 'sm';
		disabled?: boolean;
		title?: string;
		class?: ClassValue;
	} = $props();

	const variantClasses = $derived(
		variant === 'primary'
			? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary)] text-[var(--color-app-on-primary)] hover:bg-[var(--color-app-primary-hover)]'
			: variant === 'secondary'
				? 'border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]'
				: variant === 'ghost'
					? 'border-transparent bg-transparent text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]'
					: variant === 'destructive'
						? 'border-transparent bg-transparent text-[var(--color-pattern-note-off)] hover:bg-[color-mix(in_srgb,var(--color-pattern-note-off)_14%,var(--color-app-surface))]'
						: variant === 'header'
							? 'border-transparent bg-transparent text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)] active:bg-[var(--color-app-surface-active)]'
							: 'border-[var(--color-app-border)] bg-[var(--color-pattern-bg)] hover:bg-[var(--color-pattern-selected)]'
	);

	const sizeClasses = $derived(
		size === 'sm' ? 'px-2 py-1' : variant === 'header' ? 'px-2 py-1' : 'px-4 py-1.5'
	);
</script>

<button
	type="button"
	{onclick}
	{disabled}
	{title}
	class="cursor-pointer rounded-sm border text-xs transition-colors focus:border-transparent focus:ring-1
		focus:ring-blue-500 focus:outline-none {sizeClasses} {variantClasses} {className}"
	class:opacity-50={disabled}
	class:cursor-not-allowed={disabled}>
	{@render children()}
</button>
