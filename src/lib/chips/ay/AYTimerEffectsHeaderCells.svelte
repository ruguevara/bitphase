<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonEdit from '~icons/carbon/edit';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
</script>

<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="SID effect (tone × volume with adjustable pulse width). Mutually exclusive with syncbuzzer; can combine with FM and env FM.">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>×</span>
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="Syncbuzzer (rapid envelope shape retrigger). Mutually exclusive with SID; can combine with FM and env FM.">
	<div class="flex items-center justify-center">
		<IconCarbonActivity class={iconSizeClass} />
	</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="FM (rapid tone offset switching). Can combine with SID, syncbuzzer, and env FM.">
	<div class="flex items-center justify-center font-semibold">FM</div>
</th>
<th
	class={isExpanded ? 'w-8 min-w-8 px-1' : 'w-8 min-w-8 px-0.5 text-[0.65rem]'}
	title="Env FM (rapid envelope period modulation). Can combine with SID, syncbuzzer, and FM.">
	<div class="flex items-center justify-center font-semibold">E+</div>
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
	class="timer-edit-column {isExpanded ? 'w-16 min-w-16 px-1.5' : 'w-12 min-w-12 px-0.5 text-[0.65rem]'}"
	title="Open waveform editor for enabled timer effects">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonEdit class={iconSizeClass} />
		<span>Edit</span>
	</div>
</th>
