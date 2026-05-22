<script lang="ts">
	import IconCarbonRenew from '~icons/carbon/renew';
	import IconCarbonEdit from '~icons/carbon/edit';
	import { ROW_SELECTION_STYLES } from '../../utils/row-selection';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let {
		index,
		selected = false,
		isExpanded = false
	}: {
		index: number;
		selected?: boolean;
		isExpanded?: boolean;
	} = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
	const sidEnabled = $derived(controller.rowSidEnabled(index));
	const syncbuzzerEnabled = $derived(controller.rowSyncbuzzerEnabled(index));
	const rowMode = $derived(controller.rowSidPeriodMode(index));
	const rowDetune = $derived(controller.rowDetune(index));
	const rowPeriod = $derived(controller.rowPeriod(index));

	function numericInputClass(inactive = false): string {
		return `w-full min-w-0 overflow-x-auto rounded border border-[var(--color-app-border)] ${
			selected ? ROW_SELECTION_STYLES.input : 'bg-[var(--color-app-surface)]'
		} ${isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]'} ${
			inactive
				? 'text-[var(--color-app-text-tertiary)] opacity-60'
				: 'text-[var(--color-app-text-secondary)]'
		} placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}
</script>

<td
	class="{isExpanded
		? 'w-8 min-w-8 px-1'
		: 'w-8 min-w-8 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
		? ROW_SELECTION_STYLES.cell
		: sidEnabled
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	tabindex="-1"
	onmousedown={() => controller.beginDragSid(index)}
	onmouseover={() => controller.dragOverSid(index)}
	onfocus={() => controller.dragOverSid(index)}>
	{sidEnabled ? '✓' : ''}
</td>
<td
	class="{isExpanded
		? 'w-8 min-w-8 px-1'
		: 'w-8 min-w-8 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
		? ROW_SELECTION_STYLES.cell
		: syncbuzzerEnabled
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	tabindex="-1"
	onmousedown={() => controller.beginDragSyncbuzzer(index)}
	onmouseover={() => controller.dragOverSyncbuzzer(index)}
	onfocus={() => controller.dragOverSyncbuzzer(index)}>
	{syncbuzzerEnabled ? '✓' : ''}
</td>
<td
	class="{isExpanded
		? 'w-8 min-w-8 px-1'
		: 'w-8 min-w-8 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
		? ROW_SELECTION_STYLES.cell
		: rowMode === 'manual'
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	title={rowMode === 'auto'
		? 'Auto: period = tone + detune. Click for manual.'
		: 'Manual: fixed period. Click for auto.'}
	tabindex="-1"
	onmousedown={() => controller.beginDragMode(index)}
	onmouseover={() => controller.dragOverMode(index)}
	onfocus={() => controller.dragOverMode(index)}>
	<div class="flex items-center justify-center">
		{#if rowMode === 'manual'}
			<IconCarbonEdit class={iconSizeClass} />
		{:else}
			<IconCarbonRenew class={iconSizeClass} />
		{/if}
	</div>
</td>
<td class={isExpanded ? 'w-16 min-w-16 px-1.5' : 'w-12 px-0.5'}>
	<input
		type="text"
		class={numericInputClass(rowMode === 'manual')}
		value={controller.formatSignedNum(rowDetune)}
		onfocus={(e) => (e.target as HTMLInputElement).select()}
		oninput={(e) => controller.updateRowDetune(index, (e.target as HTMLInputElement).value)} />
</td>
<td class={isExpanded ? 'w-16 min-w-16 px-1.5' : 'w-12 px-0.5'}>
	<input
		type="text"
		class={numericInputClass(rowMode === 'auto')}
		value={controller.formatNum(rowPeriod)}
		onfocus={(e) => (e.target as HTMLInputElement).select()}
		oninput={(e) => controller.updateRowPeriod(index, (e.target as HTMLInputElement).value)} />
</td>
