<script lang="ts">
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import {
		AY_TIMER_PWM_DUTY_MAX,
		sanitizeTimerPwmPercentInput,
		sanitizeTimerPwmSweepInput
	} from './instrument';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const pwmSupported = $derived(controller.instrumentSupportsTimerPwm());
	const minInputEnabled = $derived(pwmSupported && controller.timerPwmSweep() > 0);
	const reverseSweepEnabled = $derived(minInputEnabled);
	const pwmDisclaimer = $derived.by(() => {
		if (!pwmSupported) {
			return 'PWM min %, max %, and sweep need SID, syncbuzzer, or FM with exactly two waveform steps.';
		}
		if (!minInputEnabled) {
			return 'Min % is disabled while sweep is 0; max % sets the static pulse width.';
		}
		return null;
	});

	let pwmSweepMinInput = $state('0');
	let pwmDutyInput = $state('50');
	let pwmSweepInput = $state('0');
	let pwmSweepMinFocused = $state(false);
	let pwmDutyFocused = $state(false);
	let pwmSweepFocused = $state(false);

	$effect(() => {
		controller.timerPwmSweep();
		controller.timerPwmDuty();
		if (!pwmSweepMinFocused) {
			pwmSweepMinInput = String(
				controller.timerPwmSweep() > 0 ? controller.timerPwmSweepMin() : 0
			);
		}
	});

	$effect(() => {
		if (!pwmDutyFocused) {
			pwmDutyInput = String(controller.timerPwmDuty());
		}
	});

	$effect(() => {
		controller.usesHexNumerals();
		if (!pwmSweepFocused) {
			pwmSweepInput = controller.formatNum(controller.timerPwmSweep());
		}
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

	function applySanitizedInput(
		input: HTMLInputElement,
		sanitized: string,
		setValue: (value: string) => void
	): void {
		setValue(sanitized);
		if (input.value !== sanitized) {
			input.value = sanitized;
		}
	}

	function handlePwmSweepMinInput(raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmPercentInput(raw, controller.timerPwmDuty());
		applySanitizedInput(input, sanitized, (value) => {
			pwmSweepMinInput = value;
		});
	}

	function commitPwmSweepMin(): void {
		if (!minInputEnabled) return;
		const parsed = Number.parseInt(pwmSweepMinInput, 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmSweepMin(parsed);
		}
		pwmSweepMinInput = String(
			controller.timerPwmSweep() > 0 ? controller.timerPwmSweepMin() : 0
		);
	}

	function handlePwmDutyInput(raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmPercentInput(raw, AY_TIMER_PWM_DUTY_MAX);
		applySanitizedInput(input, sanitized, (value) => {
			pwmDutyInput = value;
		});
	}

	function commitPwmDuty(): void {
		const parsed = Number.parseInt(pwmDutyInput, 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmDuty(parsed);
		}
		pwmDutyInput = String(controller.timerPwmDuty());
	}

	function handlePwmSweepInput(raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmSweepInput(
			raw,
			AY_TIMER_PWM_DUTY_MAX,
			controller.usesHexNumerals()
		);
		applySanitizedInput(input, sanitized, (value) => {
			pwmSweepInput = value;
		});
	}

	function commitPwmSweep(): void {
		controller.updateTimerPwmSweep(pwmSweepInput);
		pwmSweepInput = controller.formatNum(controller.timerPwmSweep());
	}
</script>

<div class="px-2 py-1.5">
	<div class="flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-1.5">
			<span class="text-[var(--color-app-text-muted)] {isExpanded ? 'text-xs' : 'text-[0.65rem]'}">min</span>
			<div class="flex w-16 items-center gap-0.5">
				<input
					type="text"
					inputmode="numeric"
					class="{inputClass(!minInputEnabled)} min-w-0 flex-1"
					value={pwmSweepMinInput}
					disabled={!minInputEnabled}
					title={!pwmSupported
						? 'Disabled: requires SID, syncbuzzer, or FM with exactly two waveform steps'
						: minInputEnabled
							? 'Sweep min pulse width (0–50%, must be ≤ max)'
							: 'Disabled while sweep is 0; only max % is used for static pulse width'}
					onfocus={(e) => {
						pwmSweepMinFocused = true;
						(e.target as HTMLInputElement).select();
					}}
					oninput={(event) =>
						handlePwmSweepMinInput(
							(event.currentTarget as HTMLInputElement).value,
							event.currentTarget as HTMLInputElement
						)}
					onchange={commitPwmSweepMin}
					onblur={() => {
						commitPwmSweepMin();
						pwmSweepMinFocused = false;
					}} />
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
					inputmode="numeric"
					class="{inputClass(!pwmSupported)} min-w-0 flex-1"
					value={pwmDutyInput}
					disabled={!pwmSupported}
					title={pwmSupported
						? 'Pulse width max (0–50%, 50 = symmetric). Static duty when sweep is off.'
						: 'Disabled: requires SID, syncbuzzer, or FM with exactly two waveform steps'}
					onfocus={(e) => {
						pwmDutyFocused = true;
						(e.target as HTMLInputElement).select();
					}}
					oninput={(event) =>
						handlePwmDutyInput(
							(event.currentTarget as HTMLInputElement).value,
							event.currentTarget as HTMLInputElement
						)}
					onchange={commitPwmDuty}
					onblur={() => {
						commitPwmDuty();
						pwmDutyFocused = false;
					}} />
				<span class="shrink-0 text-[var(--color-app-text-muted)] {isExpanded
					? 'text-xs'
					: 'text-[0.65rem]'}">%</span>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			<span class="text-[var(--color-app-text-muted)] {isExpanded ? 'text-xs' : 'text-[0.65rem]'}">sweep</span>
			<input
				type="text"
				inputmode="numeric"
				class={inputClass(!pwmSupported, 'compact')}
				value={pwmSweepInput}
				disabled={!pwmSupported}
				title={pwmSupported
					? `Pulse width sweep speed (0–${AY_TIMER_PWM_DUTY_MAX}, auto PWM bounce between min and max, 0 = off)`
					: 'Disabled: requires SID, syncbuzzer, or FM with exactly two waveform steps'}
				onfocus={(e) => {
					pwmSweepFocused = true;
					(e.target as HTMLInputElement).select();
				}}
				oninput={(e) =>
					handlePwmSweepInput(
						(e.currentTarget as HTMLInputElement).value,
						e.currentTarget as HTMLInputElement
					)}
				onchange={commitPwmSweep}
				onblur={() => {
					commitPwmSweep();
					pwmSweepFocused = false;
				}} />
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
				: 'Disabled: requires SID, syncbuzzer, or FM with exactly two waveform steps'}
			onchange={(event) =>
				controller.setTimerPwmPreserveOnNewNote(
					(event.currentTarget as HTMLInputElement).checked
				)} />
		<span class={isExpanded ? 'text-xs' : 'text-[0.65rem]'}>Don't restart PWM sweep on new notes</span>
	</label>
	<label
		class="mt-1.5 flex cursor-pointer items-center gap-1.5 {reverseSweepEnabled
			? 'text-[var(--color-app-text-secondary)]'
			: 'cursor-not-allowed text-[var(--color-app-text-tertiary)] opacity-60'}">
		<input
			type="checkbox"
			class="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] text-[var(--color-app-primary)] focus:ring-2 focus:ring-[var(--color-app-primary)] disabled:cursor-not-allowed"
			checked={controller.timerPwmReverseSweep()}
			disabled={!reverseSweepEnabled}
			title={reverseSweepEnabled
				? 'Start PWM sweep at max and sweep down toward min first'
				: pwmSupported
					? 'Disabled while sweep is 0'
					: 'Disabled: requires SID, syncbuzzer, or FM with exactly two waveform steps'}
			onchange={(event) =>
				controller.setTimerPwmReverseSweep(
					(event.currentTarget as HTMLInputElement).checked
				)} />
		<span class={isExpanded ? 'text-xs' : 'text-[0.65rem]'}>Reverse PWM sweep</span>
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
