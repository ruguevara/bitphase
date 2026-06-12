<script lang="ts">
	import Button from '../Button/Button.svelte';
	import { ModalPanel } from '../ModalPanel';

	let { message, resolve, dismiss } = $props<{
		message: string;
		resolve?: (value?: any) => void;
		dismiss?: (error?: any) => void;
	}>();

	function handleConfirm() {
		resolve?.(true);
	}

	function handleCancel() {
		resolve?.(false);
	}
</script>

<ModalPanel title="Confirm" width="w-96" compact>
	{#snippet children()}
		<p class="text-[var(--color-app-text-tertiary)]">{message}</p>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={handleCancel}>Cancel</Button>
		<Button variant="primary" onclick={handleConfirm}>Confirm</Button>
	{/snippet}
</ModalPanel>
