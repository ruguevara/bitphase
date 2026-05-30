<script lang="ts">
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const pwmSupported = $derived(controller.instrumentSupportsTimerPwm());
	const minInputEnabled = $derived(pwmSupported && controller.timerPwmSweep() > 0);
	const pwmDisclaimer = $derived.by(() => {
		if (!pwmSupported) {
			return 'PWM min %, max %, and sweep are disabled until at least one non-syncbuzzer row uses classic SID steps (15 0).';
		}
		if (!minInputEnabled) {
			return 'Min % is disabled while sweep is 0; max % sets the static pulse width.';
		}
		return null;
	});

	let pwmSweepMinInput = $state('0');
	let pwmDutyInput = $state('50');

	$effect(() => {
		controller.timerPwmSweep();
		pwmSweepMinInput = String(
			controller.timerPwmSweep() > 0 ? controller.timerPwmSweepMin() : 0
		);
	});

	$effect(() => {
		pwmDutyInput = String(controller.timerPwmDuty());
	});

	function inputClass(inactive = false, width: 'full' | 'compact' = 'full'): string {
		const widthClass = width === 'compact' ? 'w-9 max-w-9 shrink-0' : 'w-full min-w-0';
		return `${widthClass} rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] ${
			isExpanded ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[0.65rem]'
		} ${
			inactive
				? 'text-[var(--color-app-text-tertiary)] opacity-60'
				: 'text-[var(--color-app-text-secondary)]'
		} placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}

	function commitPwmSweepMin(): void {
		if (!minInputEnabled) return;
		const parsed = Number.parseInt(pwmSweepMinInput, 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmSweepMin(parsed);
			pwmSweepMinInput = String(controller.timerPwmSweepMin());
		}
	}

	function commitPwmDuty(): void {
		const parsed = Number.parseInt(pwmDutyInput, 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmDuty(parsed);
			pwmDutyInput = String(controller.timerPwmDuty());
		}
	}
</script>

<div class="px-2 py-1.5">
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-1.5">
			<span class="text-[var(--color-app-text-muted)] {isExpanded ? 'text-xs' : 'text-[0.65rem]'}">min</span>
			<div class="flex w-16 items-center gap-0.5">
				<input
					type="text"
					class="{inputClass(!minInputEnabled)} min-w-0 flex-1"
					value={pwmSweepMinInput}
					disabled={!minInputEnabled}
					title={!pwmSupported
						? 'Disabled: requires classic SID steps (15 0) on at least one non-syncbuzzer row'
						: minInputEnabled
							? 'Sweep min pulse width (0–50%, must be ≤ max)'
							: 'Disabled while sweep is 0; only max % is used for static pulse width'}
					onfocus={(e) => (e.target as HTMLInputElement).select()}
					oninput={(event) => (pwmSweepMinInput = (event.currentTarget as HTMLInputElement).value)}
					onchange={commitPwmSweepMin}
					onblur={commitPwmSweepMin} />
				<span class="shrink-0 text-[var(--color-app-text-muted)] {isExpanded
					? 'text-xs'
					: 'text-[0.65rem]'}">%</span>
			</div>
		</div>
		<div class="flex items-center gap-1.5">
			<span class="text-[var(--color-app-text-muted)] {isExpanded ? 'text-xs' : 'text-[0.65rem]'}">max</span>
			<div class="flex w-16 items-center gap-0.5">
				<input
					type="text"
					class="{inputClass(!pwmSupported)} min-w-0 flex-1"
					value={pwmDutyInput}
					disabled={!pwmSupported}
					title={pwmSupported
						? 'Pulse width max (0–50%, 50 = symmetric SID). Static duty when sweep is off.'
						: 'Disabled: requires classic SID steps (15 0) on at least one non-syncbuzzer row'}
					onfocus={(e) => (e.target as HTMLInputElement).select()}
					oninput={(event) => (pwmDutyInput = (event.currentTarget as HTMLInputElement).value)}
					onchange={commitPwmDuty}
					onblur={commitPwmDuty} />
				<span class="shrink-0 text-[var(--color-app-text-muted)] {isExpanded
					? 'text-xs'
					: 'text-[0.65rem]'}">%</span>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			<span class="text-[var(--color-app-text-muted)] {isExpanded ? 'text-xs' : 'text-[0.65rem]'}">sweep</span>
			<input
				type="text"
				class={inputClass(!pwmSupported, 'compact')}
				value={controller.formatNum(controller.timerPwmSweep())}
				disabled={!pwmSupported}
				title={pwmSupported
					? 'Pulse width sweep speed (auto PWM bounce between min and max, 0 = off)'
					: 'Disabled: requires classic SID steps (15 0) on at least one non-syncbuzzer row'}
				onfocus={(e) => (e.target as HTMLInputElement).select()}
				oninput={(e) =>
					controller.updateTimerPwmSweep((e.target as HTMLInputElement).value)} />
		</div>
	</div>
	<label
		class="mt-2 flex cursor-pointer items-center gap-1.5 {pwmSupported
			? 'text-[var(--color-app-text-secondary)]'
			: 'cursor-not-allowed text-[var(--color-app-text-tertiary)] opacity-60'}">
		<input
			type="checkbox"
			class="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] text-[var(--color-app-primary)] focus:ring-2 focus:ring-[var(--color-app-primary)] disabled:cursor-not-allowed"
			checked={controller.timerPwmPreserveOnNewNote()}
			disabled={!pwmSupported}
			title={pwmSupported
				? 'Keep PWM sweep position when retriggering notes or switching to this instrument'
				: 'Disabled: requires classic SID steps (15 0) on at least one non-syncbuzzer row'}
			onchange={(event) =>
				controller.setTimerPwmPreserveOnNewNote(
					(event.currentTarget as HTMLInputElement).checked
				)} />
		<span class={isExpanded ? 'text-xs' : 'text-[0.65rem]'}>Don't restart PWM sweep on new notes</span>
	</label>
	{#if pwmDisclaimer}
		<p
			class="mt-1.5 text-[var(--color-app-text-tertiary)] {isExpanded
				? 'text-[11px] leading-snug'
				: 'text-[0.6rem] leading-snug'}">
			{pwmDisclaimer}
		</p>
	{/if}
</div>
