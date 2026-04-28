<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import IconCarbonRedo from '~icons/carbon/redo';
	import IconCarbonUndo from '~icons/carbon/undo';
	import { historyFeedbackStore } from '../../stores/history-feedback.svelte';

	const toasts = $derived([...historyFeedbackStore.toasts].reverse());
</script>

{#if toasts.length > 0}
	<div class="toast-stack group pointer-events-auto fixed right-4 bottom-4 z-50 h-72 w-80">
		{#each toasts as toast, index (toast.id)}
			<div
				class="toast-card absolute right-0 bottom-0 w-full overflow-hidden rounded-lg border border-[var(--color-app-border)] bg-[color-mix(in_srgb,var(--color-app-surface)_94%,transparent)] text-xs text-[var(--color-app-text-secondary)] shadow-2xl shadow-black/30 backdrop-blur"
				style:--stack-offset={index * 7}
				style:--expanded-offset={index * 74}
				style:--toast-scale={1 - Math.min(index, 3) * 0.035}
				style:z-index={toasts.length - index}
				in:fly={{ x: 28, duration: 180 }}
				out:scale={{ start: 0.96, duration: 120 }}>
				<div
					class="h-0.5 {toast.kind === 'undo'
						? 'bg-[var(--color-app-primary)]'
						: 'bg-[var(--color-app-secondary)]'}">
				</div>
				<div class="flex items-start gap-3 px-3 py-2.5">
					<div
						class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full {toast.kind ===
						'undo'
							? 'bg-[var(--color-app-primary)]/20 text-[var(--color-app-primary)]'
							: 'bg-[var(--color-app-secondary)]/20 text-[var(--color-app-secondary)]'}">
						{#if toast.kind === 'undo'}
							<IconCarbonUndo class="h-3.5 w-3.5" />
						{:else}
							<IconCarbonRedo class="h-3.5 w-3.5" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="font-semibold text-[var(--color-app-text-primary)]">
							{toast.kind === 'undo' ? 'Undo applied' : 'Redo applied'}
						</div>
						<div class="mt-0.5 truncate text-[var(--color-app-text-tertiary)]">
							{toast.message}
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-card {
		opacity: calc(1 - min(var(--stack-offset), 21) / 56);
		transform: translateY(calc(var(--stack-offset) * -1px)) scale(var(--toast-scale));
		transform-origin: bottom right;
		transition:
			transform 180ms ease,
			opacity 180ms ease;
	}

	.toast-stack:hover .toast-card {
		opacity: 1;
		transform: translateY(calc(var(--expanded-offset) * -1px)) scale(1);
	}
</style>
