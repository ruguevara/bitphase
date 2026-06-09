<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonSettingsAdjust from '~icons/carbon/settings-adjust';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import { timerWaveformEditLayerTitle } from './instrument';

	let { rowIndex }: { rowIndex: number } = $props();

	const controller = getAyTimerEffectsContext();
	const inputId = $props.id();
	const iconSizeClass = 'h-4 w-4';

	const editLayer = $derived(controller.rowTimerWaveformEditLayer(rowIndex));
	const fmEnabled = $derived(controller.rowFmEnabled(rowIndex));
	const envfmEnabled = $derived(controller.rowEnvfmEnabled(rowIndex));
	const usesEnvelopeShapes = $derived(controller.rowTimerWaveformUsesEnvelopeShapes(rowIndex));
	const usesEnvFmOffsets = $derived(controller.rowTimerWaveformUsesEnvFmOffsets(rowIndex));
	const usesFmSemitones = $derived(controller.rowTimerWaveformUsesFmSemitones(rowIndex));
	const usesFmPeriodOffsets = $derived(controller.rowTimerWaveformUsesFmPeriodOffsets(rowIndex));
	const showFmOffsetToggle = $derived(
		(fmEnabled || envfmEnabled) && controller.rowTimerWaveformEditLayerUsesFmOffsetMode(rowIndex)
	);
	const waveformPlaceholder = $derived(
		usesEnvFmOffsets
			? '-1 1'
			: usesFmPeriodOffsets
				? '0 16 0 -16'
				: usesFmSemitones
					? '0 7'
					: usesEnvelopeShapes
						? '8'
						: '15 0'
	);
	const waveformTitle = $derived(
		usesEnvFmOffsets
			? 'Space-separated envelope value offsets added to pattern envelope (signed)'
			: usesFmPeriodOffsets
				? 'Space-separated raw tone period offsets added to base period (signed)'
				: usesFmSemitones
					? editLayer === 'envfm'
						? 'Space-separated semitone offsets applied to pattern envelope value'
						: 'Space-separated semitone offsets (signed)'
					: usesEnvelopeShapes
						? 'Space-separated envelope shapes (0–15 hex). Pattern envelope digit overrides when set.'
						: 'Space-separated SID steps (0–15)'
	);

	let waveformText = $state('');
	let waveformInputFocused = $state(false);

	$effect(() => {
		controller.rowTimerWaveformEditLayer(rowIndex);
		controller.rowTimerWaveform(rowIndex);
		if (!waveformInputFocused) {
			waveformText = controller.formatRowTimerWaveform(rowIndex);
		}
	});

	export function handleWaveformLayerChange(): void {
		if (waveformInputFocused) {
			commitWaveformText(waveformText);
			waveformInputFocused = false;
		}
		waveformText = controller.formatRowTimerWaveform(rowIndex);
	}

	function handleWaveformFocus(event: FocusEvent): void {
		waveformInputFocused = true;
		waveformText = controller.formatRowTimerWaveform(rowIndex);
		(event.target as HTMLInputElement).select();
	}

	function commitWaveformText(text: string): void {
		const parsed = controller.parseTimerWaveform(text, rowIndex);
		if (parsed !== null) {
			controller.setRowTimerWaveform(rowIndex, parsed);
		}
	}

	function handleWaveformBlur(): void {
		waveformInputFocused = false;
		commitWaveformText(waveformText);
		waveformText = controller.formatRowTimerWaveform(rowIndex);
	}

	function handleWaveformKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter') {
			return;
		}
		event.preventDefault();
		commitWaveformText(waveformText);
		waveformText = controller.formatRowTimerWaveform(rowIndex);
		(event.currentTarget as HTMLInputElement).blur();
	}

</script>

<div
	class="flex min-w-0 items-stretch overflow-hidden rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] focus-within:border-[var(--color-app-primary)]">
	<input
		id={inputId}
		type="text"
		class="min-w-0 flex-1 border-0 bg-transparent px-2 py-1 font-mono text-xs text-[var(--color-app-text-secondary)] placeholder-[var(--color-app-text-muted)] focus:outline-none"
		value={waveformText}
		placeholder={waveformPlaceholder}
		spellcheck="false"
		title={waveformTitle}
		aria-label={`${timerWaveformEditLayerTitle(editLayer)} steps`}
		onfocus={handleWaveformFocus}
		oninput={(event) => (waveformText = (event.currentTarget as HTMLInputElement).value)}
		onkeydown={handleWaveformKeydown}
		onblur={handleWaveformBlur} />
	{#if showFmOffsetToggle}
		<button
			type="button"
			class="flex shrink-0 cursor-pointer items-center justify-center border-l border-[var(--color-app-border)] px-1.5 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]"
			title={controller.rowFmOffsetMode(rowIndex) === 'period'
					? editLayer === 'envfm'
						? 'Envelope value offset mode. Click for semitones.'
						: 'Period offset mode. Click for semitones.'
					: editLayer === 'envfm'
						? 'Envelope semitone mode. Click for value offsets.'
						: 'Semitone mode. Click for period offsets.'}
				aria-label={controller.rowFmOffsetMode(rowIndex) === 'period'
					? editLayer === 'envfm'
						? 'Switch env FM to semitone mode'
						: 'Switch FM to semitone mode'
					: editLayer === 'envfm'
						? 'Switch env FM to value offset mode'
						: 'Switch FM to period offset mode'}
				onclick={() => controller.toggleFmOffsetMode(rowIndex)}>
				{#if controller.rowFmOffsetMode(rowIndex) === 'period'}
					<IconCarbonSettingsAdjust class={iconSizeClass} />
				{:else}
					<IconCarbonChartWinLoss class={iconSizeClass} />
				{/if}
			</button>
		{/if}
</div>
