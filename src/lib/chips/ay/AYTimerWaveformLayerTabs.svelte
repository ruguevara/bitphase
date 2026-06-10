<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import type { AyTimerEffectType } from './instrument';

	let {
		activeTab,
		sidEnabled = false,
		syncbuzzerEnabled = false,
		fmEnabled = false,
		envFmEnabled = false,
		compact = false,
		onchange
	}: {
		activeTab: AyTimerEffectType;
		sidEnabled?: boolean;
		syncbuzzerEnabled?: boolean;
		fmEnabled?: boolean;
		envFmEnabled?: boolean;
		compact?: boolean;
		onchange: (tab: AyTimerEffectType) => void;
	} = $props();

	const tabs: {
		id: AyTimerEffectType;
		label: string;
		shortLabel: string;
		enabled: boolean;
	}[] = $derived([
		{ id: 'sid', label: 'SID', shortLabel: 'SID', enabled: sidEnabled },
		{
			id: 'syncbuzzer',
			label: 'Syncbuzzer',
			shortLabel: 'Sync',
			enabled: syncbuzzerEnabled
		},
		{ id: 'fm', label: 'FM', shortLabel: 'FM', enabled: fmEnabled },
		{ id: 'envFm', label: 'Env FM', shortLabel: 'E+', enabled: envFmEnabled }
	]);

	const iconClass = $derived(compact ? 'h-3 w-3' : 'h-3.5 w-3.5');
</script>

<div
	class="flex flex-wrap items-center gap-0.5 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] p-0.5"
	role="tablist"
	aria-label="Timer effect waveform layers">
	{#each tabs as tab (tab.id)}
		<button
			type="button"
			role="tab"
			aria-selected={activeTab === tab.id}
			class="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors {compact
				? 'text-[0.65rem]'
				: 'text-xs'} {activeTab === tab.id
				? 'bg-[var(--color-app-surface)] text-[var(--color-pattern-note)] shadow-sm'
				: tab.enabled
					? 'text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]'
					: 'text-[var(--color-app-text-tertiary)] hover:bg-[var(--color-app-surface-hover)]'}"
			title={tab.enabled ? `Edit ${tab.label} steps` : `${tab.label} (not enabled on this row)`}
			onclick={() => onchange(tab.id)}>
			{#if tab.id === 'sid'}
				<IconCarbonChartWinLoss class={iconClass} />
			{:else if tab.id === 'syncbuzzer'}
				<IconCarbonActivity class={iconClass} />
			{:else}
				<IconCarbonWaveform class={iconClass} />
			{/if}
			<span class="font-medium">{compact ? tab.shortLabel : tab.label}</span>
			{#if tab.enabled}
				<span
					class="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-pattern-note)]"
					aria-hidden="true"></span>
			{/if}
		</button>
	{/each}
</div>
