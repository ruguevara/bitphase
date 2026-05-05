<script lang="ts">
	import Button from '../Button/Button.svelte';
	import type { UserScript } from '../../services/user-scripts/types';
	import { userScriptsStore } from '../../stores/user-scripts.svelte';
	import ScriptEditorModal from './ScriptEditorModal.svelte';
	import { open } from '../../services/modal/modal-service';

	let { resolve, dismiss, hasSelection = false } = $props<{
		resolve?: (script?: UserScript) => void;
		dismiss?: () => void;
		hasSelection?: boolean;
	}>();

	let selectedScript = $state<UserScript | null>(null);
	let searchQuery = $state('');

	const filteredScripts = $derived.by(() => {
		let scripts = userScriptsStore.scripts;

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			scripts = scripts.filter(
				(s) =>
					s.name.toLowerCase().includes(query) ||
					s.description.toLowerCase().includes(query)
			);
		}

		return scripts;
	});

	function handleApply() {
		if (selectedScript) {
			resolve?.(selectedScript);
		}
	}

	function handleCancel() {
		resolve?.(undefined);
	}

	function selectScript(script: UserScript) {
		selectedScript = script;
	}

	function handleDoubleClick(script: UserScript) {
		selectedScript = script;
		handleApply();
	}

	async function handleNewScript() {
		const result = await open(ScriptEditorModal, { isNew: true });
		if (result) {
			userScriptsStore.add(result);
			selectedScript = result;
		}
	}

	async function handleEditScript() {
		if (!selectedScript || userScriptsStore.isBuiltIn(selectedScript.id)) return;
		const result = await open(ScriptEditorModal, { script: selectedScript, isNew: false });
		if (result) {
			userScriptsStore.update(result);
			selectedScript = result;
		}
	}

	function handleDeleteScript() {
		if (!selectedScript || userScriptsStore.isBuiltIn(selectedScript.id)) return;
		userScriptsStore.remove(selectedScript.id);
		selectedScript = null;
	}

	function handleExportScript() {
		if (!selectedScript) return;
		const json = userScriptsStore.exportScript(selectedScript);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${selectedScript.id}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleImportScript() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;
			const text = await file.text();
			const script = userScriptsStore.importScript(text);
			if (script) {
				userScriptsStore.add(script);
				selectedScript = script;
			}
		};
		input.click();
	}

	const isBuiltIn = $derived(selectedScript ? userScriptsStore.isBuiltIn(selectedScript.id) : false);
</script>

<div class="flex max-h-[90vh] w-[450px] flex-col overflow-hidden">
	<div
		class="flex shrink-0 items-center justify-between border-b border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-4 py-3">
		<h2 class="text-sm font-bold text-[var(--color-app-text-primary)]">Apply Script</h2>
		<div class="flex gap-1">
			<button
				class="cursor-pointer rounded px-2 py-1 text-xs text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]"
				onclick={handleImportScript}
				title="Import script">
				Import
			</button>
			<button
				class="cursor-pointer rounded px-2 py-1 text-xs text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]"
				onclick={handleNewScript}
				title="Create new script">
				+ New
			</button>
		</div>
	</div>

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if !hasSelection}
			<div
				class="shrink-0 border-b border-l-4 border-[var(--color-app-border)] border-l-[var(--color-pattern-effect)] bg-[color-mix(in_srgb,var(--color-pattern-effect)_14%,var(--color-app-surface))] px-4 py-2 pl-3">
				<p class="text-xs text-[var(--color-app-text-primary)]">
					Select a region in the pattern editor first to apply a script.
				</p>
			</div>
		{/if}

		<div class="p-4">
		<div class="mb-2">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search scripts..."
				class="w-full rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1.5 text-xs text-[var(--color-app-text-primary)] placeholder-[var(--color-app-text-tertiary)] focus:border-[var(--color-app-primary)] focus:outline-none" />
		</div>

		<div
			class="h-48 overflow-y-auto rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)]">
			{#each filteredScripts as script}
				<button
					class="w-full cursor-pointer border-b border-[var(--color-app-border)] px-3 py-2 text-left transition-colors last:border-b-0 {selectedScript?.id ===
					script.id
						? 'bg-[var(--color-app-surface-active)] border-l-2 border-l-[var(--color-app-primary)]'
						: 'hover:bg-[var(--color-app-surface)] border-l-2 border-l-transparent'}"
					onclick={() => selectScript(script)}
					ondblclick={() => handleDoubleClick(script)}>
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium {selectedScript?.id === script.id ? 'text-[var(--color-app-primary)]' : 'text-[var(--color-app-text-primary)]'}">
							{script.name}
						</span>
						{#if userScriptsStore.isBuiltIn(script.id)}
							<span class="rounded bg-[var(--color-app-surface)] px-1 py-0.5 text-[10px] text-[var(--color-app-text-tertiary)]">
								built-in
							</span>
						{/if}
					</div>
					<div class="mt-0.5 text-xs text-[var(--color-app-text-tertiary)]">
						{script.description}
					</div>
				</button>
			{:else}
				<div class="flex h-full items-center justify-center">
					<p class="text-xs text-[var(--color-app-text-tertiary)]">No scripts found</p>
				</div>
			{/each}
		</div>

		{#if selectedScript}
			<div class="mt-2 flex gap-1">
				<button
					class="cursor-pointer rounded px-2 py-1 text-xs text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleEditScript}
					disabled={isBuiltIn}
					title={isBuiltIn ? 'Cannot edit built-in scripts' : 'Edit script'}>
					Edit
				</button>
				<button
					class="cursor-pointer rounded px-2 py-1 text-xs text-[var(--color-app-text-secondary)] hover:bg-[var(--color-app-surface-hover)]"
					onclick={handleExportScript}
					title="Export script">
					Export
				</button>
				<button
					class="cursor-pointer rounded px-2 py-1 text-xs text-[var(--color-pattern-note-off)] hover:bg-[color-mix(in_srgb,var(--color-pattern-note-off)_14%,var(--color-app-surface))] disabled:opacity-50 disabled:cursor-not-allowed"
					onclick={handleDeleteScript}
					disabled={isBuiltIn}
					title={isBuiltIn ? 'Cannot delete built-in scripts' : 'Delete script'}>
					Delete
				</button>
			</div>
		{/if}
	</div>
	</div>

	<div
		class="flex shrink-0 justify-end gap-2 border-t border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-4 py-3">
		<Button variant="secondary" onclick={handleCancel}>Cancel</Button>
		<Button variant="primary" onclick={handleApply} disabled={!selectedScript || !hasSelection}>
			Apply
		</Button>
	</div>
</div>
