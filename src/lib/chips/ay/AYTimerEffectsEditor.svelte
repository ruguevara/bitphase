<script lang="ts">
	import type { Instrument } from '../../models/song';
	import IconCarbonAdd from '~icons/carbon/add';
	import IconCarbonTrashCan from '~icons/carbon/trash-can';
	import Input from '../../components/Input/Input.svelte';
	import SelectableRowNumberCell from '../../components/RowEditorTable/SelectableRowNumberCell.svelte';
	import {
		ROW_SELECTION_STYLES,
		computeSelectionFromClick,
		filterValidSelection,
		isRowSelected as checkRowSelected
	} from '../../utils/row-selection';
	import {
		DEFAULT_AY_SID_PERIOD,
		DEFAULT_AY_SID_PERIOD_DETUNE,
		normalizeAyInstrumentFields,
		syncAyInstrumentTimerRows,
		type AySidPeriodMode,
		type AyTimerRow
	} from './instrument';

	let {
		instrument,
		asHex = false,
		isExpanded = false,
		onInstrumentChange,
		selectedRowIndices = $bindable([])
	}: {
		instrument: Instrument;
		asHex: boolean;
		isExpanded: boolean;
		onInstrumentChange: (instrument: Instrument) => void;
		selectedRowIndices?: number[];
	} = $props();

	let selectionAnchor = $state<number | null>(null);
	let isDragging = $state(false);
	let dragSidValue: boolean | null = $state(null);
	let editorContainerRef: HTMLDivElement | null = $state(null);
	let lastInstrumentId = $state(instrument.id);
	let lastSyncedRowCount = $state(instrument.rows.length);

	type ExtendedInstrument = Instrument & {
		timerRows?: AyTimerRow[];
		timerWaveform?: number[];
		timerWaveformLoop?: number;
		sidPeriodMode?: AySidPeriodMode;
		sidPeriod?: number;
		sidPeriodDetune?: number;
	};

	let fields = $state(normalizeAyInstrumentFields(instrument));
	let timerRows = $derived(fields.timerRows);
	let rowCount = $derived(Math.max(instrument.rows.length, 1));

	function formatNum(value: number): string {
		if (asHex) {
			return value.toString(16).toUpperCase().padStart(1, '0');
		}
		return String(value);
	}

	function formatSignedNum(value: number): string {
		if (asHex) {
			const sign = value < 0 ? '-' : '';
			return sign + Math.abs(value).toString(16).toUpperCase();
		}
		return String(value);
	}

	function parseNum(text: string): number | null {
		const trimmed = text.trim();
		if (asHex) {
			if (!/^[0-9a-fA-F]+$/.test(trimmed)) return null;
			return parseInt(trimmed, 16);
		}
		if (!/^\d+$/.test(trimmed)) return null;
		return parseInt(trimmed, 10);
	}

	function updateInstrument(updates: Partial<ExtendedInstrument>) {
		onInstrumentChange({ ...instrument, ...updates });
	}

	function commitFields(next: ReturnType<typeof normalizeAyInstrumentFields>) {
		fields = next;
		updateInstrument({
			timerRows: next.timerRows,
			timerWaveform: next.timerWaveform,
			timerWaveformLoop: next.timerWaveformLoop,
			sidPeriodMode: next.sidPeriodMode,
			sidPeriod: next.sidPeriod,
			sidPeriodDetune: next.sidPeriodDetune
		});
	}

	function syncFromInstrument() {
		syncAyInstrumentTimerRows(instrument, Math.max(instrument.rows.length, 1));
		fields = normalizeAyInstrumentFields(instrument);
		lastSyncedRowCount = instrument.rows.length;
	}

	function updateSidRow(index: number, sid: boolean) {
		const nextRows = timerRows.map((row, i) => (i === index ? { sid } : row));
		commitFields({ ...fields, timerRows: nextRows });
	}

	function beginDragSid(index: number) {
		isDragging = true;
		dragSidValue = !timerRows[index].sid;
		updateSidRow(index, dragSidValue);
	}

	function dragOverSid(index: number) {
		if (isDragging && dragSidValue !== null) {
			updateSidRow(index, dragSidValue);
		}
	}

	function updateSidPeriod(event: Event) {
		const parsed = parseNum((event.target as HTMLInputElement).value);
		if (parsed === null || parsed < 1) return;
		commitFields({ ...fields, sidPeriod: parsed & 0xffff, sidPeriodMode: 'manual' });
	}

	function updateSidPeriodDetune(event: Event) {
		let parsed = parseSignedNum((event.target as HTMLInputElement).value);
		if (parsed === null) return;
		if (parsed < -4095) parsed = -4095;
		if (parsed > 4095) parsed = 4095;
		commitFields({ ...fields, sidPeriodDetune: parsed, sidPeriodMode: 'auto' });
	}

	function parseSignedNum(text: string): number | null {
		const trimmed = text.trim();
		if (asHex) {
			let sign = 1;
			let temp = trimmed;
			if (temp.startsWith('-')) {
				sign = -1;
				temp = temp.substring(1);
			}
			if (!/^[0-9a-fA-F]+$/.test(temp)) return null;
			return sign * parseInt(temp, 16);
		}
		if (!/^-?\d+$/.test(trimmed)) return null;
		return parseInt(trimmed, 10);
	}

	function setSidPeriodMode(mode: AySidPeriodMode) {
		if (fields.sidPeriodMode === mode) return;
		commitFields({ ...fields, sidPeriodMode: mode });
	}

	function updateWaveformValue(index: number, event: Event) {
		const parsed = parseNum((event.target as HTMLInputElement).value);
		if (parsed === null || parsed < 0 || parsed > 15) return;
		const nextWaveform = [...fields.timerWaveform];
		nextWaveform[index] = parsed;
		commitFields({ ...fields, timerWaveform: nextWaveform });
	}

	function addWaveformStep() {
		if (fields.timerWaveform.length >= 32) return;
		commitFields({ ...fields, timerWaveform: [...fields.timerWaveform, 0] });
	}

	function removeWaveformStep(index: number) {
		if (fields.timerWaveform.length <= 1) return;
		const nextWaveform = fields.timerWaveform.filter((_, i) => i !== index);
		commitFields({ ...fields, timerWaveform: nextWaveform });
	}

	function isRowSelected(index: number): boolean {
		return checkRowSelected(index, selectedRowIndices);
	}

	function handleRowSelect(index: number, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const result = computeSelectionFromClick(index, event, selectedRowIndices, selectionAnchor);
		selectedRowIndices = result.indices;
		selectionAnchor = result.anchor;
		editorContainerRef?.focus();
	}

	$effect(() => {
		if (instrument.id !== lastInstrumentId) {
			lastInstrumentId = instrument.id;
			syncFromInstrument();
			selectedRowIndices = [];
			selectionAnchor = null;
			return;
		}
		if (instrument.rows.length !== lastSyncedRowCount) {
			syncFromInstrument();
		}
	});

	$effect(() => {
		const validIndices = filterValidSelection(selectedRowIndices, rowCount);
		if (validIndices.length !== selectedRowIndices.length) {
			selectedRowIndices = validIndices;
		}
	});

	$effect(() => {
		const stop = () => {
			isDragging = false;
			dragSidValue = null;
		};
		window.addEventListener('mouseup', stop);
		return () => window.removeEventListener('mouseup', stop);
	});
</script>

<div
	class="w-full overflow-x-auto outline-none focus:outline-none"
	bind:this={editorContainerRef}
	tabindex="-1">
	<div class="mt-2 ml-2 flex flex-wrap items-center gap-4">
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-0.5 text-xs {fields.sidPeriodMode === 'auto'
					? 'bg-[var(--color-app-primary)] text-white'
					: 'bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)]'}"
				onclick={() => setSidPeriodMode('auto')}>
				Auto
			</button>
			<button
				type="button"
				class="cursor-pointer rounded px-2 py-0.5 text-xs {fields.sidPeriodMode === 'manual'
					? 'bg-[var(--color-app-primary)] text-white'
					: 'bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)]'}"
				onclick={() => setSidPeriodMode('manual')}>
				Manual
			</button>
		</div>
		{#if fields.sidPeriodMode === 'auto'}
			<label class="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]">
				<span class="shrink-0" title="Added to the current note tone period each tick">Detune:</span>
				<Input
					class="w-20 text-xs"
					value={formatSignedNum(fields.sidPeriodDetune)}
					oninput={updateSidPeriodDetune} />
			</label>
			<span class="text-xs text-[var(--color-app-text-tertiary)]">
				Period = tone period + detune
			</span>
		{:else}
			<label class="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]">
				<span class="shrink-0">SID period:</span>
				<Input
					class="w-20 text-xs"
					value={formatNum(fields.sidPeriod)}
					oninput={updateSidPeriod} />
			</label>
		{/if}
	</div>

	<div class="mt-3 ml-2">
		<div class="mb-2 text-xs text-[var(--color-app-text-muted)]">Waveform</div>
		<div class="flex flex-wrap items-center gap-2">
			{#each fields.timerWaveform as value, index}
				<div class="flex items-center gap-1">
					<input
						type="text"
						class="w-10 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-1 py-0.5 text-center font-mono text-xs text-[var(--color-app-text-secondary)] focus:border-[var(--color-app-primary)] focus:outline-none"
						value={formatNum(value)}
						oninput={(e) => updateWaveformValue(index, e)} />
					{#if fields.timerWaveform.length > 1}
						<button
							class="flex cursor-pointer items-center justify-center rounded p-0.5 text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-pattern-note-off)]"
							onclick={() => removeWaveformStep(index)}
							title="Remove waveform step">
							<IconCarbonTrashCan class="h-3 w-3" />
						</button>
					{/if}
				</div>
			{/each}
			{#if fields.timerWaveform.length < 32}
				<button
					class="flex cursor-pointer items-center justify-center rounded border border-[var(--color-app-border)] px-2 py-0.5 text-xs text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)]"
					onclick={addWaveformStep}
					title="Add waveform step">
					<IconCarbonAdd class="mr-1 h-3 w-3" />
					Add
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-4 flex items-start gap-2 overflow-x-auto">
		<table
			class="row-editor-table table-fixed border-collapse bg-[var(--color-app-surface)] font-mono text-xs select-none">
			<thead>
				<tr>
					<th class={isExpanded ? 'w-14 min-w-14 px-2 py-1.5' : 'px-1 py-1'}>row</th>
					<th
						class={isExpanded ? 'w-12 min-w-12 px-1.5' : 'w-10 px-0.5 text-[0.65rem]'}
						title="SID effect">
						SID
					</th>
				</tr>
			</thead>
			<tbody>
				{#each Array.from({ length: rowCount }, (_, index) => index) as index}
					{@const selected = isRowSelected(index)}
					{@const sidEnabled = timerRows[index]?.sid ?? false}
					<tr class="{isExpanded ? 'h-8' : 'h-7'} {selected ? ROW_SELECTION_STYLES.row : ''}">
						<SelectableRowNumberCell
							{index}
							{selected}
							sizeClass={isExpanded
								? 'w-14 min-w-14 px-2 py-1.5'
								: 'px-1 py-1 text-[0.65rem]'}
							onmousedown={(e) => handleRowSelect(index, e)} />
						<td
							class="{isExpanded
								? 'w-12 min-w-12 px-1.5'
								: 'w-10 px-0.5'} cursor-pointer border border-[var(--color-app-border)] text-center {selected
								? ROW_SELECTION_STYLES.cell
								: sidEnabled
									? 'instrument-cell-boolean-on'
									: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)]'}"
							tabindex="-1"
							onmousedown={() => beginDragSid(index)}
							onmouseover={() => dragOverSid(index)}
							onfocus={() => dragOverSid(index)}>
							{sidEnabled ? '✓' : ''}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
