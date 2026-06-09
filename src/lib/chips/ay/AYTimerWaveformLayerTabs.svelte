<script lang="ts">
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import {
		AY_TIMER_WAVEFORM_EDIT_LAYER_LABELS,
		timerWaveformEditLayerTitle,
		type AyTimerWaveformEditLayer
	} from './instrument';

	let {
		rowIndex,
		isExpanded = false,
		variant = 'inline',
		onLayerChange
	}: {
		rowIndex: number;
		isExpanded?: boolean;
		variant?: 'inline' | 'bar';
		onLayerChange?: (layer: AyTimerWaveformEditLayer) => void;
	} = $props();

	const controller = getAyTimerEffectsContext();
	const layers = $derived(controller.rowTimerWaveformEditLayers(rowIndex));
	const activeLayer = $derived(controller.rowTimerWaveformEditLayer(rowIndex));
	const showTabs = $derived(layers.length > 0);
	const multipleLayers = $derived(layers.length > 1);

	function tabClass(layer: AyTimerWaveformEditLayer): string {
		const isActive = layer === activeLayer;
		if (variant === 'inline') {
			const base = isExpanded
				? 'min-w-[2.1rem] px-1.5 text-[0.62rem] font-semibold tracking-wide uppercase'
				: 'min-w-[1.85rem] px-1 text-[0.58rem] font-semibold tracking-wide uppercase';
			if (isActive) {
				return `${base} bg-[color-mix(in_srgb,var(--color-app-primary)_14%,var(--color-app-surface))] text-[var(--color-app-primary)]`;
			}
			return `${base} text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]`;
		}
		const base = isExpanded
			? 'flex-1 px-2.5 py-1 text-[0.68rem] font-semibold tracking-wide uppercase'
			: 'flex-1 px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide uppercase';
		if (isActive) {
			return `${base} bg-[var(--color-app-primary)] text-white shadow-sm`;
		}
		return `${base} text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]`;
	}

	function selectLayer(layer: AyTimerWaveformEditLayer): void {
		if (layer === activeLayer) {
			return;
		}
		onLayerChange?.(layer);
		controller.setRowTimerWaveformEditLayer(rowIndex, layer);
	}
</script>

{#if showTabs}
	<div
		class={variant === 'inline'
			? 'flex h-full shrink-0 items-stretch border-r border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]/60'
			: 'flex w-full min-w-0 overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] p-0.5 shadow-sm'}
		role="tablist"
		aria-label="Steps waveform layer">
		{#each layers as layer, layerIndex (layer)}
			<button
				type="button"
				role="tab"
				class="{tabClass(layer)} flex h-full cursor-pointer items-center justify-center transition-colors {variant ===
					'inline' && layerIndex < layers.length - 1
					? 'border-r border-[var(--color-app-border)]/80'
					: ''} {variant === 'inline' && !multipleLayers ? 'cursor-default' : ''}"
				title={timerWaveformEditLayerTitle(layer)}
				aria-label={timerWaveformEditLayerTitle(layer)}
				aria-selected={layer === activeLayer}
				tabindex={layer === activeLayer ? 0 : -1}
				onclick={() => selectLayer(layer)}>
				{AY_TIMER_WAVEFORM_EDIT_LAYER_LABELS[layer]}
			</button>
		{/each}
	</div>
{/if}
