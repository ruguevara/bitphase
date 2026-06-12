<script lang="ts">
	import IconCarbonArrowsVertical from '~icons/carbon/arrows-vertical';

	let {
		isResizing = false,
		label,
		onmousedown
	}: {
		isResizing?: boolean;
		label: string;
		onmousedown: (event: MouseEvent) => void;
	} = $props();
</script>

<div
	class="flex shrink-0 cursor-ns-resize items-center justify-center border-y border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] py-1 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)] {isResizing
		? 'bg-[var(--color-app-surface-hover)]'
		: ''}"
	role="button"
	tabindex="0"
	aria-label={label}
	title={label}
	{onmousedown}>
	<IconCarbonArrowsVertical class="h-3 w-3" />
</div>
