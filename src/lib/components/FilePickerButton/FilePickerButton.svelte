<script lang="ts">
	let {
		label,
		accept,
		onchange
	}: {
		label: string;
		accept: string;
		onchange: (event: Event) => void;
	} = $props();
</script>

<label
	class="cursor-pointer rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-3 py-1.5 text-xs text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]">
	{label}
	<input type="file" {accept} class="hidden" {onchange} />
</label>
