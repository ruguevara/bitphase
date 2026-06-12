<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(),
		variant = 'default',
		class: className,
		...rest
	}: HTMLInputAttributes & {
		variant?: 'default' | 'secondary';
	} = $props();

	const variantClasses = $derived(
		variant === 'secondary'
			? 'bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-primary)] focus:border-[var(--color-app-accent)]'
			: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-secondary)] focus:border-[var(--color-app-primary)]'
	);
</script>

<input
	bind:value
	class="min-w-0 flex-1 overflow-x-auto rounded border border-[var(--color-app-border)] px-2 py-1
		placeholder-[var(--color-app-text-muted)] accent-[var(--color-app-primary)] focus:outline-none {variantClasses} {className}"
	{...rest} />
