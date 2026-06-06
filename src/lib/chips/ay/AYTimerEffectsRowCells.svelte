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
	const usesEnvelopeShapes = $derived(controller.rowTimerWaveformUsesEnvelopeShapes(index));
	const waveformPlaceholder = $derived(usesEnvelopeShapes ? 'D 9' : '15 0');
	const waveformTitle = $derived(
		usesEnvelopeShapes
			? 'Space-separated envelope shapes (0–15 hex). Pattern envelope digit overrides when set.'
			: 'Space-separated SID steps (0–15)'
	);
	const waveformEditorTitle = $derived(
		usesEnvelopeShapes ? 'Open envelope shapes editor' : 'Open SID steps editor'
	);
	const rowMode = $derived(controller.rowSidPeriodMode(index));
	const rowToneDetune = $derived(controller.rowToneDetune(index));
	const rowDetune = $derived(controller.rowDetune(index));
	const rowPeriod = $derived(controller.rowPeriod(index));
	const waveformEditorOpen = $derived(controller.waveformEditorRowIndex === index);

	let waveformText = $state('');
	let waveformInputFocused = $state(false);

	$effect(() => {
		controller.rowTimerWaveform(index);
		if (!waveformInputFocused) {
			waveformText = controller.formatRowTimerWaveform(index);
		}
	});

	function numericInputClass(inactive = false): string {
		return `w-full min-w-0 overflow-x-auto rounded border border-[var(--color-app-border)] ${
			selected ? ROW_SELECTION_STYLES.input : 'bg-[var(--color-app-surface)]'
		} ${isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]'} ${
			inactive
				? 'text-[var(--color-app-text-tertiary)] opacity-60'
				: 'text-[var(--color-app-text-secondary)]'
		} placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}

	function handleWaveformFocus(event: FocusEvent): void {
		waveformInputFocused = true;
		waveformText = controller.formatRowTimerWaveform(index);
		(event.target as HTMLInputElement).select();
	}

	function handleWaveformBlur(): void {
		waveformInputFocused = false;
		const parsed = controller.parseTimerWaveform(waveformText);
		if (parsed !== null) {
			controller.setRowTimerWaveform(index, parsed);
		}
		waveformText = controller.formatRowTimerWaveform(index);
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
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
	<input
		type="text"
		class={numericInputClass(rowMode === 'manual')}
		value={controller.formatSignedNum(rowToneDetune)}
		onfocus={(e) => (e.target as HTMLInputElement).select()}
		oninput={(e) => controller.updateRowToneDetune(index, (e.target as HTMLInputElement).value)} />
</td>
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
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
<td class={isExpanded ? 'min-w-32 px-1.5' : 'min-w-24 px-0.5'}>
	<div class="flex items-center gap-1">
		<input
			type="text"
			class="{numericInputClass()} min-w-0 flex-1"
			value={waveformInputFocused ? waveformText : controller.formatRowTimerWaveform(index)}
			placeholder={waveformPlaceholder}
			spellcheck="false"
			title={waveformTitle}
			onfocus={handleWaveformFocus}
			oninput={(event) => (waveformText = (event.currentTarget as HTMLInputElement).value)}
			onblur={handleWaveformBlur} />
		<button
			type="button"
			class="flex shrink-0 items-center justify-center rounded p-0.5 transition-colors {waveformEditorOpen
				? 'bg-[var(--color-pattern-note)]/15 text-[var(--color-pattern-note)]'
				: 'cursor-pointer text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-pattern-note)]'}"
			title={waveformEditorTitle}
			aria-label={waveformEditorTitle}
			onclick={() => controller.openWaveformEditor(index)}>
			<IconCarbonEdit class={iconSizeClass} />
		</button>
	</div>
</td>
