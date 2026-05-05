<script lang="ts">
	import Input from '../Input/Input.svelte';

	let {
		value = $bindable(),
		error = null,
		onCommit,
		onCancel,
		maxLength = 2,
		inputFilter,
		class: className = ''
	}: {
		value: string;
		error: string | null;
		onCommit: () => void;
		onCancel: () => void;
		maxLength?: number;
		inputFilter?: (raw: string) => string;
		class?: string;
	} = $props();

	function handleInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value;
		if (inputFilter) {
			value = inputFilter(raw);
		}
	}
</script>

<div class="flex flex-col items-center gap-1">
	<Input
		class="w-12 text-center font-mono text-xs {className}"
		bind:value
		oninput={handleInput}
		onkeydown={(e) => {
			if (e.key === 'Enter') onCommit();
			else if (e.key === 'Escape') onCancel();
		}}
		onblur={onCommit}
		autofocus
		maxlength={maxLength} />
	{#if error}
		<span class="text-[0.6rem] text-[var(--color-pattern-note-off)]">{error}</span>
	{/if}
</div>
