<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonEdit from '~icons/carbon/edit';
	import IconCarbonSettingsAdjust from '~icons/carbon/settings-adjust';
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
	const usesFmWaveform = $derived(controller.rowUsesFmWaveform(index));
	const usesEnvelopeShapes = $derived(controller.rowTimerWaveformUsesEnvelopeShapes(index));
	const usesFmSemitones = $derived(controller.rowTimerWaveformUsesFmSemitones(index));
	const usesFmPeriodOffsets = $derived(controller.rowTimerWaveformUsesFmPeriodOffsets(index));
	const waveformPlaceholder = $derived(
		usesFmPeriodOffsets
			? '0 16 0 -16'
			: usesFmSemitones
				? '0 7'
				: usesEnvelopeShapes
					? '8'
					: '15 0'
	);
	const waveformTitle = $derived(
		usesFmPeriodOffsets
			? envFmEnabled
				? 'Space-separated raw period offsets added to the pattern envelope value (signed)'
				: 'Space-separated raw tone period offsets added to base period (signed)'
			: usesFmSemitones
				? envFmEnabled
					? 'Space-separated semitone offsets from the pattern envelope value (signed, 0 = unchanged)'
					: 'Space-separated semitone offsets (signed)'
				: usesEnvelopeShapes
					? 'Space-separated envelope shapes (0–15 hex). Pattern envelope digit overrides when set.'
					: 'Space-separated SID steps (0–15)'
	);
	const waveformEditorTitle = $derived(
		usesFmPeriodOffsets
			? 'Open FM period offset editor'
			: usesFmSemitones
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
	let toneDetuneText = $state('');
	let toneDetuneFocused = $state(false);
	let detuneText = $state('');
	let detuneFocused = $state(false);

	$effect(() => {
		controller.rowTimerWaveform(index);
		if (!waveformInputFocused) {
			waveformText = controller.formatRowTimerWaveform(index);
		}
	});

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

	function handleWaveformFocus(event: FocusEvent): void {
		waveformInputFocused = true;
		waveformText = controller.formatRowTimerWaveform(index);
		(event.target as HTMLInputElement).select();
	}

	function commitWaveformText(text: string): void {
		const parsed = controller.parseTimerWaveform(text, index);
		if (parsed !== null) {
			controller.setRowTimerWaveform(index, parsed);
		}
	}

	function handleWaveformBlur(): void {
		waveformInputFocused = false;
		commitWaveformText(waveformText);
		waveformText = controller.formatRowTimerWaveform(index);
	}

	function handleWaveformKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter') {
			return;
		}
		event.preventDefault();
		commitWaveformText(waveformText);
		waveformText = controller.formatRowTimerWaveform(index);
		(event.currentTarget as HTMLInputElement).blur();
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
		? 'w-9 min-w-9 px-1'
		: 'w-9 min-w-9 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
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
<td class="timer-steps-column {isExpanded ? 'min-w-32 px-1.5' : 'min-w-24 px-0.5'}">
	<div class="flex w-full min-w-0 items-center gap-1">
		{#if usesFmWaveform}
			<button
				type="button"
				class="flex shrink-0 cursor-pointer items-center justify-center rounded border border-[var(--color-app-border)] p-0.5 transition-colors {selected
					? ROW_SELECTION_STYLES.input
					: 'bg-[var(--color-app-surface)]'} text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]"
				title={controller.rowFmOffsetMode(index) === 'period'
					? 'Period offset mode. Click for semitones.'
					: 'Semitone mode. Click for period offsets.'}
				aria-label={controller.rowFmOffsetMode(index) === 'period'
					? 'Switch FM to semitone mode'
					: 'Switch FM to period offset mode'}
				onclick={() => controller.toggleFmOffsetMode(index)}>
				{#if controller.rowFmOffsetMode(index) === 'period'}
					<IconCarbonSettingsAdjust class={iconSizeClass} />
				{:else}
					<IconCarbonChartWinLoss class={iconSizeClass} />
				{/if}
			</button>
		{/if}
		<input
			type="text"
			class="{numericInputClass()} box-border w-full min-w-0 flex-1"
			value={waveformText}
			placeholder={waveformPlaceholder}
			spellcheck="false"
			title={waveformTitle}
			onfocus={handleWaveformFocus}
			oninput={(event) => (waveformText = (event.currentTarget as HTMLInputElement).value)}
			onkeydown={handleWaveformKeydown}
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
