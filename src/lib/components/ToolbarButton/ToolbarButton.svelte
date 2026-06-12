<script lang="ts">
	import type { Component } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		icon,
		label,
		onclick,
		disabled = false,
		title = '',
		class: className
	}: {
		icon: Component<{ class?: string }>;
		label: string;
		onclick: () => void;
		disabled?: boolean;
		title?: string;
		class?: ClassValue;
	} = $props();

	const Icon = $derived(icon);
</script>

<button
	type="button"
	class="flex cursor-pointer items-center gap-1.5 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1.5 text-xs text-[var(--color-app-text-tertiary)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-primary)] disabled:cursor-not-allowed disabled:opacity-50 {className}"
	{onclick}
	{disabled}
	{title}>
	<Icon class="h-3.5 w-3.5" />
	<span>{label}</span>
</button>
