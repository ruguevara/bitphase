<script lang="ts">
	import type { Component } from 'svelte';

	export interface PillTab {
		id: string;
		label: string;
		icon?: Component;
		disabled?: boolean;
	}

	let {
		tabs,
		activeTabId = $bindable(''),
		size = 'md',
		class: className = '',
		onSelect
	}: {
		tabs: PillTab[];
		activeTabId?: string;
		size?: 'md' | 'sm';
		class?: string;
		onSelect?: (tabId: string) => void;
	} = $props();

	const buttonClass = $derived(
		size === 'sm'
			? 'rounded px-2.5 py-0.5 text-xs'
			: 'flex items-center gap-1.5 rounded px-3 py-1 text-xs'
	);

	function selectTab(tab: PillTab) {
		if (tab.disabled) {
			return;
		}
		activeTabId = tab.id;
		onSelect?.(tab.id);
	}
</script>

<div class="flex gap-1 {className}">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			disabled={tab.disabled}
			class="{buttonClass} {activeTabId === tab.id
				? 'bg-[var(--color-app-primary)] text-white'
				: 'bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-muted)]'} {tab.disabled
				? 'cursor-not-allowed opacity-40'
				: activeTabId === tab.id
					? 'cursor-pointer'
					: 'cursor-pointer hover:bg-[var(--color-app-surface-hover)]'}"
			onclick={() => selectTab(tab)}>
			{#if tab.icon}
				{@const Icon = tab.icon}
				<Icon class="h-3.5 w-3.5 shrink-0" />
			{/if}
			{tab.label}
		</button>
	{/each}
</div>
