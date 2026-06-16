<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	type NativeSelectOption = {
		label: string;
		value: string;
	};

	let {
		id,
		value = $bindable(),
		options,
		disabled = false,
		class: className,
		placeholder,
		onchange
	}: {
		id?: string;
		value: string;
		options: NativeSelectOption[];
		disabled?: boolean;
		class?: ClassValue;
		placeholder?: string;
		onchange?: (event: Event) => void;
	} = $props();

	const selectClass =
		'cursor-pointer rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1.5 text-xs text-[var(--color-app-text-secondary)] focus:border-[var(--color-app-primary)] focus:outline-none';
</script>

<select
	{id}
	bind:value
	{disabled}
	class="{selectClass} {className}"
	class:cursor-not-allowed={disabled}
	class:opacity-50={disabled}
	{onchange}>
	{#if placeholder}
		<option value="">{placeholder}</option>
	{/if}
	{#each options as option (option.value)}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>
