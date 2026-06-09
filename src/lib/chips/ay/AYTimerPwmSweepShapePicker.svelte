<script lang="ts">
	import IconCarbonChevronDown from '~icons/carbon/chevron-down';
	import {
		AY_TIMER_PWM_SWEEP_SHAPES,
		normalizeTimerPwmSweepShape,
		timerPwmSweepShapeLabel,
		type AyTimerPwmSweepShape
	} from './instrument';

	let {
		value,
		disabled = false,
		isExpanded = false,
		onchange
	}: {
		value: AyTimerPwmSweepShape;
		disabled?: boolean;
		isExpanded?: boolean;
		onchange?: (shape: AyTimerPwmSweepShape) => void;
	} = $props();

	const textClass = $derived(isExpanded ? 'text-xs' : 'text-[0.65rem]');

	function shapeTitle(shape: AyTimerPwmSweepShape): string {
		return `${timerPwmSweepShapeLabel(shape)} PWM sweep`;
	}

	function handleChange(event: Event): void {
		if (disabled) {
			return;
		}
		const next = normalizeTimerPwmSweepShape((event.currentTarget as HTMLSelectElement).value);
		if (next !== value) {
			onchange?.(next);
		}
	}
</script>

<div class="relative max-w-[11rem] {disabled ? 'opacity-60' : ''}">
	<select
		{value}
		{disabled}
		class="{textClass} w-full min-w-0 cursor-pointer appearance-none rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] py-1 pr-7 pl-2 font-mono text-[var(--color-app-text-primary)] focus:border-[var(--color-app-primary)] focus:outline-none disabled:cursor-not-allowed"
		aria-label="PWM sweep shape"
		title={disabled ? 'Disabled: requires timer PWM on SID/sync, FM, or env FM' : shapeTitle(value)}
		onchange={handleChange}>
		{#each AY_TIMER_PWM_SWEEP_SHAPES as shape (shape)}
			<option value={shape} title={shapeTitle(shape)}>{timerPwmSweepShapeLabel(shape)}</option>
		{/each}
	</select>
	<div class="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
		<IconCarbonChevronDown class="h-3 w-3 text-[var(--color-app-text-muted)]" />
	</div>
</div>
