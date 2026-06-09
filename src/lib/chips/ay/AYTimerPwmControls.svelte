<script lang="ts">
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import AYTimerPwmSweepShapePicker from './AYTimerPwmSweepShapePicker.svelte';
	import AYTimerPwmAutomationTriggerPicker from './AYTimerPwmAutomationTriggerPicker.svelte';
	import {
		AY_TIMER_PWM_DUTY_MAX,
		AY_TIMER_PWM_SCOPES,
		sanitizeTimerPwmPercentInput,
		sanitizeTimerPwmSweepInput,
		timerPwmScopeLabel,
		type AyTimerPwmScope
	} from './instrument';

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const pwmSupported = $derived(controller.instrumentSupportsTimerPwm());
	const activePwmScopes = $derived(
		AY_TIMER_PWM_SCOPES.filter((scope) => controller.instrumentScopeSupportsTimerPwm(scope))
	);
	const sectionLabelClass = $derived(
		isExpanded
			? 'text-[0.65rem] font-semibold uppercase tracking-wider'
			: 'text-[0.6rem] font-semibold uppercase tracking-wider'
	);
	const fieldLabelClass = $derived(
		isExpanded ? 'text-[0.62rem] text-[var(--color-app-text-tertiary)]' : 'text-[0.58rem] text-[var(--color-app-text-tertiary)]'
	);
	const checkboxLabelClass = $derived(isExpanded ? 'text-xs leading-snug' : 'text-[0.65rem] leading-snug');

	let pwmSweepMinInputs = $state<Record<AyTimerPwmScope, string>>({
		sidSync: '0',
		fm: '0',
		efm: '0'
	});
	let pwmDutyInputs = $state<Record<AyTimerPwmScope, string>>({
		sidSync: '50',
		fm: '50',
		efm: '50'
	});
	let pwmSweepInputs = $state<Record<AyTimerPwmScope, string>>({
		sidSync: '0',
		fm: '0',
		efm: '0'
	});
	let pwmSweepMinFocused = $state<Partial<Record<AyTimerPwmScope, boolean>>>({});
	let pwmDutyFocused = $state<Partial<Record<AyTimerPwmScope, boolean>>>({});
	let pwmSweepFocused = $state<Partial<Record<AyTimerPwmScope, boolean>>>({});

	function minInputEnabled(scope: AyTimerPwmScope): boolean {
		return controller.timerPwmSweep(scope) > 0;
	}

	function scopeHasActiveSweep(scope: AyTimerPwmScope): boolean {
		return controller.timerPwmSweep(scope) > 0;
	}

	function inputClass(inactive = false): string {
		return `w-full min-w-0 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] font-mono tabular-nums ${
			isExpanded ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[0.65rem]'
		} ${
			inactive
				? 'text-[var(--color-app-text-tertiary)] opacity-60'
				: 'text-[var(--color-app-text-primary)]'
		} placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none`;
	}

	function scopeHeaderClass(activeSweep: boolean): string {
		if (activeSweep) {
			return 'border-b border-[var(--color-app-primary)]/25 bg-[color-mix(in_srgb,var(--color-app-primary)_10%,var(--color-app-surface-secondary))]';
		}
		return 'border-b border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]/55';
	}

	function checkboxClass(enabled: boolean): string {
		return `flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 transition-colors ${
			enabled
				? 'text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]'
				: 'cursor-not-allowed text-[var(--color-app-text-tertiary)] opacity-60'
		}`;
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

	function syncScopeInputs(scope: AyTimerPwmScope): void {
		if (!pwmSweepMinFocused[scope]) {
			pwmSweepMinInputs[scope] = String(
				controller.timerPwmSweep(scope) > 0 ? controller.timerPwmSweepMin(scope) : 0
			);
		}
		if (!pwmDutyFocused[scope]) {
			pwmDutyInputs[scope] = String(controller.timerPwmDuty(scope));
		}
		if (!pwmSweepFocused[scope]) {
			pwmSweepInputs[scope] = controller.formatNum(controller.timerPwmSweep(scope));
		}
	}

	$effect(() => {
		for (const scope of activePwmScopes) {
			controller.timerPwmSweep(scope);
			controller.timerPwmDuty(scope);
			syncScopeInputs(scope);
		}
	});

	$effect(() => {
		controller.usesHexNumerals();
		for (const scope of activePwmScopes) {
			if (!pwmSweepFocused[scope]) {
				pwmSweepInputs[scope] = controller.formatNum(controller.timerPwmSweep(scope));
			}
		}
	});

	function handlePwmSweepMinInput(scope: AyTimerPwmScope, raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmPercentInput(raw, controller.timerPwmDuty(scope));
		applySanitizedInput(input, sanitized, (value) => {
			pwmSweepMinInputs[scope] = value;
		});
	}

	function commitPwmSweepMin(scope: AyTimerPwmScope): void {
		if (!minInputEnabled(scope)) return;
		const parsed = Number.parseInt(pwmSweepMinInputs[scope] ?? '0', 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmSweepMin(scope, parsed);
		}
		pwmSweepMinInputs[scope] = String(
			controller.timerPwmSweep(scope) > 0 ? controller.timerPwmSweepMin(scope) : 0
		);
	}

	function handlePwmDutyInput(scope: AyTimerPwmScope, raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmPercentInput(raw, AY_TIMER_PWM_DUTY_MAX);
		applySanitizedInput(input, sanitized, (value) => {
			pwmDutyInputs[scope] = value;
		});
	}

	function commitPwmDuty(scope: AyTimerPwmScope): void {
		const parsed = Number.parseInt(pwmDutyInputs[scope] ?? '0', 10);
		if (Number.isFinite(parsed)) {
			controller.setTimerPwmDuty(scope, parsed);
		}
		pwmDutyInputs[scope] = String(controller.timerPwmDuty(scope));
	}

	function handlePwmSweepInput(scope: AyTimerPwmScope, raw: string, input: HTMLInputElement): void {
		const sanitized = sanitizeTimerPwmSweepInput(
			raw,
			AY_TIMER_PWM_DUTY_MAX,
			controller.usesHexNumerals()
		);
		applySanitizedInput(input, sanitized, (value) => {
			pwmSweepInputs[scope] = value;
		});
	}

	function commitPwmSweep(scope: AyTimerPwmScope): void {
		controller.updateTimerPwmSweep(scope, pwmSweepInputs[scope] ?? '0');
		pwmSweepInputs[scope] = controller.formatNum(controller.timerPwmSweep(scope));
	}
</script>

<div
	class="space-y-2 bg-[var(--color-app-surface-secondary)]/35 px-2.5 py-2 {isExpanded
		? 'text-xs'
		: 'text-[0.65rem]'}">
	{#if pwmSupported}
		<div class="flex items-baseline justify-between gap-2 px-0.5">
			<span class="{sectionLabelClass} text-[var(--color-app-text-muted)]">Pulse width modulation</span>
			<span class="text-[0.58rem] text-[var(--color-app-text-tertiary)]">per effect</span>
		</div>

		{#each activePwmScopes as scope (scope)}
			{@const activeSweep = scopeHasActiveSweep(scope)}
			<article
				class="overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface)] shadow-sm">
				<header
					class="flex items-center justify-between gap-2 px-2.5 py-1 {scopeHeaderClass(activeSweep)}">
					<span
						class="{sectionLabelClass} {activeSweep
							? 'text-[var(--color-app-primary)]'
							: 'text-[var(--color-app-text-secondary)]'}">
						{timerPwmScopeLabel(scope)}
					</span>
					{#if activeSweep}
						<span
							class="rounded-full bg-[var(--color-app-primary)]/15 px-1.5 py-px text-[0.58rem] font-medium text-[var(--color-app-primary)]">
							sweep active
						</span>
					{/if}
				</header>

				<div class="space-y-2.5 p-2.5">
					<div class="grid grid-cols-3 gap-2">
						<label class="flex min-w-0 flex-col gap-0.5">
							<span class="{fieldLabelClass}">Min</span>
							<div class="flex items-center gap-0.5">
								<input
									type="text"
									inputmode="numeric"
									class={inputClass(!minInputEnabled(scope))}
									value={pwmSweepMinInputs[scope]}
									disabled={!minInputEnabled(scope)}
									title={minInputEnabled(scope)
										? 'Sweep min pulse width (0–50%, must be ≤ max)'
										: 'Disabled while sweep is 0; only max % is used for static pulse width'}
									onfocus={(e) => {
										pwmSweepMinFocused[scope] = true;
										(e.target as HTMLInputElement).select();
									}}
									oninput={(event) =>
										handlePwmSweepMinInput(
											scope,
											(event.currentTarget as HTMLInputElement).value,
											event.currentTarget as HTMLInputElement
										)}
									onchange={() => commitPwmSweepMin(scope)}
									onblur={() => {
										commitPwmSweepMin(scope);
										pwmSweepMinFocused[scope] = false;
									}} />
								<span class="shrink-0 {fieldLabelClass}">%</span>
							</div>
						</label>

						<label class="flex min-w-0 flex-col gap-0.5">
							<span class="{fieldLabelClass}">Max</span>
							<div class="flex items-center gap-0.5">
								<input
									type="text"
									inputmode="numeric"
									class={inputClass()}
									value={pwmDutyInputs[scope]}
									title="Pulse width max (0–50%, 50 = symmetric). Static duty when sweep is off."
									onfocus={(e) => {
										pwmDutyFocused[scope] = true;
										(e.target as HTMLInputElement).select();
									}}
									oninput={(event) =>
										handlePwmDutyInput(
											scope,
											(event.currentTarget as HTMLInputElement).value,
											event.currentTarget as HTMLInputElement
										)}
									onchange={() => commitPwmDuty(scope)}
									onblur={() => {
										commitPwmDuty(scope);
										pwmDutyFocused[scope] = false;
									}} />
								<span class="shrink-0 {fieldLabelClass}">%</span>
							</div>
						</label>

						<label class="flex min-w-0 flex-col gap-0.5">
							<span class="{fieldLabelClass}">Sweep</span>
							<input
								type="text"
								inputmode="numeric"
								class={inputClass()}
								value={pwmSweepInputs[scope]}
								title={`Pulse width sweep speed (0–${AY_TIMER_PWM_DUTY_MAX}, auto PWM bounce between min and max, 0 = off)`}
								onfocus={(e) => {
									pwmSweepFocused[scope] = true;
									(e.target as HTMLInputElement).select();
								}}
								oninput={(e) =>
									handlePwmSweepInput(
										scope,
										(e.currentTarget as HTMLInputElement).value,
										e.currentTarget as HTMLInputElement
									)}
								onchange={() => commitPwmSweep(scope)}
								onblur={() => {
									commitPwmSweep(scope);
									pwmSweepFocused[scope] = false;
								}} />
						</label>
					</div>

					<div class="border-t border-[var(--color-app-border)]/60 pt-2.5">
						<div class="mb-1.5 flex items-center justify-between gap-2">
							<span class="{fieldLabelClass} uppercase tracking-wide">Sweep shape</span>
						</div>
						<AYTimerPwmSweepShapePicker
							value={controller.timerPwmSweepShape(scope)}
							{isExpanded}
							onchange={(shape) => controller.setTimerPwmSweepShape(scope, shape)} />

						<div class="mt-2.5 space-y-2">
							<div>
								<span class="{fieldLabelClass} mb-1 block uppercase tracking-wide">Trigger</span>
								<AYTimerPwmAutomationTriggerPicker
									value={controller.timerPwmAutomationTrigger(scope)}
									{isExpanded}
									onchange={(trigger) =>
										controller.setTimerPwmAutomationTrigger(scope, trigger)} />
							</div>
							<label class={checkboxClass(controller.timerPwmSweep(scope) > 0)}>
								<input
									type="checkbox"
									class="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] text-[var(--color-app-primary)] focus:ring-2 focus:ring-[var(--color-app-primary)] disabled:cursor-not-allowed"
									checked={controller.timerPwmReverseSweep(scope)}
									disabled={controller.timerPwmSweep(scope) <= 0}
									title={controller.timerPwmSweep(scope) > 0
										? 'Start PWM sweep at max and sweep down toward min first'
										: 'Disabled while sweep is 0'}
									onchange={(event) =>
										controller.setTimerPwmReverseSweep(
											scope,
											(event.currentTarget as HTMLInputElement).checked
										)} />
								<span class={checkboxLabelClass}>Reverse PWM sweep</span>
							</label>
						</div>
					</div>
				</div>
			</article>
		{/each}
	{:else}
		<p
			class="rounded-md border border-dashed border-[var(--color-app-border)]/70 bg-[var(--color-app-surface)]/40 px-2.5 py-2 text-center text-[var(--color-app-text-tertiary)] {isExpanded
				? 'text-[11px] leading-snug'
				: 'text-[0.6rem] leading-snug'}">
			PWM needs SID/sync, FM, or env FM with exactly two waveform steps.
		</p>
	{/if}
</div>
