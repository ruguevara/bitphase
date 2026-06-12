<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		icon,
		label,
		value,
		width = 'w-[5.5rem]',
		min,
		max,
		step = 1,
		disabled = false,
		field,
		class: className,
		onchange,
		onkeydown,
		suffix
	}: {
		icon: Component<{ class?: string }>;
		label: string;
		value: number | string;
		width?: string;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		field?: string;
		class?: ClassValue;
		onchange?: (event: Event) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		suffix?: Snippet;
	} = $props();

	const Icon = $derived(icon);

	const inputClass =
		'rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] tabular-nums focus:border-[var(--color-app-primary)] focus:outline-none';
</script>

<label class="flex min-w-0 flex-col gap-1 {className}" class:opacity-50={disabled}>
	<span class="inline-flex items-center gap-1 text-xs text-[var(--color-app-text-secondary)]">
		<Icon class="h-3 w-3 shrink-0 text-[var(--color-app-text-tertiary)]" />
		{label}
	</span>
	<div class="flex flex-wrap items-center gap-2">
		<input
			type="number"
			data-field={field}
			class="{width} {inputClass} {disabled ? 'disabled:cursor-not-allowed' : ''}"
			{min}
			{max}
			{step}
			{value}
			{disabled}
			{onchange}
			{onkeydown} />
		{#if suffix}
			{@render suffix()}
		{/if}
	</div>
</label>
