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
	const usesEnvelopeShapes = $derived(controller.rowTimerWaveformUsesEnvelopeShapes(index));
	const usesFmSemitones = $derived(controller.rowTimerWaveformUsesFmSemitones(index));
	const waveformPlaceholder = $derived(
		usesFmSemitones
			? '0 7'
			: usesEnvelopeShapes
				? '8'
				: '15 0'
	);
	const waveformTitle = $derived(
		usesFmSemitones
			? 'Space-separated semitone offsets (signed, no 0–15 limit)'
			: usesEnvelopeShapes
				? 'Space-separated envelope shapes (0–15 hex). Pattern envelope digit overrides when set.'
				: 'Space-separated SID steps (0–15)'
	);
	const waveformEditorTitle = $derived(
		usesFmSemitones
			? 'Open FM semitone editor'
			: usesEnvelopeShapes
				? 'Open envelope shapes editor'
				: 'Open SID steps editor'
	);
	const rowToneDetune = $derived(controller.rowToneDetune(index));
	const rowDetune = $derived(controller.rowDetune(index));
	const waveformEditorOpen = $derived(controller.waveformEditorRowIndex === index);

	let waveformText = $state('');
	let waveformInputFocused = $state(false);

	$effect(() => {
		controller.rowTimerWaveform(index);
		if (!waveformInputFocused) {
			waveformText = controller.formatRowTimerWaveform(index);
		}
	});

	function numericInputClass(): string {
		return `w-full min-w-0 overflow-x-auto rounded border border-[var(--color-app-border)] ${
			selected ? ROW_SELECTION_STYLES.input : 'bg-[var(--color-app-surface)]'
		} ${isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]'} text-[var(--color-app-text-secondary)] placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}

	function handleWaveformFocus(event: FocusEvent): void {
		waveformInputFocused = true;
		waveformText = controller.formatRowTimerWaveform(index);
		(event.target as HTMLInputElement).select();
	}

	function handleWaveformBlur(): void {
		waveformInputFocused = false;
		const parsed = controller.parseTimerWaveform(waveformText, index);
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
		: fmEnabled
			? 'instrument-cell-boolean-on'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
	tabindex="-1"
	onmousedown={() => controller.beginDragFm(index)}
	onmouseover={() => controller.dragOverFm(index)}
	onfocus={() => controller.dragOverFm(index)}>
	{fmEnabled ? '✓' : ''}
</td>
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
	<input
		type="text"
		class={numericInputClass()}
		value={controller.formatSignedNum(rowToneDetune)}
		onfocus={(e) => (e.target as HTMLInputElement).select()}
		oninput={(e) => controller.updateRowToneDetune(index, (e.target as HTMLInputElement).value)} />
</td>
<td class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5'}>
	<input
		type="text"
		class={numericInputClass()}
		value={controller.formatSignedNum(rowDetune)}
		onfocus={(e) => (e.target as HTMLInputElement).select()}
		oninput={(e) => controller.updateRowDetune(index, (e.target as HTMLInputElement).value)} />
</td>
<td class="timer-steps-column {isExpanded ? 'min-w-32 px-1.5' : 'min-w-24 px-0.5'}">
	<div class="flex w-full min-w-0 items-center gap-1">
		<input
			type="text"
			class="{numericInputClass()} box-border w-full min-w-0 flex-1"
			value={waveformText}
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
