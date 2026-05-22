<script lang="ts">
	import IconCarbonDownload from '~icons/carbon/download';
	import { onMount, onDestroy } from 'svelte';
	import { exportToWAV } from '../../services/file/wav-export';
	import { exportToPSG } from '../../services/file/psg-export';
	import { exportToTMR } from '../../services/file/tmr-export';
	import { exportToSNDH } from '../../services/file/sndh-export';
	import type { Project } from '../../models/project';
	import type { WavExportSettings } from '../../services/file/wav-export-settings';

	let {
		project,
		exportType = 'wav',
		wavSettings,
		resolve,
		dismiss
	} = $props<{
		project: Project;
		exportType?: 'wav' | 'psg' | 'sndh' | 'tmr';
		wavSettings?: WavExportSettings;
		resolve?: (value?: any) => void;
		dismiss?: (error?: any) => void;
	}>();

	let progress = $state(0);
	let message = $state('Starting export...');
	const abortController = $state(new AbortController());

	const progressPercent = $derived(Math.min(100, Math.max(0, progress)));
	const exportLabel = $derived(exportType.toUpperCase());

	onDestroy(() => {
		abortController.abort();
	});

	onMount(async () => {
		const startTime = Date.now();

		try {
			if (exportType === 'psg') {
				await exportToPSG(
					project,
					0,
					(progressValue, messageValue) => {
						progress = progressValue;
						message = messageValue;
					},
					abortController.signal
				);
			} else if (exportType === 'tmr') {
				await exportToTMR(
					project,
					0,
					(progressValue, messageValue) => {
						progress = progressValue;
						message = messageValue;
					},
					abortController.signal
				);
			} else if (exportType === 'sndh') {
				await exportToSNDH(
					project,
					0,
					(progressValue, messageValue) => {
						progress = progressValue;
						message = messageValue;
					},
					abortController.signal
				);
			} else {
				await exportToWAV(
					project,
					wavSettings,
					(progressValue, messageValue) => {
						progress = progressValue;
						message = messageValue;
					},
					abortController.signal
				);
			}

			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, 1000 - elapsed);
			await new Promise((resolve) => setTimeout(resolve, remaining));
			message = 'Export completed!';
			await new Promise((resolve) => setTimeout(resolve, 500));
			resolve?.();
		} catch (error) {
			if (error instanceof Error && error.message === 'Export cancelled') {
				message = 'Export cancelled';
			} else {
				message = `Error: ${error instanceof Error ? error.message : 'Export failed'}`;
			}
			const elapsed = Date.now() - startTime;
			const remaining = Math.max(0, 2000 - elapsed);
			await new Promise((resolve) => setTimeout(resolve, remaining));
			dismiss?.(error);
		}
	});
</script>

<div class="flex items-center gap-2 border-b border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1">
	<h2 id="progress-modal-title" class="text-xs font-bold text-[var(--color-app-text-primary)]">
		Exporting {exportLabel}
	</h2>
	<IconCarbonDownload class="h-3 w-3 text-[var(--color-app-primary)]" />
</div>

<div class="p-3">
	{#if message}
		<p class="mb-3 text-xs text-[var(--color-app-text-muted)]">{message}</p>
	{/if}

	<div class="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-app-surface-secondary)]">
		<div
			class="h-full bg-[var(--color-app-primary)] transition-all duration-300 ease-out"
			style="width: {progressPercent}%">
			<div
				class="absolute inset-0 bg-[var(--color-app-primary)] opacity-30"
				style="width: 100%; animation: shimmer 1.5s ease-in-out infinite;">
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes shimmer {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
