<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		title,
		subtitle = '',
		width = 'w-[500px]',
		height = '',
		maxHeightClass = 'max-h-[90vh]',
		compact = false,
		scrollMode = 'body',
		headerActions,
		children,
		footer,
		bodyClass,
		class: className
	}: {
		title: string;
		subtitle?: string;
		width?: string;
		height?: string;
		maxHeightClass?: string;
		compact?: boolean;
		scrollMode?: 'body' | 'panel';
		headerActions?: Snippet;
		children: Snippet;
		footer?: Snippet;
		bodyClass?: ClassValue;
		class?: ClassValue;
	} = $props();

	const headerPadding = $derived(compact ? 'px-3 py-2' : 'px-4 py-3');
	const footerPadding = $derived(compact ? 'px-3 py-2' : 'px-4 py-3');
	const titleClass = $derived(compact ? 'font-bold' : 'text-sm font-bold');
	const defaultBodyClass = $derived(
		scrollMode === 'body'
			? compact
				? 'min-h-0 flex-1 overflow-y-auto p-3'
				: 'min-h-0 flex-1 overflow-y-auto p-4'
			: compact
				? 'overflow-y-auto p-3'
				: 'overflow-y-auto p-4'
	);
	const resolvedBodyClass = $derived(bodyClass ?? defaultBodyClass);
	const outerClass = $derived(
		scrollMode === 'panel' ? `${maxHeightClass} overflow-y-auto` : `${maxHeightClass} overflow-hidden`
	);
</script>

<div class="flex {outerClass} {width} {height} flex-col {className}">
	<div
		class="flex shrink-0 items-center border-b border-[var(--color-app-border)] bg-[var(--color-app-surface)] {headerPadding} {headerActions || subtitle
			? 'justify-between gap-3'
			: 'gap-2'}">
		<div class="min-w-0">
			<h2 class="{titleClass} text-[var(--color-app-text-primary)]">{title}</h2>
			{#if subtitle}
				<p class="text-xs text-[var(--color-app-text-muted)]">{subtitle}</p>
			{/if}
		</div>
		{#if headerActions}
			<div class="flex shrink-0 flex-wrap items-center gap-1">
				{@render headerActions()}
			</div>
		{/if}
	</div>

	<div class={resolvedBodyClass}>
		{@render children()}
	</div>

	{#if footer}
		<div
			class="flex shrink-0 justify-end gap-2 border-t border-[var(--color-app-border)] bg-[var(--color-app-surface)] {footerPadding}">
			{@render footer()}
		</div>
	{/if}
</div>
