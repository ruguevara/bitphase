<script lang="ts">
	import Button from '../Button/Button.svelte';
	import { ModalPanel } from '../ModalPanel';
	import { alphaNoticeStore } from '../../stores/alpha-notice.svelte';

	let { resolve, onCloseRef } = $props<{
		resolve?: (value?: unknown) => void;
		onCloseRef?: { current: (() => void) | null };
	}>();

	function handleAcknowledge() {
		alphaNoticeStore.markSeen();
		resolve?.();
	}

	function handleCloseByBackdrop() {
		alphaNoticeStore.markSeen();
		resolve?.();
	}

	$effect(() => {
		if (onCloseRef) {
			onCloseRef.current = handleCloseByBackdrop;
			return () => {
				onCloseRef.current = null;
			};
		}
	});
</script>

<ModalPanel title="Heads up" width="w-[400px]" maxHeightClass="" compact bodyClass="flex flex-col gap-3 p-4">
	{#snippet children()}
		<p class="text-[var(--color-app-text-primary)]">
			Bitphase is still in early alpha development. We might change the app and there may be
			breaking changes, so we recommend keeping backups of your projects. If something breaks
			between releases, please let us know.
		</p>
		<p class="text-[var(--color-app-text-muted)]">
			You can submit issues and feature requests <a
				class="text-[var(--color-app-text-primary)] hover:underline"
				href="https://github.com/bitphase/bitphase"
				target="_blank">here</a
			>.
		</p>
		<p class="text-[var(--color-app-text-muted)]">
			Thanks for trying it out. We won't show this message again. Have fun!
		</p>
		<Button variant="primary" onclick={handleAcknowledge}>Got it</Button>
	{/snippet}
</ModalPanel>
