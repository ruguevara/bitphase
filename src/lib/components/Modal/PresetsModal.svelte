<script lang="ts">
	import Button from '../Button/Button.svelte';
	import { TreeView } from '../TreeView';
	import { ModalPanel } from '../ModalPanel';
	import { AlertBanner } from '../AlertBanner';
	import type { TreeNode } from '../TreeView/types';
	import type { InstrumentPresetData } from '../../presets/instrument-presets';
	import { getInstrumentPresetTree } from '../../presets/instrument-presets';

	let {
		resolve,
		dismiss,
		presetType = 'instrument'
	}: {
		resolve?: (data: unknown) => void;
		dismiss?: () => void;
		presetType?: 'instrument';
	} = $props();

	let selectedId = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const treeNodes = $derived(getInstrumentPresetTree());

	function handleSelect(node: TreeNode<InstrumentPresetData>): void {
		selectedId = node.id;
		error = null;
	}

	async function handleLoad(): Promise<void> {
		if (!selectedId) return;
		const node = findNode(treeNodes, selectedId);
		if (!node?.data?.load) return;
		loading = true;
		error = null;
		try {
			const text = await node.data.load();
			const parsed: unknown = JSON.parse(text);
			const item = Array.isArray(parsed) ? parsed[0] : parsed;
			if (
				item == null ||
				typeof item !== 'object' ||
				!Array.isArray((item as Record<string, unknown>).rows)
			) {
				throw new Error('Invalid format: expected an instrument object');
			}
			resolve?.(item);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			loading = false;
		}
	}

	function findNode(
		nodes: TreeNode<InstrumentPresetData>[],
		id: string
	): TreeNode<InstrumentPresetData> | null {
		for (const node of nodes) {
			if (node.id === id) return node;
			if (node.children) {
				const found = findNode(node.children, id);
				if (found) return found;
			}
		}
		return null;
	}

	function handleCancel(): void {
		resolve?.(undefined);
	}
</script>

<ModalPanel
	title={presetType === 'instrument' ? 'Instrument presets' : 'Presets'}
	width="w-[420px]">
	{#snippet children()}
		{#if error}
			<AlertBanner class="mb-2">
				{error}
			</AlertBanner>
		{/if}
		{#if treeNodes.length === 0}
			<p class="text-xs text-[var(--color-app-text-muted)]">
				No presets found. Add JSON files under <code class="rounded bg-[var(--color-app-surface-secondary)] px-1">src/presets/instruments/</code> (e.g. bass/, drums/) and they will appear here.
			</p>
		{:else}
			<div
				class="max-h-64 overflow-y-auto rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]"
				role="tree">
				<TreeView
					nodes={treeNodes}
					defaultCollapsed={true}
					selectedId={selectedId}
					onSelect={(node) => handleSelect(node as TreeNode<InstrumentPresetData>)} />
			</div>
			<p class="mt-2 text-xs text-[var(--color-app-text-muted)]">
				Select a preset and click Load.
			</p>
		{/if}
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={handleCancel}>Cancel</Button>
		<Button
			variant="primary"
			onclick={handleLoad}
			disabled={!selectedId || loading}>
			{loading ? 'Loading…' : 'Load'}
		</Button>
	{/snippet}
</ModalPanel>
