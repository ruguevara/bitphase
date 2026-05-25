<script lang="ts">
	import type { Component } from 'svelte';
	import type { ChipProcessor } from '../../chips/base/processor';
	import { formatToneFrequencyHz } from '../../chips/ay/tone-frequency';
	import {
		AY_REGISTER_COUNT,
		DEFAULT_AY_REGISTERS
	} from '../../services/file/ay-export-utils';
	import { AY_REGISTER_NAMES, formatTimerFrequencyHz } from '../../services/file/tmr-parser';
	import { playbackToneDebugStore } from '../../stores/playback-tone-debug.svelte';
	import { projectStore } from '../../stores/project.svelte';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonMusic from '~icons/carbon/music';

	let { chipProcessors }: { chipProcessors: ChipProcessor[] } = $props();

	type ChannelColumn = {
		label: string;
		toneHz: number | null;
		sidHz: number | null;
		syncHz: number | null;
	};

	type MetricRow = {
		key: string;
		label: string;
		accentClass: string;
		icon: Component<{ class?: string }>;
		readHz: (column: ChannelColumn) => number | null;
		formatHz: (hz: number | null) => string;
	};

	type ChipRegisterRow = {
		chipLabel: string | null;
		registers: readonly number[];
	};

	const metrics: MetricRow[] = [
		{
			key: 'tone',
			label: 'Tone',
			icon: IconCarbonMusic,
			accentClass: 'text-[var(--color-pattern-note)]',
			readHz: (column) => column.toneHz,
			formatHz: formatToneFrequencyHz
		},
		{
			key: 'sid',
			label: 'SID',
			icon: IconCarbonChartWinLoss,
			accentClass: 'text-[var(--color-pattern-instrument)]',
			readHz: (column) => column.sidHz,
			formatHz: (hz) => (hz === null || hz <= 0 ? '—' : formatTimerFrequencyHz(hz))
		},
		{
			key: 'sync',
			label: 'Syncbuzzer',
			icon: IconCarbonActivity,
			accentClass: 'text-[var(--color-pattern-envelope)]',
			readHz: (column) => column.syncHz,
			formatHz: (hz) => (hz === null || hz <= 0 ? '—' : formatTimerFrequencyHz(hz))
		}
	];

	const columns = $derived.by((): ChannelColumn[] => {
		const multiSong = projectStore.songs.length > 1;
		const result: ChannelColumn[] = [];

		chipProcessors.forEach((_processor, chipIndex) => {
			const song = projectStore.songs[chipIndex];
			if (!song) return;

			const labels = song.getEffectiveChannelLabels();
			const playbackHz = playbackToneDebugStore.allChipPlaybackHz[chipIndex];
			const count = Math.max(
				labels.length,
				playbackHz?.toneHz.length ?? 0,
				playbackHz?.sidTimerHz.length ?? 0,
				playbackHz?.syncbuzzerTimerHz.length ?? 0
			);

			for (let channelIndex = 0; channelIndex < count; channelIndex++) {
				const baseLabel = labels[channelIndex] ?? String(channelIndex + 1);
				result.push({
					label: multiSong ? `${chipIndex + 1}${baseLabel}` : baseLabel,
					toneHz: playbackHz?.toneHz[channelIndex] ?? null,
					sidHz: playbackHz?.sidTimerHz[channelIndex] ?? null,
					syncHz: playbackHz?.syncbuzzerTimerHz[channelIndex] ?? null
				});
			}
		});

		return result;
	});

	const chipRegisterRows = $derived.by((): ChipRegisterRow[] => {
		const multiSong = projectStore.songs.length > 1;

		return chipProcessors.map((_processor, chipIndex) => {
			const stored = playbackToneDebugStore.allChipPlaybackHz[chipIndex]?.registers;
			const registers =
				stored?.length === AY_REGISTER_COUNT ? stored : DEFAULT_AY_REGISTERS;

			return {
				chipLabel: multiSong ? `${chipIndex + 1}` : null,
				registers
			};
		});
	});

	function hzCellClass(hz: number | null, accentClass: string): string {
		if (hz === null || hz <= 0) {
			return 'text-[var(--color-app-text-muted)]/35';
		}
		return `tabular-nums ${accentClass}`;
	}

	function formatRegisterByte(value: number): string {
		return (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
	}
</script>

{#if chipProcessors.length > 0}
	<div class="shrink-0 px-2 pb-1 pt-0.5">
		<div
			class="overflow-hidden rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]">
			<div class="overflow-x-auto px-1.5 py-1 font-sans text-[11px] leading-tight">
				{#if columns.length > 0}
					<div
						class="grid min-w-max gap-x-0.5 gap-y-0"
						style="grid-template-columns: 6.25rem repeat({columns.length}, minmax(3.25rem, 1fr));">
						<div></div>
						{#each columns as column (column.label)}
							<div
								class="truncate px-0.5 text-center font-semibold text-[var(--color-pattern-note)]">
								{column.label}
							</div>
						{/each}

						{#each metrics as metric (metric.key)}
							<div class="flex items-center gap-0.5 px-0.5 text-[var(--color-app-text-muted)]">
								<metric.icon class="h-3 w-3 shrink-0 {metric.accentClass}" />
								<span class="whitespace-nowrap">{metric.label}</span>
							</div>
							{#each columns as column (metric.key + column.label)}
								{@const hz = metric.readHz(column)}
								<div class="px-0.5 text-center {hzCellClass(hz, metric.accentClass)}">
									{metric.formatHz(hz)}
								</div>
							{/each}
						{/each}
					</div>
				{/if}

				{#each chipRegisterRows as row, rowIndex (row.chipLabel ?? rowIndex)}
					<div
						class="min-w-max {columns.length > 0 || rowIndex > 0
							? 'mt-1 border-t border-[var(--color-app-border)]/60 pt-1'
							: ''}">
						<div
							class="grid gap-x-0.5 gap-y-0"
							style="grid-template-columns: {row.chipLabel ? '1.25rem ' : ''}repeat({AY_REGISTER_COUNT}, minmax(1.625rem, 1fr));">
							{#if row.chipLabel}
								<div class="row-span-2 self-center px-0.5 text-[var(--color-app-text-muted)]">
									{row.chipLabel}
								</div>
							{/if}
							{#each Array.from({ length: AY_REGISTER_COUNT }, (_, regIndex) => regIndex) as regIndex (regIndex)}
								<div
									class="px-0.5 text-center text-[var(--color-app-text-muted)]"
									title={AY_REGISTER_NAMES[regIndex]}>
									{regIndex}
								</div>
							{/each}
							{#each Array.from({ length: AY_REGISTER_COUNT }, (_, regIndex) => regIndex) as regIndex (regIndex + 'v')}
								<div
									class="px-0.5 text-center tabular-nums text-[var(--color-pattern-effect)]"
									title={AY_REGISTER_NAMES[regIndex]}>
									{formatRegisterByte(row.registers[regIndex] ?? 0)}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
