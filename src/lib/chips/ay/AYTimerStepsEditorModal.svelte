<script lang="ts">
	import IconCarbonClose from '~icons/carbon/close';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import Modal from '../../components/Modal/Modal.svelte';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import AYTimerStepsTextInput from './AYTimerStepsTextInput.svelte';
	import AYTimerWaveformEditor from './AYTimerWaveformEditor.svelte';
	import AYTimerWaveformLayerTabs from './AYTimerWaveformLayerTabs.svelte';

	let {
		rowIndex,
		onClose
	}: {
		rowIndex: number;
		onClose?: () => void;
	} = $props();

	const controller = getAyTimerEffectsContext();
	const hasLayers = $derived(controller.rowTimerWaveformEditLayers(rowIndex).length > 0);

	let textInput: AYTimerStepsTextInput | undefined = $state();

	function handleLayerChange(): void {
		textInput?.handleWaveformLayerChange();
	}
</script>

<Modal onClose={onClose}>
	<div class="flex w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden">
		<div
			class="flex items-start gap-3 border-b border-[var(--color-app-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-pattern-note)_12%,var(--color-app-surface-secondary)),var(--color-app-surface))] px-5 py-4">
			<div
				class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-pattern-note)]/20 bg-[var(--color-pattern-note)]/10 text-[var(--color-pattern-note)] shadow-sm">
				<IconCarbonWaveform class="h-5 w-5" />
			</div>
			<div class="min-w-0 flex-1 space-y-1">
				<div
					class="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-pattern-note)]">
					Timer waveform
				</div>
				<h2 class="text-base font-semibold leading-tight text-[var(--color-app-text-primary)]">
					Steps for row {rowIndex + 1}
				</h2>
				<p class="max-w-[34rem] text-[11px] leading-relaxed text-[var(--color-app-text-tertiary)]">
					Edit timer waveform steps for each active effect layer
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]"
				title="Close steps editor"
				aria-label="Close steps editor"
				onclick={() => onClose?.()}>
				<IconCarbonClose class="h-4 w-4" />
			</button>
		</div>

		<div class="flex flex-col gap-4 bg-[var(--color-app-surface)] p-5">
			{#if hasLayers}
				<section
					class="rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]/70 p-3 shadow-sm">
					<AYTimerWaveformLayerTabs
						rowIndex={rowIndex}
						isExpanded={true}
						variant="bar"
						onLayerChange={handleLayerChange} />
				</section>

				<AYTimerStepsTextInput bind:this={textInput} {rowIndex} />

				<section
					class="space-y-2 rounded-xl border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]/70 p-3 shadow-sm">
					<div class="flex items-center justify-between gap-3">
						<div>
							<div
								class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-app-text-tertiary)]">
								Draw steps
							</div>
							<div class="text-[11px] text-[var(--color-app-text-muted)]">
								Drag across the graph, then add or remove steps on the right
							</div>
						</div>
					</div>
			<AYTimerWaveformEditor
				{rowIndex}
				isExpanded={true}
				embedded={true}
				showLayerTabs={false} />
				</section>
			{:else}
				<div
					class="rounded-xl border border-dashed border-[var(--color-app-border-hover)] bg-[var(--color-app-surface-secondary)]/70 px-4 py-6 text-center">
					<p class="text-sm font-medium text-[var(--color-app-text-secondary)]">
						No editable timer layers
					</p>
					<p class="mt-1 text-[11px] text-[var(--color-app-text-muted)]">
						Enable SID, syncbuzzer, FM, or env FM on this row to edit steps.
					</p>
				</div>
			{/if}
		</div>
	</div>
</Modal>
