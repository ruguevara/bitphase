<script lang="ts">
	import type { Component } from 'svelte';

	let {
		icon,
		title,
		onclick,
		destructive = false
	}: {
		icon: Component<{ class?: string }>;
		title: string;
		onclick: (event: MouseEvent) => void;
		destructive?: boolean;
	} = $props();

	const Icon = $derived(icon);
</script>

<button
	type="button"
	class="cursor-pointer rounded p-0.5 text-[var(--color-app-text-muted)] {destructive
		? 'hover:text-[var(--color-pattern-note-off)]'
		: 'hover:text-[var(--color-app-text-primary)]'}"
	{title}
	{onclick}>
	<Icon class="h-3 w-3" />
</button>
