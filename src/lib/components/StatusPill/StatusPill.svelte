<script lang="ts">
	import type { ClassValue } from 'svelte/elements';

	let {
		tone = 'note',
		class: className,
		children
	}: {
		tone?: 'note' | 'envelope';
		class?: ClassValue;
		children: import('svelte').Snippet;
	} = $props();

	const toneClasses = $derived(
		tone === 'envelope'
			? 'rounded-full border border-[var(--color-pattern-envelope)]/30 bg-[var(--color-pattern-envelope)]/10 font-mono text-[var(--color-pattern-envelope)]'
			: 'rounded-full border border-[var(--color-pattern-note)]/25 bg-[var(--color-pattern-note)]/10 font-mono text-[var(--color-pattern-note)]'
	);
</script>

<span class="px-2 py-0.5 text-[10px] {toneClasses} {className}">
	{@render children()}
</span>
