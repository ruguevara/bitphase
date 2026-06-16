<script lang="ts">
	import IconCarbonClose from '~icons/carbon/close';
	import type { Component, Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		icon,
		iconSizeClass = 'h-3.5 w-3.5',
		title,
		subtitle = '',
		titleTooltip = '',
		badges,
		toolbar,
		onclose,
		closeLabel = 'Close editor',
		disabled = false,
		canvasHeight,
		canvasClass = '',
		children
	}: {
		icon: Component<{ class?: string }>;
		iconSizeClass?: string;
		title: string;
		subtitle?: string;
		titleTooltip?: string;
		badges?: Snippet;
		toolbar?: Snippet;
		onclose?: () => void;
		closeLabel?: string;
		disabled?: boolean;
		canvasHeight: number;
		canvasClass?: ClassValue;
		children: Snippet;
	} = $props();

	const Icon = $derived(icon);
</script>

<div
	class="mx-2 mt-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] p-3 {disabled
		? 'opacity-60'
		: ''}">
	<div class="mb-2 flex flex-nowrap items-start justify-between gap-2">
		<div
			class="flex min-w-0 items-center gap-2 text-xs text-[var(--color-app-text-muted)]"
			title={titleTooltip}>
			<span
				class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-pattern-note)]/10 text-[var(--color-pattern-note)]">
				<Icon class={iconSizeClass} />
			</span>
			<div class="min-w-0 leading-tight">
				<div class="truncate text-[var(--color-app-text-secondary)]">{title}</div>
				{#if subtitle}
					<div class="truncate text-[10px] text-[var(--color-app-text-tertiary)]">{subtitle}</div>
				{/if}
			</div>
		</div>
		<div
			class="flex shrink-0 flex-nowrap items-center gap-2 text-[10px] text-[var(--color-app-text-tertiary)]">
			{#if badges}
				<div class="flex flex-nowrap items-center gap-2 whitespace-nowrap">
					{@render badges()}
				</div>
			{/if}
			{#if onclose}
				<button
					type="button"
					class="inline-flex cursor-pointer items-center justify-center rounded p-1 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]"
					title={closeLabel}
					aria-label={closeLabel}
					onclick={onclose}>
					<IconCarbonClose class={iconSizeClass} />
				</button>
			{/if}
		</div>
	</div>

	{#if toolbar}
		<div class="mb-2 flex flex-wrap gap-1">
			{@render toolbar()}
		</div>
	{/if}

	<div
		class="overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface)] ring-1 ring-inset ring-[var(--color-app-border)]/60 {canvasClass}"
		style:height="{canvasHeight}px">
		{@render children()}
	</div>
</div>
