<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonSettingsAdjust from '~icons/carbon/settings-adjust';
	import IconCarbonCharacterWholeNumber from '~icons/carbon/character-whole-number';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
</script>

<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="SID effect (tone × volume with adjustable pulse width). Mutually exclusive with syncbuzzer.">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>×</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="Syncbuzzer (rapid envelope shape retrigger). Mutually exclusive with SID.">
	<div class="flex items-center justify-center">
		<IconCarbonActivity class={iconSizeClass} />
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="Auto or manual timer period">
	<div class="flex items-center justify-center">
		<IconCarbonSettingsAdjust class={iconSizeClass} />
	</div>
</th>
<th
	class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5 text-[0.65rem]'}
	title="Detune (semitone) added to tone period (auto mode)">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5 text-[0.65rem]'}
	title="Detune added to tone period (auto mode)">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-16 min-w-16 px-1.5' : 'w-12 px-0.5 text-[0.65rem]'}
	title="Timer period (manual mode)">
	<div class="flex items-center justify-center">
		<IconCarbonCharacterWholeNumber class={iconSizeClass} />
	</div>
</th>
<th
	class={isExpanded ? 'min-w-32 px-1.5' : 'min-w-24 px-0.5 text-[0.65rem]'}
	title="SID steps or envelope shapes (0–15), depending on row mode.">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonWaveform class={iconSizeClass} />
		<span>Steps</span>
	</div>
</th>
