<script lang="ts">
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
	const fmEnabled = $derived(controller.rowFmEnabled(index));
	const envFmEnabled = $derived(controller.rowEnvFmEnabled(index));
	const activeEffectCount = $derived(controller.activeEffectCount(index));
	const waveformEditorOpen = $derived(controller.waveformEditorRowIndex === index);

	let toneDetuneText = $state('');
	let toneDetuneFocused = $state(false);
	let detuneText = $state('');
	let detuneFocused = $state(false);

	const rowToneDetune = $derived(controller.rowToneDetune(index));
	const rowDetune = $derived(controller.rowDetune(index));

	$effect(() => {
		controller.rowToneDetune(index);
		if (!toneDetuneFocused) {
			toneDetuneText = controller.formatSignedNum(rowToneDetune);
		}
	});

	$effect(() => {
		controller.rowDetune(index);
		if (!detuneFocused) {
			detuneText = controller.formatSignedNum(rowDetune);
		}
	});

	function numericInputClass(): string {
		return `w-full min-w-0 overflow-x-auto rounded border border-[var(--color-app-border)] ${
			selected ? ROW_SELECTION_STYLES.input : 'bg-[var(--color-app-surface)]'
		} ${isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]'} text-[var(--color-app-text-secondary)] placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}

	function handleToneDetuneFocus(event: FocusEvent): void {
		toneDetuneFocused = true;
		toneDetuneText = controller.formatSignedNum(rowToneDetune);
		(event.target as HTMLInputElement).select();
	}

	function handleToneDetuneInput(value: string): void {
		toneDetuneText = value;
		controller.updateRowToneDetune(index, value);
	}

	function handleToneDetuneBlur(): void {
		toneDetuneFocused = false;
		controller.updateRowToneDetune(index, toneDetuneText);
		toneDetuneText = controller.formatSignedNum(controller.rowToneDetune(index));
	}

	function handleDetuneFocus(event: FocusEvent): void {
		detuneFocused = true;
		detuneText = controller.formatSignedNum(rowDetune);
		(event.target as HTMLInputElement).select();
	}

	function handleDetuneInput(value: string): void {
		detuneText = value;
		controller.updateRowDetune(index, value);
	}

	function handleDetuneBlur(): void {
		detuneFocused = false;
		controller.updateRowDetune(index, detuneText);
		detuneText = controller.formatSignedNum(controller.rowDetune(index));
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
		: fmEnabled
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	tabindex="-1"
	onmousedown={() => controller.beginDragFm(index)}
	onmouseover={() => controller.dragOverFm(index)}
	onfocus={() => controller.dragOverFm(index)}>
	{fmEnabled ? '✓' : ''}
</td>
<td
	class="{isExpanded
		? 'w-8 min-w-8 px-1'
		: 'w-8 min-w-8 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
		? ROW_SELECTION_STYLES.cell
		: envFmEnabled
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	tabindex="-1"
	onmousedown={() => controller.beginDragEnvFm(index)}
	onmouseover={() => controller.dragOverEnvFm(index)}
	onfocus={() => controller.dragOverEnvFm(index)}>
	{envFmEnabled ? '✓' : ''}
</td>
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
	<input
		type="text"
		class={numericInputClass()}
		value={toneDetuneFocused ? toneDetuneText : controller.formatSignedNum(rowToneDetune)}
		onfocus={handleToneDetuneFocus}
		oninput={(e) => handleToneDetuneInput((e.target as HTMLInputElement).value)}
		onblur={handleToneDetuneBlur} />
</td>
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
	<input
		type="text"
		class={numericInputClass()}
		value={detuneFocused ? detuneText : controller.formatSignedNum(rowDetune)}
		onfocus={handleDetuneFocus}
		oninput={(e) => handleDetuneInput((e.target as HTMLInputElement).value)}
		onblur={handleDetuneBlur} />
</td>
<td class="timer-edit-column {isExpanded ? 'w-16 min-w-16 px-1.5' : 'w-12 min-w-12 px-0.5'}">
	<button
		type="button"
		class="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md border border-[var(--color-app-border)] px-1 py-0.5 transition-colors {waveformEditorOpen
			? 'border-[var(--color-pattern-note)]/40 bg-[var(--color-pattern-note)]/10 text-[var(--color-pattern-note)]'
			: activeEffectCount > 0
				? selected
					? ROW_SELECTION_STYLES.input + ' text-[var(--color-pattern-note)]'
					: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-secondary)] hover:border-[var(--color-pattern-note)]/30 hover:bg-[var(--color-pattern-note)]/5 hover:text-[var(--color-pattern-note)]'
				: 'cursor-not-allowed bg-[var(--color-app-surface)] text-[var(--color-app-text-tertiary)] opacity-60'}"
		disabled={activeEffectCount === 0}
		title={activeEffectCount > 0
			? 'Edit timer effect waveforms'
			: 'Enable at least one timer effect to edit steps'}
		aria-label="Edit timer effect waveforms"
		onclick={() => controller.openWaveformEditor(index)}>
		<IconCarbonEdit class={iconSizeClass} />
		{#if activeEffectCount > 0}
			<span class={isExpanded ? 'text-[10px]' : 'text-[0.6rem]'}>{activeEffectCount}</span>
		{/if}
	</button>
</td>
