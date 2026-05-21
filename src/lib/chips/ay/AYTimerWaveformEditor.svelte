<script lang="ts">
	import IconCarbonAdd from '~icons/carbon/add';
	import IconCarbonTrashCan from '~icons/carbon/trash-can';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
</script>

<div class="mt-3 ml-2">
	<div
		class="mb-1.5 flex items-center gap-1 text-xs text-[var(--color-app-text-muted)]"
		title="Waveform">
		<IconCarbonWaveform class={iconSizeClass} />
	</div>
	<div class="flex flex-wrap items-center gap-2">
		{#each controller.fields.timerWaveform as value, index}
			<div class="flex items-center gap-1">
				<input
					type="text"
					class="w-10 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1 py-0.5 text-center font-mono text-xs text-[var(--color-app-text-secondary)] focus:border-[var(--color-app-primary)] focus:outline-none"
					value={controller.formatNum(value)}
					onfocus={(e) => (e.target as HTMLInputElement).select()}
					oninput={(e) =>
						controller.updateWaveformValue(index, (e.target as HTMLInputElement).value)} />
				{#if controller.fields.timerWaveform.length > 1}
					<button
						class="flex cursor-pointer items-center justify-center rounded p-0.5 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-pattern-note-off)]"
						onclick={() => controller.removeWaveformStep(index)}
						title="Remove waveform step">
						<IconCarbonTrashCan class="h-3 w-3" />
					</button>
				{/if}
			</div>
		{/each}
		{#if controller.fields.timerWaveform.length < 32}
			<button
				class="flex cursor-pointer items-center justify-center rounded border border-[var(--color-app-border)] p-1 text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)]"
				onclick={() => controller.addWaveformStep()}
				title="Add waveform step">
				<IconCarbonAdd class={iconSizeClass} />
			</button>
		{/if}
	</div>
</div>
