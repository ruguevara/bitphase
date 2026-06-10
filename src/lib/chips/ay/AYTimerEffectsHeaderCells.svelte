<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
</script>

<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="SID effect (tone × volume with adjustable pulse width). Mutually exclusive with syncbuzzer and FM.">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>×</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="Syncbuzzer (rapid envelope shape retrigger). Mutually exclusive with SID and FM.">
	<div class="flex items-center justify-center">
		<IconCarbonActivity class={iconSizeClass} />
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="FM (rapid tone offset switching). Mutually exclusive with SID and syncbuzzer.">
	<div class="flex items-center justify-center font-semibold">FM</div>
</th>
<th
	class={isExpanded ? 'w-9 min-w-9 px-1' : 'w-9 min-w-9 px-0.5 text-[0.65rem]'}
	title="Envelope FM (rapid envelope period offset switching). Mutually exclusive with SID, syncbuzzer, and FM.">
	<div class="flex items-center justify-center font-semibold">EFM</div>
</th>
<th
	class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5 text-[0.65rem]'}
	title="Detune (semitone) added to tone period">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-12 min-w-12 px-1' : 'w-10 px-0.5 text-[0.65rem]'}
	title="Detune added to tone period">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class="timer-steps-column {isExpanded ? 'min-w-32 px-1.5' : 'min-w-24 px-0.5 text-[0.65rem]'}"
	title="SID steps, envelope shapes (0–15), or FM semitone/fine-tune offsets depending on row mode.">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonWaveform class={iconSizeClass} />
		<span>Steps</span>
	</div>
</th>
