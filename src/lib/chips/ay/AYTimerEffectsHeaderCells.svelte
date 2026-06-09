<script lang="ts">
	import IconCarbonChartWinLoss from '~icons/carbon/chart-win-loss';
	import IconCarbonActivity from '~icons/carbon/activity';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
	const compactHeaderClass = $derived(
		isExpanded
			? 'timer-effect-boolean-column w-8 min-w-8 max-w-8 px-1'
			: 'timer-effect-boolean-column w-8 min-w-8 max-w-8 px-0.5 text-[0.65rem]'
	);
	const compactOffsetHeaderClass = $derived(
		isExpanded
			? 'timer-effect-offset-column w-12 min-w-12 max-w-12 px-1.5'
			: 'timer-effect-offset-column w-12 min-w-12 max-w-12 px-0.5 text-[0.65rem]'
	);
</script>

<th
	class={compactHeaderClass}
	title="SID effect (tone × volume with adjustable pulse width). Can combine with FM and env FM. Mutually exclusive with syncbuzzer.">
	<div class="flex items-center justify-center">
		<IconCarbonChartWinLoss class={iconSizeClass} />
	</div>
</th>
<th
	class={compactHeaderClass}
	title="Syncbuzzer (rapid envelope shape retrigger). Can combine with FM and env FM. Mutually exclusive with SID.">
	<div class="flex items-center justify-center">
		<IconCarbonActivity class={iconSizeClass} />
	</div>
</th>
<th
	class={compactHeaderClass}
	title="FM (rapid tone offset switching). Can combine with SID or syncbuzzer.">
	<div class="flex items-center justify-center font-semibold leading-none">FM</div>
</th>
<th
	class={compactHeaderClass}
	title="Env FM (rapid envelope value offset switching). Can combine with SID or syncbuzzer.">
	<div class="flex items-center justify-center text-[0.55rem] font-semibold leading-none">EFM</div>
</th>
<th
	class={compactOffsetHeaderClass}
	title="Detune (semitone) added to tone period">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class={compactOffsetHeaderClass}
	title="Detune added to tone period">
	<div class="flex items-center justify-center gap-0.5">
		<IconCarbonChartWinLoss class={iconSizeClass} />
		<span>+</span>
	</div>
</th>
<th
	class="timer-steps-column {compactHeaderClass}"
	title="Timer waveform steps. Click to open the steps editor.">
	<div class="flex items-center justify-center">
		<IconCarbonWaveform class={iconSizeClass} />
	</div>
</th>
