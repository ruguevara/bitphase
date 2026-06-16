<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		icon,
		title,
		onclick,
		disabled = false,
		variant = 'default',
		size = 'md',
		class: className,
		children
	}: {
		icon?: Component<{ class?: string }>;
		title: string;
		onclick: () => void;
		disabled?: boolean;
		variant?: 'default' | 'primary';
		size?: 'md' | 'sm';
		class?: ClassValue;
		children?: Snippet;
	} = $props();

	const Icon = $derived(icon);

	const variantClasses = $derived(
		variant === 'primary'
			? 'border-[var(--color-app-primary)] bg-[var(--color-app-primary)] text-[var(--color-app-on-primary)] hover:bg-[var(--color-app-primary-hover)]'
			: 'border-[var(--color-app-border)] bg-[var(--color-app-surface-active)] hover:bg-[var(--color-app-surface-hover)]'
	);

	const sizeClasses = $derived(
		size === 'sm'
			? 'flex h-6 w-6 shrink-0 items-center justify-center rounded border p-0'
			: 'rounded-sm border p-2'
	);

	const iconSizeClass = $derived(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4');
</script>

<button
	type="button"
	class="cursor-pointer transition-colors {sizeClasses} {variantClasses} {className}"
	class:opacity-50={disabled}
	class:cursor-not-allowed={disabled}
	{onclick}
	{disabled}
	{title}>
	{#if children}
		{@render children()}
	{:else if Icon}
		<Icon class={iconSizeClass} />
	{/if}
</button>
