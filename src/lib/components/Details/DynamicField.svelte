<script lang="ts">
	import type { ChipSetting } from '../../chips/base/schema';
	import Input from '../Input/Input.svelte';
	import Select from '../AppLayout/Select.svelte';

	let {
		setting,
		value = $bindable(),
		onChange,
		context = {},
		hintOverride = undefined
	}: {
		setting: ChipSetting;
		value: unknown;
		onChange?: (key: string, newValue: unknown, setting: ChipSetting) => void;
		context?: Record<string, unknown>;
		hintOverride?: string | null;
	} = $props();

	function handleChange(newValue: unknown) {
		value = newValue;
		onChange?.(setting.key, newValue, setting);
	}

	const selectOptions = $derived.by(() => {
		if (setting.type !== 'select' || !setting.options) return [];
		const base = setting.options.map((opt) => ({
			label: opt.label,
			value: typeof opt.value === 'number' ? opt.value : parseFloat(String(opt.value))
		}));
		if (setting.dynamicOption) {
			base.push({
				label: setting.dynamicOption.label(context),
				value: setting.dynamicOption.value
			});
		}
		return base;
	});

	const visible = $derived(
		!setting.showWhen || context[setting.showWhen.key] == setting.showWhen.value
	);

	const disabled = $derived(
		setting.disabledWhen != null &&
			context[setting.disabledWhen.key] == setting.disabledWhen.value
	);

	const toggleLabel = $derived(
		setting.type === 'toggle' && setting.options
			? (setting.options.find((opt) => opt.value === value)?.label ?? String(value))
			: String(value)
	);

	const hint = $derived(
		hintOverride !== undefined
			? hintOverride
			: setting.computedHint
				? setting.computedHint(value, context)
				: null
	);

	const isIntegerNumber =
		setting.type === 'number' &&
		setting.step === 1 &&
		setting.min !== undefined &&
		setting.max !== undefined;

	let integerDisplay = $state('');
	let integerFocused = $state(false);

	$effect(() => {
		if (isIntegerNumber && !integerFocused) {
			const n = Number(value);
			const int = Number.isInteger(n) ? n : Math.floor(n);
			integerDisplay = Number.isNaN(int)
				? String(setting.defaultValue ?? setting.min ?? '')
				: String(clampInteger(int));
		}
	});

	function clampInteger(val: number): number {
		if (!isIntegerNumber) return val;
		const min = setting.min ?? 0;
		const max = setting.max ?? 255;
		return Math.min(max, Math.max(min, Math.floor(val)));
	}

	function handleIntegerInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		integerDisplay = input.value.replace(/\D/g, '');
	}

	function handleIntegerBlur() {
		integerFocused = false;
		if (integerDisplay === '') {
			const fallback = setting.min ?? setting.defaultValue ?? 0;
			handleChange(fallback);
			integerDisplay = String(fallback);
			return;
		}
		const num = parseInt(integerDisplay, 10);
		if (Number.isNaN(num)) {
			const fallback = setting.min ?? setting.defaultValue ?? 0;
			handleChange(fallback);
			integerDisplay = String(fallback);
			return;
		}
		const clamped = clampInteger(num);
		handleChange(clamped);
		integerDisplay = String(clamped);
	}

	function handleIntegerKeydown(e: KeyboardEvent) {
		if (
			/^\d$/.test(e.key) ||
			e.key === 'Backspace' ||
			e.key === 'Delete' ||
			e.key === 'Tab' ||
			e.key.startsWith('Arrow') ||
			e.key === 'Home' ||
			e.key === 'End'
		) {
			return;
		}
		if (e.ctrlKey || e.metaKey) {
			if (e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x') return;
		}
		e.preventDefault();
	}

	function handleIntegerPaste(e: ClipboardEvent) {
		e.preventDefault();
		const raw = (e.clipboardData?.getData('text') ?? '').trim();
		const parsed = parseInt(raw, 10);
		if (Number.isNaN(parsed)) {
			integerDisplay = '';
			return;
		}
		integerDisplay = String(parsed);
	}
</script>

{#if visible}
	{#if setting.type === 'text'}
		<Input bind:value={value as string} />
	{:else if setting.type === 'toggle' && setting.options}
		<button
			type="button"
			class="w-full rounded border border-[var(--color-app-border)] bg-[var(--color-pattern-bg)] px-2 py-1 text-xs transition-colors focus:border-transparent focus:ring-1 focus:ring-blue-500 focus:outline-none"
			class:cursor-pointer={!disabled}
			class:hover:bg-[var(--color-pattern-selected)]={!disabled}
			class:cursor-not-allowed={disabled}
			class:opacity-50={disabled}
			disabled={disabled}
			onclick={() => {
				if (disabled) return;
				const currentIndex = setting.options?.findIndex((opt) => opt.value === value) ?? 0;
				const nextIndex = (currentIndex + 1) % (setting.options?.length ?? 1);
				handleChange(setting.options?.[nextIndex]?.value);
			}}>
			{toggleLabel}
		</button>
	{:else if setting.type === 'select' && setting.options}
		<Select
			bind:value={value as number}
			options={selectOptions}
			showCustomOption={!setting.dynamicOption}
			{disabled}
			onchange={() => onChange?.(setting.key, value, setting)} />
	{:else if setting.type === 'number'}
		<div class="flex items-center gap-2">
			{#if isIntegerNumber}
				<Input
					bind:value={integerDisplay}
					type="text"
					inputmode="numeric"
					autocomplete="off"
					onfocus={() => (integerFocused = true)}
					onblur={handleIntegerBlur}
					oninput={handleIntegerInput}
					onkeydown={handleIntegerKeydown}
					onpaste={handleIntegerPaste}
					onchange={() => onChange?.(setting.key, value, setting)} />
			{:else}
				<Input
					bind:value={value as string}
					type="number"
					min={setting.min}
					max={setting.max}
					step={setting.step}
					onchange={() => onChange?.(setting.key, value, setting)} />
			{/if}
			{#if hint}
				<span class="text-xs text-[var(--color-app-text-muted)]">{hint}</span>
			{/if}
		</div>
	{/if}
	{#if setting.type !== 'number' && hint}
		<span class="text-xs text-[var(--color-app-text-muted)]">{hint}</span>
	{/if}
{/if}
