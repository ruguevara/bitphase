<script lang="ts">
	import IconCarbonEdit from '~icons/carbon/edit';
	import IconCarbonChevronDown from '~icons/carbon/chevron-down';

	type SelectOption = {
		label: string;
		value: number;
	};

	let {
		value = $bindable(),
		options,
		onchange,
		showCustomOption = true,
		disabled = false
	}: {
		value: number;
		options: SelectOption[];
		onchange?: () => void;
		showCustomOption?: boolean;
		disabled?: boolean;
	} = $props();

	let selectedOption = $state<string>('');
	let isCustom = $state(false);
	let customValue = $state(value);

	$effect(() => {
		const matchingOption = options.find((option) => option.value === value);
		if (matchingOption) {
			selectedOption = matchingOption.label;
			isCustom = false;
		} else {
			selectedOption = 'Custom';
			isCustom = true;
			customValue = value;
		}
	});

	function handleSelectionChange() {
		if (selectedOption === 'Custom') {
			isCustom = true;
			customValue = value;
		} else {
			isCustom = false;
			const option = options.find((opt) => opt.label === selectedOption);
			if (option) {
				value = option.value;
				onchange?.();
			}
		}
	}

	function handleCustomValueChange() {
		if (isCustom) {
			value = customValue;
			onchange?.();
		}
	}

	function switchToDropdown() {
		isCustom = false;
		selectedOption = '';
	}
</script>

{#if isCustom}
	<div class="relative">
		<input
			type="number"
			bind:value={customValue}
			oninput={handleCustomValueChange}
			placeholder="Enter value"
			{disabled}
			class="w-full rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 pr-8 text-xs text-[var(--color-app-text-secondary)] placeholder-[var(--color-app-text-muted)] focus:border-transparent focus:ring-1 focus:ring-[var(--color-app-primary)] focus:outline-none"
			class:cursor-not-allowed={disabled}
			class:opacity-50={disabled} />
		<button
			onclick={switchToDropdown}
			{disabled}
			class="absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]"
			class:cursor-not-allowed={disabled}
			class:opacity-50={disabled}
			title="Switch to preset options">
			<IconCarbonEdit class="h-3 w-3" />
		</button>
	</div>
{:else}
	<div class="relative">
		<select
			bind:value={selectedOption}
			onchange={handleSelectionChange}
			{disabled}
			class="w-full rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 pr-8 text-xs text-[var(--color-app-text-secondary)] focus:border-transparent focus:ring-1 focus:ring-[var(--color-app-primary)] focus:outline-none"
			class:cursor-pointer={!disabled}
			class:cursor-not-allowed={disabled}
			class:opacity-50={disabled}>
			<option value="" disabled>Select option</option>
			{#each options as option}
				<option value={option.label}>{option.label}</option>
			{/each}
			{#if showCustomOption}
				<option value="Custom">Custom</option>
			{/if}
		</select>
		<div class="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer">
			<IconCarbonChevronDown class="h-3 w-3 text-[var(--color-app-text-muted)]" />
		</div>
	</div>
{/if}
