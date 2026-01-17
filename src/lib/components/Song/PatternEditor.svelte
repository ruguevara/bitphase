<script lang="ts">
	import type { Pattern, Instrument } from '../../models/song';
	import type {
		ChipProcessor,
		TuningTableSupport,
		InstrumentSupport,
		PreviewNoteSupport
	} from '../../chips/base/processor';
	import type { AudioService } from '../../services/audio/audio-service';
	import type { Chip } from '../../chips/types';
	import { getColors } from '../../utils/colors';
	import { getFonts } from '../../utils/fonts';
	import { setupCanvas as setupCanvasUtil } from '../../utils/canvas-utils';
	import { getContext, untrack } from 'svelte';
	import { PATTERN_EDITOR_CONSTANTS } from './types';
	import { playbackStore } from '../../stores/playback.svelte';
	import { getFormatter, getConverter } from '../../chips/registry';
	import { PatternService } from '../../services/pattern/pattern-service';
	import { PatternNavigationService } from '../../services/pattern/pattern-navigation';
	import {
		PatternVisibleRowsService,
		type VisibleRow,
		type VisibleRowsCache
	} from '../../services/pattern/pattern-visible-rows';
	import { PatternEditingService } from '../../services/pattern/pattern-editing';
	import { PatternNoteInput } from '../../services/pattern/editing/pattern-note-input';
	import { PreviewService } from '../../services/audio/preview-service';
	import { PatternEditorRenderer } from '../../ui-rendering/pattern-editor-renderer';
	import { PatternEditorTextParser } from '../../ui-rendering/pattern-editor-text-parser';
	import { Cache } from '../../utils/memoize';
	import { channelMuteStore } from '../../stores/channel-mute.svelte';
	import { PatternFieldDetection } from '../../services/pattern/editing/pattern-field-detection';
	import { PatternValueUpdates } from '../../services/pattern/editing/pattern-value-updates';
	import { EffectField } from '../../services/pattern/editing/effect-field';
	import { undoRedoStore } from '../../stores/undo-redo.svelte';
	import { editorStateStore } from '../../stores/editor-state.svelte';
	import {
		PatternFieldEditAction,
		BulkPatternEditAction,
		type PatternEditContext,
		type CursorPosition
	} from '../../models/actions';
	import {
		ClipboardService,
		type ClipboardContext
	} from '../../services/pattern/clipboard-service';
	import {
		PatternKeyboardShortcutsService,
		type PatternKeyboardShortcutsContext
	} from '../../services/pattern/pattern-keyboard-shortcuts';
	import { EnvelopeModeService } from '../../services/pattern/envelope-mode-service';
	import { PatternRowDataService } from '../../services/pattern/pattern-row-data-service';
	import { SelectionBoundsService } from '../../services/pattern/selection-bounds-service';
	import { envelopePeriodToNote, noteToEnvelopePeriod } from '../../utils/envelope-note-conversion';

	let {
		patterns = $bindable(),
		patternOrder = $bindable(),
		currentPatternOrderIndex = $bindable(0),
		selectedRow = $bindable(0),
		isActive = false,
		onfocus,
		initAllChips,
		getSpeedForChip,
		chip,
		chipProcessor,
		tuningTable,
		speed,
		instruments,
		tables = []
	}: {
		patterns: Pattern[];
		patternOrder: number[];
		currentPatternOrderIndex: number;
		selectedRow: number;
		isActive?: boolean;
		onfocus?: () => void;
		initAllChips?: () => void;
		getSpeedForChip?: (chipIndex: number) => number | null;
		chip: Chip;
		chipProcessor: ChipProcessor;
		tuningTable: number[];
		speed: number;
		instruments: Instrument[];
		tables?: import('../../models/project').Table[];
	} = $props();

	const services: { audioService: AudioService } = getContext('container');

	const formatter = getFormatter(chip);
	const converter = getConverter(chip);
	const schema = chip.schema;
	const previewService = new PreviewService();
	const pressedKeyChannels = new Map<string, number>();
	let previewInitialized = false;

	$effect(() => {
		if (chipProcessor && chipProcessor.isAudioNodeAvailable()) {
			if (chip.type === 'ay') {
				const withTuningTables = chipProcessor as ChipProcessor & TuningTableSupport;
				const withInstruments = chipProcessor as ChipProcessor & InstrumentSupport;

				withTuningTables.sendInitTuningTable(tuningTable);
				withInstruments.sendInitInstruments(instruments);
				chipProcessor.sendInitTables(tables);
				previewInitialized = true;
			}
		}
	});

	let previousEnvelopeAsNote: boolean | undefined;

	$effect(() => {
		if (chip.type === 'ay') {
			const ayFormatter = formatter as { tuningTable?: number[]; envelopeAsNote?: boolean };
			ayFormatter.tuningTable = tuningTable;
			const newEnvelopeAsNote = editorStateStore.get().envelopeAsNote;

			const result = EnvelopeModeService.handleModeChange(
				{ patterns },
				previousEnvelopeAsNote ?? newEnvelopeAsNote,
				newEnvelopeAsNote
			);

			ayFormatter.envelopeAsNote = newEnvelopeAsNote;
			previousEnvelopeAsNote = newEnvelopeAsNote;

			if (result.shouldRedraw) {
				clearAllCaches();
				patterns = result.updatedPatterns;
				untrack(() => {
					if (ctx && renderer && textParser) {
						draw();
					}
				});
			}
		}
	});

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let containerDiv: HTMLDivElement;

	let COLORS = getColors();
	let FONTS = getFonts();

	let canvasWidth = $state(PATTERN_EDITOR_CONSTANTS.DEFAULT_CANVAS_WIDTH);
	let canvasHeight = $state(PATTERN_EDITOR_CONSTANTS.DEFAULT_CANVAS_HEIGHT);
	let lineHeight =
		PATTERN_EDITOR_CONSTANTS.FONT_SIZE * PATTERN_EDITOR_CONSTANTS.LINE_HEIGHT_MULTIPLIER;

	let selectedColumn = $state(0);

	let selectionStartRow = $state<number | null>(null);
	let selectionStartColumn = $state<number | null>(null);
	let selectionEndRow = $state<number | null>(null);
	let selectionEndColumn = $state<number | null>(null);
	let isSelecting = $state(false);
	let mouseDownCell: { row: number; column: number } | null = null;
	let hadSelectionBeforeClick = $state(false);
	let autoScrollInterval: number | null = null;
	let autoScrollDirection: number = 0;
	let isEnterKeyHeld = $state(false);

	const rowStringCache = new Cache<string, string>(500);
	const patternGenericCache = new Cache<number, ReturnType<typeof converter.toGeneric>>(100);
	const cellPositionsCache = new Cache<
		string,
		ReturnType<PatternEditorTextParser['getCellPositions']>
	>(500);
	const rowSegmentsCache = new Cache<
		string,
		ReturnType<PatternEditorTextParser['parseRowString']>
	>(500);
	let textParser: PatternEditorTextParser | null = $state(null);
	let renderer: PatternEditorRenderer | null = $state(null);
	let lastVisibleRowsCache: VisibleRowsCache | null = null;

	const MANUAL_PATTERN_CHANGE_TIMEOUT_MS = 1000;

	let currentPattern = $derived.by(() => {
		const patternId = patternOrder[currentPatternOrderIndex];
		return findOrCreatePattern(patternId);
	});

	function findOrCreatePattern(patternId: number): Pattern {
		const { pattern, newPatterns } = PatternService.findOrCreatePattern(patterns, patternId);
		if (newPatterns !== patterns) {
			patterns = newPatterns;
		}
		return pattern;
	}

	function clearAllCaches(): void {
		PatternRowDataService.clearAllCaches(
			rowStringCache,
			patternGenericCache,
			cellPositionsCache,
			rowSegmentsCache
		);
		lastVisibleRowsCache = null;
	}

	$effect(() => {
		patterns.length;
		patternOrder.length;
		clearAllCaches();
	});

	function ensurePatternExists(): Pattern | null {
		return currentPattern;
	}

	function getSelectionBounds() {
		return SelectionBoundsService.getSelectionBounds({
			selectionStartRow,
			selectionStartColumn,
			selectionEndRow,
			selectionEndColumn
		});
	}

	function updatePatternInArray(updatedPattern: Pattern): void {
		patterns = PatternService.updatePatternInArray(patterns, updatedPattern);
	}

	function createEditContext(): PatternEditContext {
		return {
			patterns,
			updatePatterns: (newPatterns: Pattern[]) => {
				patterns = newPatterns;
				clearAllCaches();
				draw();
			},
			setCursor: (position: CursorPosition) => {
				selectedRow = position.row;
				selectedColumn = position.column;
				currentPatternOrderIndex = position.patternOrderIndex;
				clearAllCaches();
				draw();
			}
		};
	}

	function getCursorPosition(): CursorPosition {
		return {
			row: selectedRow,
			column: selectedColumn,
			patternOrderIndex: currentPatternOrderIndex
		};
	}

	function recordPatternEdit(oldPattern: Pattern, newPattern: Pattern): void {
		const action = new PatternFieldEditAction(
			createEditContext(),
			oldPattern,
			newPattern,
			getCursorPosition()
		);
		undoRedoStore.pushAction(action);
	}

	function recordBulkPatternEdit(oldPattern: Pattern, newPattern: Pattern): void {
		const action = new BulkPatternEditAction(
			createEditContext(),
			oldPattern,
			newPattern,
			getCursorPosition()
		);
		undoRedoStore.pushAction(action);
	}

	export function resetToBeginning() {
		selectedRow = 0;
		currentPatternOrderIndex = 0;
		userManuallyChangedPattern = false;
	}

	export function setPatternOrderIndex(index: number) {
		if (index >= 0 && index < patternOrder.length) {
			currentPatternOrderIndex = index;
			userManuallyChangedPattern = true;
			lastManualPatternChangeTime = performance.now();
		}
	}

	export function setSelectedRow(row: number) {
		const pattern = currentPattern || ensurePatternExists();
		if (pattern && row >= 0 && row < pattern.length) {
			selectedRow = row;
		}
	}

	export function playFromCursor() {
		if (!chipProcessor || !chipProcessor.isAudioNodeAvailable()) {
			console.warn('Audio processor not available or not initialized');
			return;
		}

		try {
			if (!currentPattern) {
				console.warn('No pattern selected');
				return;
			}

			initAllChips?.();
			services.audioService.playFromRow(
				selectedRow,
				currentPatternOrderIndex,
				getSpeedForChip
			);
		} catch (error) {
			console.error('Error during playback from cursor:', error);
			services.audioService.stop();
		}
	}

	export function togglePlayback() {
		if (!chipProcessor || !chipProcessor.isAudioNodeAvailable()) {
			console.warn('Audio processor not available or not initialized');
			return;
		}

		try {
			if (!services.audioService.playing) {
				if (!currentPattern) {
					console.warn('No pattern selected');
					return;
				}

				initAllChips?.();
				services.audioService.play();
			}
		} catch (error) {
			console.error('Error during playback toggle:', error);
			services.audioService.stop();
		}
	}

	function initPlayback() {
		chipProcessor.sendInitPattern(currentPattern, currentPatternOrderIndex);
		chipProcessor.sendInitSpeed(speed);

		if (chip.type === 'ay') {
			const withTuningTables = chipProcessor as ChipProcessor & TuningTableSupport;
			const withInstruments = chipProcessor as ChipProcessor & InstrumentSupport;

			withTuningTables.sendInitTuningTable(tuningTable);
			withInstruments.sendInitInstruments(instruments);
		}
	}

	function pausePlayback() {
		services.audioService.stop();
	}

	function getCellPositions(
		rowString: string,
		rowIndex: number
	): ReturnType<PatternEditorTextParser['getCellPositions']> {
		if (!textParser) return [];
		return textParser.getCellPositions(rowString, rowIndex);
	}

	function getTotalCellCount(rowString: string): number {
		return rowString.replace(/\s/g, '').length;
	}

	function getVisibleRows(pattern: Pattern): VisibleRow[] {
		const { rows, cache } = PatternVisibleRowsService.getVisibleRows(
			pattern,
			{
				patterns,
				patternOrder,
				currentPatternOrderIndex,
				selectedRow,
				canvasHeight,
				lineHeight,
				createPatternIfMissing: (patternId: number) => {
					const newPattern = PatternService.createEmptyPattern(patternId);
					patterns = [...patterns, newPattern];
					return newPattern;
				}
			},
			lastVisibleRowsCache
		);
		lastVisibleRowsCache = cache;
		return rows;
	}

	function setupCanvas() {
		if (!canvas) return;

		ctx = canvas.getContext('2d')!;

		try {
			updateSize();

			setupCanvasUtil({
				canvas,
				ctx,
				width: canvasWidth,
				height: canvasHeight,
				fontSize: PATTERN_EDITOR_CONSTANTS.FONT_SIZE,
				fonts: FONTS,
				textBaseline: 'middle'
			});

			textParser = new PatternEditorTextParser(
				schema,
				formatter,
				COLORS,
				ctx,
				rowSegmentsCache,
				cellPositionsCache
			);

			renderer = new PatternEditorRenderer({
				ctx,
				colors: COLORS,
				canvasWidth,
				lineHeight,
				schema
			});
		} catch (error) {
			console.error('Error during canvas setup:', error);
		}
	}

	function getChipIndex(): number {
		return services.audioService.chipProcessors.findIndex((p) => p === chipProcessor);
	}

	function getChannelMutedState(pattern: Pattern): boolean[] {
		const chipIndex = getChipIndex();
		return pattern.channels.map(
			(_, index) => chipIndex >= 0 && channelMuteStore.isChannelMuted(chipIndex, index)
		);
	}

	function getPatternRowData(pattern: Pattern, rowIndex: number): string {
		return PatternRowDataService.getRowData({
			pattern,
			rowIndex,
			converter,
			formatter,
			schema,
			patternGenericCache,
			rowStringCache
		});
	}

	function draw() {
		if (!ctx || !renderer || !textParser) return;

		renderer.drawBackground(canvasHeight);

		const visibleRows = getVisibleRows(currentPattern);

		for (const row of visibleRows) {
			const y = row.displayIndex * lineHeight;

			if (row.isEmpty) {
				continue;
			}

			if (row.isGhost) {
				ctx.globalAlpha = 0.3;
			} else {
				ctx.globalAlpha = 1.0;
			}

			const patternToRender = findOrCreatePattern(row.patternIndex);
			if (row.rowIndex >= 0 && row.rowIndex < patternToRender.length) {
				const rowString = getPatternRowData(patternToRender, row.rowIndex);

				if (!textParser || !renderer) continue;
				const segments = textParser.parseRowString(rowString, row.rowIndex);
				const cellPositions = getCellPositions(rowString, row.rowIndex);
				const channelMuted = getChannelMutedState(patternToRender);

				const bounds = getSelectionBounds();
				const isInSelection =
					bounds && row.rowIndex >= bounds.minRow && row.rowIndex <= bounds.maxRow;

				let selectionStartCol: number | null = null;
				let selectionEndCol: number | null = null;

				if (isInSelection && bounds) {
					selectionStartCol = bounds.minCol;
					selectionEndCol = bounds.maxCol;
				}

				renderer.drawRow({
					rowString,
					y,
					isSelected: row.isSelected && isActive,
					rowIndex: row.rowIndex,
					selectedColumn,
					segments,
					cellPositions,
					channelMuted,
					selectionStartCol,
					selectionEndCol
				});
			}
		}

		ctx.globalAlpha = 1.0;

		if (currentPattern) {
			const patternToRender = findOrCreatePattern(currentPattern.id);
			const firstVisibleRow = visibleRows.find((r) => !r.isEmpty);
			if (
				firstVisibleRow &&
				firstVisibleRow.rowIndex >= 0 &&
				firstVisibleRow.rowIndex < patternToRender.length
			) {
				const rowString = getPatternRowData(patternToRender, firstVisibleRow.rowIndex);

				const channelLabels =
					schema.channelLabels || patternToRender.channels.map((ch) => ch.label);
				const channelMuted = getChannelMutedState(patternToRender);

				renderer.drawChannelLabels({
					rowString,
					channelLabels,
					channelMuted
				});
			}
		}
	}

	function moveRow(delta: number) {
		if (playbackStore.isPlaying) return;

		const pattern = currentPattern || ensurePatternExists();
		if (!pattern) return;

		const navigationState = PatternNavigationService.moveRow(
			{
				selectedRow,
				currentPatternOrderIndex,
				selectedColumn
			},
			{
				patterns,
				patternOrder,
				currentPattern: pattern,
				converter,
				formatter,
				schema,
				getCellPositions
			},
			delta
		);

		selectedRow = navigationState.selectedRow;
		if (currentPatternOrderIndex !== navigationState.currentPatternOrderIndex) {
			currentPatternOrderIndex = navigationState.currentPatternOrderIndex;
			userManuallyChangedPattern = true;
			lastManualPatternChangeTime = performance.now();
		}

		const updatedPattern = currentPattern || ensurePatternExists();
		if (updatedPattern) {
			const updatedState = PatternNavigationService.moveColumn(navigationState, {
				patterns,
				patternOrder,
				currentPattern: updatedPattern,
				converter,
				formatter,
				schema,
				getCellPositions
			});
			selectedColumn = updatedState.selectedColumn;
		}
	}

	function moveColumn(delta: number) {
		const pattern = currentPattern || ensurePatternExists();
		if (!pattern) return;

		const navigationState = PatternNavigationService.moveColumnByDelta(
			{
				selectedRow,
				currentPatternOrderIndex,
				selectedColumn
			},
			{
				patterns,
				patternOrder,
				currentPattern: pattern,
				converter,
				formatter,
				schema,
				getCellPositions
			},
			delta
		);

		selectedColumn = navigationState.selectedColumn;
	}

	export function handleKeyDownFromMenu(event: KeyboardEvent) {
		handleKeyDown(event);
	}

	function createShortcutsContext(): PatternKeyboardShortcutsContext {
		const patternId = patternOrder[currentPatternOrderIndex];
		const pattern = findOrCreatePattern(patternId);

		return {
			isPlaying: playbackStore.isPlaying,
			selectedColumn,
			selectedRow,
			currentPatternOrderIndex,
			pattern,
			hasSelection,
			onUndo: () => undoRedoStore.undo(),
			onRedo: () => undoRedoStore.redo(),
			onCopy: copySelection,
			onCut: cutSelection,
			onPaste: pasteSelection,
			onDelete: deleteSelection,
			onSelectAll: (column: number, startRow: number, endRow: number) => {
				selectionStartRow = startRow;
				selectionStartColumn = column;
				selectionEndRow = endRow;
				selectionEndColumn = column;
				draw();
			},
			onTogglePlayback: () => {
				playbackStore.isPlaying = true;
				togglePlayback();
			},
			onPausePlayback: () => {
				playbackStore.isPlaying = false;
				pausePlayback();
			},
			onPlayFromCursor: () => {
				services.audioService.playFromRow(selectedRow, currentPatternOrderIndex, getSpeedForChip);
			},
			onMoveRow: moveRow,
			onMoveColumn: moveColumn,
			onSetSelectedRow: (row: number) => {
				selectedRow = row;
			},
			onSetSelectedColumn: (column: number) => {
				selectedColumn = column;
			},
			onSetCurrentPatternOrderIndex: (index: number) => {
				currentPatternOrderIndex = index;
			},
			onClearSelection: () => {
				selectionStartRow = null;
				selectionStartColumn = null;
				selectionEndRow = null;
				selectionEndColumn = null;
				draw();
			},
			onSetSelectionAnchor: (row: number, column: number) => {
				selectionStartRow = row;
				selectionStartColumn = column;
			},
			onExtendSelection: (row: number, column: number) => {
				selectionEndRow = row;
				selectionEndColumn = column;
				draw();
			},
			onIncrementFieldValue: (delta: number, isOctaveIncrement?: boolean) => {
				incrementFieldValue(delta, isOctaveIncrement);
			},
			navigationContext: {
				patterns,
				patternOrder,
				currentPattern: pattern,
				converter,
				formatter,
				schema,
				getCellPositions
			}
		};
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.repeat && !isEnterKeyHeld) {
			event.preventDefault();
			isEnterKeyHeld = true;
			playFromCursor();
			return;
		}

		const shortcutsContext = createShortcutsContext();
		const result = PatternKeyboardShortcutsService.handleKeyDown(event, shortcutsContext);

		if (result.handled) {
			if (result.shouldPreventDefault) {
				event.preventDefault();
			}
			return;
		}

		const selection = window.getSelection();
		if (selection && selection.toString().length > 0) {
			selection.removeAllRanges();
		}

		const patternId = patternOrder[currentPatternOrderIndex];
		const pattern = findOrCreatePattern(patternId);

		const rowString = getPatternRowData(pattern, selectedRow);
		const cellPositions = getCellPositions(rowString, selectedRow);
		const segments = textParser ? textParser.parseRowString(rowString, selectedRow) : undefined;

		const fieldInfoBeforeEdit = PatternEditingService.getFieldAtCursor({
			pattern,
			selectedRow,
			selectedColumn,
			cellPositions,
			segments,
			converter,
			formatter,
			schema,
			tuningTable
		});

		const editingResult = PatternEditingService.handleKeyInput(
			{
				pattern,
				selectedRow,
				selectedColumn,
				cellPositions,
				segments,
				converter,
				formatter,
				schema,
				tuningTable
			},
			event.key
		);

		if (editingResult) {
			event.preventDefault();
			recordPatternEdit(pattern, editingResult.updatedPattern);
			updatePatternInArray(editingResult.updatedPattern);

			if (editingResult.shouldMoveNext) {
				moveColumn(1);
			}

			if (
				!playbackStore.isPlaying &&
				fieldInfoBeforeEdit &&
				fieldInfoBeforeEdit.channelIndex >= 0
			) {
				if (
					chipProcessor &&
					'playPreviewNote' in chipProcessor &&
					!pressedKeyChannels.has(event.key)
				) {
					const processor = chipProcessor as ChipProcessor & PreviewNoteSupport;
					const isNoteField = fieldInfoBeforeEdit.fieldType === 'note';
					previewService.playFromContext(
						processor,
						editingResult.updatedPattern,
						fieldInfoBeforeEdit.channelIndex,
						selectedRow,
						schema,
						isNoteField
					);
					pressedKeyChannels.set(event.key, fieldInfoBeforeEdit.channelIndex);
				}
			}

			const step = editorStateStore.get().step;
			if (step > 0) {
				moveRow(step);
			}

			clearAllCaches();
			draw();
		}
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (event.key === 'Enter' && isEnterKeyHeld) {
			isEnterKeyHeld = false;
			pausePlayback();
			return;
		}

		const channel = pressedKeyChannels.get(event.key);
		if (channel !== undefined) {
			if (chipProcessor && 'stopPreviewNote' in chipProcessor) {
				const processor = chipProcessor as ChipProcessor & PreviewNoteSupport;
				previewService.stopNote(processor, channel);
			}
			pressedKeyChannels.delete(event.key);
		}
	}

	function handleWheel(event: WheelEvent) {
		if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
			return;
		}

		event.preventDefault();
		moveRow(Math.sign(event.deltaY));
	}

	function startAutoScroll(direction: number): void {
		if (autoScrollInterval !== null || direction === 0) return;

		autoScrollDirection = direction;
		autoScrollInterval = window.setInterval(() => {
			moveRow(autoScrollDirection);
		}, 50);
	}

	function stopAutoScroll(): void {
		if (autoScrollInterval !== null) {
			clearInterval(autoScrollInterval);
			autoScrollInterval = null;
			autoScrollDirection = 0;
		}
	}

	function handleGlobalMouseMove(event: MouseEvent): void {
		if (!canvas || !isSelecting) return;

		const rect = canvas.getBoundingClientRect();
		const y = event.clientY - rect.top;

		const scrollMargin = lineHeight * 2;
		const isAboveCanvas = event.clientY < rect.top;
		const isBelowCanvas = event.clientY > rect.bottom;
		const isNearTop = y < lineHeight + scrollMargin;
		const isNearBottom = y > canvasHeight - scrollMargin;

		if (isAboveCanvas || isNearTop) {
			startAutoScroll(-1);
		} else if (isBelowCanvas || isNearBottom) {
			startAutoScroll(1);
		} else {
			stopAutoScroll();
		}
	}

	let isHoveringLabel = $state(false);

	function handleMouseMove(event: MouseEvent): void {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const y = event.clientY - rect.top;

		const wasHovering = isHoveringLabel;
		isHoveringLabel = y <= lineHeight;

		if (wasHovering !== isHoveringLabel) {
			canvas.style.cursor = isHoveringLabel ? 'pointer' : 'default';
		}
	}

	function handleMouseLeave(): void {
		if (canvas) {
			canvas.style.cursor = 'default';
			isHoveringLabel = false;
		}
	}

	function handleMouseEnter(): void {
		if (canvas) {
			canvas.focus();
			const selection = window.getSelection();
			if (selection) {
				selection.removeAllRanges();
			}
			onfocus?.();
		}
	}

	function findCellAtPosition(x: number, y: number): { row: number; column: number } | null {
		if (!canvas || !currentPattern || !renderer || !textParser) return null;

		const patternToRender = findOrCreatePattern(currentPattern.id);

		if (y <= lineHeight) return null;

		const visibleRows = getVisibleRows(currentPattern);

		let closestRow: (typeof visibleRows)[0] | null = null;
		let minRowDistance = Infinity;

		for (const row of visibleRows) {
			if (row.isEmpty || row.rowIndex < 0) continue;

			const rowY = row.displayIndex * lineHeight;
			const rowCenterY = rowY + lineHeight / 2;
			const distance = Math.abs(y - rowCenterY);

			if (distance < minRowDistance) {
				minRowDistance = distance;
				closestRow = row;
			}
		}

		if (!closestRow) return null;

		const rowString = getPatternRowData(patternToRender, closestRow.rowIndex);
		const cellPositions = getCellPositions(rowString, closestRow.rowIndex);

		let closestColumn = 0;
		let minDistance = Infinity;

		for (let i = 0; i < cellPositions.length; i++) {
			const cell = cellPositions[i];
			if (cell.x === undefined) continue;

			const cellCenter = cell.x + (cell.width || 0) / 2;
			const distance = Math.abs(x - cellCenter);
			if (distance < minDistance) {
				minDistance = distance;
				closestColumn = i;
			}
		}

		return { row: closestRow.rowIndex, column: closestColumn };
	}

	function handleCanvasMouseDown(event: MouseEvent): void {
		if (!canvas || !currentPattern || !renderer || !textParser) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const patternToRender = findOrCreatePattern(currentPattern.id);

		if (y <= lineHeight) {
			const visibleRows = getVisibleRows(currentPattern);
			const firstVisibleRow = visibleRows.find((r) => !r.isEmpty);
			if (
				!firstVisibleRow ||
				firstVisibleRow.rowIndex < 0 ||
				firstVisibleRow.rowIndex >= patternToRender.length
			)
				return;

			const rowString = getPatternRowData(patternToRender, firstVisibleRow.rowIndex);
			const channelPositions = renderer.calculateChannelPositions(rowString);

			for (let i = 0; i < channelPositions.length; i++) {
				const channelStart = channelPositions[i];
				const channelEnd =
					i < channelPositions.length - 1 ? channelPositions[i + 1] : canvasWidth;

				if (x >= channelStart && x < channelEnd) {
					const chipIndex = getChipIndex();
					if (chipIndex >= 0) {
						channelMuteStore.toggleChannel(chipIndex, i);
						const isMuted = channelMuteStore.isChannelMuted(chipIndex, i);
						chipProcessor.updateParameter(`channelMute_${i}`, isMuted);
						draw();
					}
					break;
				}
			}
			return;
		}

		const cell = findCellAtPosition(x, y);
		if (!cell) {
			selectionStartRow = null;
			selectionStartColumn = null;
			selectionEndRow = null;
			selectionEndColumn = null;
			mouseDownCell = null;
			draw();
			return;
		}

		if (playbackStore.isPlaying) {
			selectedColumn = cell.column;
			canvas.focus();
			draw();
			return;
		}

		mouseDownCell = { row: cell.row, column: cell.column };
		hadSelectionBeforeClick = hasSelection();

		if (event.shiftKey && selectionStartRow !== null) {
			selectionEndRow = cell.row;
			selectionEndColumn = cell.column;
			selectedRow = cell.row;
			selectedColumn = cell.column;
		} else {
			selectionStartRow = cell.row;
			selectionStartColumn = cell.column;
			selectionEndRow = cell.row;
			selectionEndColumn = cell.column;
			isSelecting = true;
			window.addEventListener('mousemove', handleGlobalMouseMove);
			window.addEventListener('mouseup', handleCanvasMouseUp);
		}

		canvas.focus();
		draw();
	}

	function handleCanvasMouseMove(event: MouseEvent): void {
		if (!canvas || !currentPattern || !renderer || !textParser) return;
		if (!isSelecting || !mouseDownCell || playbackStore.isPlaying) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const cell = findCellAtPosition(x, y);
		if (!cell) return;

		selectionEndRow = cell.row;
		selectionEndColumn = cell.column;
		draw();
	}

	function handleCanvasMouseUp(): void {
		stopAutoScroll();
		window.removeEventListener('mousemove', handleGlobalMouseMove);
		window.removeEventListener('mouseup', handleCanvasMouseUp);
		if (isSelecting && mouseDownCell) {
			if (
				selectionStartRow === selectionEndRow &&
				selectionStartColumn === selectionEndColumn
			) {
				selectionStartRow = null;
				selectionStartColumn = null;
				selectionEndRow = null;
				selectionEndColumn = null;
				if (!hadSelectionBeforeClick && !playbackStore.isPlaying) {
					selectedRow = mouseDownCell.row;
				}
				if (!hadSelectionBeforeClick) {
					selectedColumn = mouseDownCell.column;
				}
			}
		}
		isSelecting = false;
		mouseDownCell = null;
		hadSelectionBeforeClick = false;
		draw();
	}

	function hasSelection(): boolean {
		return (
			selectionStartRow !== null &&
			selectionStartColumn !== null &&
			selectionEndRow !== null &&
			selectionEndColumn !== null &&
			(selectionStartRow !== selectionEndRow || selectionStartColumn !== selectionEndColumn)
		);
	}

	function getDefaultValueForField(fieldType: string, fieldKey: string): string | number {
		if (fieldType === 'note') {
			return '---';
		}
		if (fieldKey === 'effect' || fieldKey === 'envelopeEffect') {
			return { effect: 0, delay: 0, parameter: 0 } as unknown as string | number;
		}
		if (fieldType === 'hex' || fieldType === 'dec' || fieldType === 'symbol') {
			return 0;
		}
		return '';
	}

	function createClipboardContext(): ClipboardContext {
		const patternId = patternOrder[currentPatternOrderIndex];
		const pattern = findOrCreatePattern(patternId);

		return {
			pattern,
			selectedRow,
			selectedColumn,
			hasSelection: hasSelection(),
			getSelectionBounds,
			getCellPositions,
			getPatternRowData,
			createEditingContext: (pat: Pattern, row: number, col: number) => {
				const rowString = getPatternRowData(pat, row);
				const cellPositions = getCellPositions(rowString, row);
				const segments = textParser ? textParser.parseRowString(rowString, row) : undefined;

				return {
					pattern: pat,
					selectedRow: row,
					selectedColumn: col,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				};
			}
		};
	}

	function copySelection(): void {
		ClipboardService.copySelection(createClipboardContext());
	}

	function cutSelection(): void {
		copySelection();
		deleteSelection();
	}

	function pasteSelection(): void {
		const patternId = patternOrder[currentPatternOrderIndex];
		const originalPattern = findOrCreatePattern(patternId);

		ClipboardService.pasteSelection(createClipboardContext(), (updatedPattern) => {
			recordBulkPatternEdit(originalPattern, updatedPattern);
			updatePatternInArray(updatedPattern);
			clearAllCaches();
			draw();
		});
	}

	function deleteSelection(): void {
		if (!hasSelection()) return;

		const patternId = patternOrder[currentPatternOrderIndex];
		const originalPattern = findOrCreatePattern(patternId);
		let pattern = originalPattern;

		const bounds = getSelectionBounds();
		if (!bounds) return;

		const { minRow, maxRow, minCol, maxCol } = bounds;

		const cellsToDelete: Array<{ row: number; col: number }> = [];

		for (let row = minRow; row <= maxRow && row < pattern.length; row++) {
			const rowString = getPatternRowData(pattern, row);
			const cellPositions = getCellPositions(rowString, row);
			for (let col = minCol; col <= maxCol && col < cellPositions.length; col++) {
				cellsToDelete.push({ row, col });
			}
		}

		for (const { row, col } of cellsToDelete) {
			const rowString = getPatternRowData(pattern, row);
			const cellPositions = getCellPositions(rowString, row);
			const segments = textParser ? textParser.parseRowString(rowString, row) : undefined;

			const cell = cellPositions[col];
			if (!cell.fieldKey) continue;

			const fieldInfo = PatternFieldDetection.detectFieldAtCursor({
				pattern,
				selectedRow: row,
				selectedColumn: col,
				cellPositions,
				segments,
				converter,
				formatter,
				schema
			});
			if (!fieldInfo) continue;

			const field = PatternValueUpdates.getFieldDefinition(
				{
					pattern,
					selectedRow: row,
					selectedColumn: col,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				},
				cell.fieldKey
			);
			if (!field) continue;

			const defaultValue = getDefaultValueForField(field.type, cell.fieldKey);
			pattern = PatternValueUpdates.updateFieldValue(
				{
					pattern,
					selectedRow: row,
					selectedColumn: col,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				},
				fieldInfo,
				defaultValue
			);
		}

		recordBulkPatternEdit(originalPattern, pattern);
		updatePatternInArray(pattern);

		selectionStartRow = null;
		selectionStartColumn = null;
		selectionEndRow = null;
		selectionEndColumn = null;

		clearAllCaches();
		draw();
	}

	function updateFieldAtPosition(
		pattern: Pattern,
		row: number,
		col: number,
		fieldInfo: any,
		currentValue: string | number,
		delta: number,
		isOctaveIncrement: boolean
	): Pattern {
		const rowString = getPatternRowData(pattern, row);
		const cellPositions = getCellPositions(rowString, row);
		const segments = textParser ? textParser.parseRowString(rowString, row) : undefined;

		const fieldDefinition = PatternValueUpdates.getFieldDefinition(
			{
				pattern,
				selectedRow: row,
				selectedColumn: col,
				cellPositions,
				segments,
				converter,
				formatter,
				schema
			},
			fieldInfo.fieldKey
		);

		let adjustedDelta = delta;
		if (fieldInfo.fieldType === 'note' && isOctaveIncrement) {
			adjustedDelta = delta * 12;
		}

		if (fieldInfo.fieldType === 'note') {
			const newValue = PatternValueUpdates.incrementNoteValue(
				currentValue as string,
				adjustedDelta
			);
			return PatternValueUpdates.updateFieldValue(
				{
					pattern,
					selectedRow: row,
					selectedColumn: col,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				},
				fieldInfo,
				newValue
			);
		} else if (fieldInfo.fieldKey === 'envelopeValue' && editorStateStore.get().envelopeAsNote && tuningTable) {
			const currentPeriod = currentValue as number;
			const noteIndex = envelopePeriodToNote(currentPeriod, tuningTable);
			if (noteIndex !== null) {
				const semitonesDelta = isOctaveIncrement ? delta * 12 : delta;
				const newNoteIndex = Math.max(0, Math.min(tuningTable.length - 1, noteIndex + semitonesDelta));
				const newPeriod = noteToEnvelopePeriod(newNoteIndex, tuningTable);
				return PatternValueUpdates.updateFieldValue(
					{
						pattern,
						selectedRow: row,
						selectedColumn: col,
						cellPositions,
						segments,
						converter,
						formatter,
						schema
					},
					fieldInfo,
					newPeriod
				);
			}
			return pattern;
		} else if (
			(fieldInfo.fieldType === 'hex' ||
				fieldInfo.fieldType === 'dec' ||
				fieldInfo.fieldType === 'symbol') &&
			!EffectField.isEffectField(fieldInfo.fieldKey)
		) {
			const newValue = PatternValueUpdates.incrementNumericValue(
				currentValue as number,
				delta,
				fieldInfo.fieldType,
				fieldDefinition?.length
			);
			return PatternValueUpdates.updateFieldValue(
				{
					pattern,
					selectedRow: row,
					selectedColumn: col,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				},
				fieldInfo,
				newValue
			);
		} else {
			return pattern;
		}
	}

	function incrementFieldValue(delta: number, isOctaveIncrement = false): void {
		const patternId = patternOrder[currentPatternOrderIndex];
		const originalPattern = findOrCreatePattern(patternId);
		let pattern = originalPattern;

		if (hasSelection()) {
			const bounds = getSelectionBounds();
			if (!bounds) return;

			const { minRow, maxRow, minCol, maxCol } = bounds;

			// First pass: check if selection contains any notes
			let hasNotes = false;
			for (let row = minRow; row <= maxRow && row < pattern.length; row++) {
				const rowString = getPatternRowData(pattern, row);
				const cellPositions = getCellPositions(rowString, row);
				const segments = textParser ? textParser.parseRowString(rowString, row) : undefined;

				for (let col = minCol; col <= maxCol && col < cellPositions.length; col++) {
					const cell = cellPositions[col];
					if (!cell.fieldKey) continue;

					const fieldInfo = PatternFieldDetection.detectFieldAtCursor({
						pattern,
						selectedRow: row,
						selectedColumn: col,
						cellPositions,
						segments,
						converter,
						formatter,
						schema
					});
					if (fieldInfo && fieldInfo.fieldType === 'note') {
						hasNotes = true;
						break;
					}
				}
				if (hasNotes) break;
			}

			// Second pass: collect cells to update based on whether selection has notes
			const cellsToUpdate: Array<{
				row: number;
				col: number;
				fieldInfo: any;
				currentValue: string | number;
			}> = [];

			for (let row = minRow; row <= maxRow && row < pattern.length; row++) {
				const rowString = getPatternRowData(pattern, row);
				const cellPositions = getCellPositions(rowString, row);
				const segments = textParser ? textParser.parseRowString(rowString, row) : undefined;

				for (let col = minCol; col <= maxCol && col < cellPositions.length; col++) {
					const cell = cellPositions[col];
					if (!cell.fieldKey) continue;

					const fieldInfo = PatternFieldDetection.detectFieldAtCursor({
						pattern,
						selectedRow: row,
						selectedColumn: col,
						cellPositions,
						segments,
						converter,
						formatter,
						schema
					});
					if (!fieldInfo) continue;

					const currentValue = PatternValueUpdates.getFieldValue(
						{
							pattern,
							selectedRow: row,
							selectedColumn: col,
							cellPositions,
							segments,
							converter,
							formatter,
							schema
						},
						fieldInfo
					);

					// If selection has notes, only include notes; otherwise include all compatible fields
					const shouldInclude = hasNotes
						? fieldInfo.fieldType === 'note'
						: fieldInfo.fieldType === 'note' ||
							fieldInfo.fieldType === 'hex' ||
							fieldInfo.fieldType === 'dec' ||
							fieldInfo.fieldType === 'symbol';

					if (shouldInclude) {
						cellsToUpdate.push({ row, col, fieldInfo, currentValue });
					}
				}
			}

			for (const { row, col, fieldInfo, currentValue } of cellsToUpdate) {
				pattern = updateFieldAtPosition(
					pattern,
					row,
					col,
					fieldInfo,
					currentValue,
					delta,
					isOctaveIncrement
				);
			}

			recordBulkPatternEdit(originalPattern, pattern);
			updatePatternInArray(pattern);
		} else {
			const rowString = getPatternRowData(pattern, selectedRow);
			const cellPositions = getCellPositions(rowString, selectedRow);
			const segments = textParser
				? textParser.parseRowString(rowString, selectedRow)
				: undefined;

			const fieldInfo = PatternFieldDetection.detectFieldAtCursor({
				pattern,
				selectedRow,
				selectedColumn,
				cellPositions,
				segments,
				converter,
				formatter,
				schema
			});

			if (!fieldInfo) return;

			const currentValue = PatternValueUpdates.getFieldValue(
				{
					pattern,
					selectedRow,
					selectedColumn,
					cellPositions,
					segments,
					converter,
					formatter,
					schema
				},
				fieldInfo
			);

			const updatedPattern = updateFieldAtPosition(
				pattern,
				selectedRow,
				selectedColumn,
				fieldInfo,
				currentValue,
				delta,
				isOctaveIncrement
			);

			recordPatternEdit(pattern, updatedPattern);
			updatePatternInArray(updatedPattern);

			if (!playbackStore.isPlaying && fieldInfo.channelIndex >= 0) {
				if (chipProcessor && 'playPreviewNote' in chipProcessor) {
					const processor = chipProcessor as ChipProcessor & PreviewNoteSupport;
					const isNoteField = fieldInfo.fieldType === 'note';
					previewService.playFromContext(
						processor,
						updatedPattern,
						fieldInfo.channelIndex,
						selectedRow,
						schema,
						isNoteField
					);
				}
			}
		}

		clearAllCaches();
		draw();
	}

	function updateSize() {
		if (containerDiv) {
			const availableHeight = containerDiv.clientHeight;
			const gap = 8;

			canvasHeight = Math.max(
				PATTERN_EDITOR_CONSTANTS.MIN_CANVAS_HEIGHT,
				availableHeight - gap
			);
		} else {
			canvasHeight = Math.max(
				PATTERN_EDITOR_CONSTANTS.MIN_CANVAS_HEIGHT,
				window.innerHeight - PATTERN_EDITOR_CONSTANTS.CANVAS_TOP_MARGIN
			);
		}

		if (ctx && currentPattern) {
			const rowString = getPatternRowData(currentPattern, 0);
			const width = ctx.measureText(rowString).width;
			canvasWidth = width + PATTERN_EDITOR_CONSTANTS.CANVAS_PADDING;
		} else {
			canvasWidth = PATTERN_EDITOR_CONSTANTS.DEFAULT_CANVAS_WIDTH;
		}
	}

	let lastDrawnRow = -1;
	let lastDrawnOrderIndex = -1;
	let lastPatternOrderLength = -1;
	let lastPatternsLength = -1;
	let lastCanvasWidth = -1;
	let lastCanvasHeight = -1;
	let needsSetup = true;

	$effect(() => {
		if (!canvas) return;

		if (needsSetup || !ctx) {
			ctx = canvas.getContext('2d')!;
			setupCanvas();
			needsSetup = false;
			draw();
			lastDrawnRow = selectedRow;
			lastDrawnOrderIndex = currentPatternOrderIndex;
			lastPatternOrderLength = patternOrder.length;
			lastPatternsLength = patterns.length;
			lastCanvasWidth = canvasWidth;
			lastCanvasHeight = canvasHeight;
			return;
		}

		const patternChanged = currentPattern !== undefined;
		const sizeChanged = canvasWidth !== lastCanvasWidth || canvasHeight !== lastCanvasHeight;
		const rowChanged = selectedRow !== lastDrawnRow;
		const orderChanged =
			currentPatternOrderIndex !== lastDrawnOrderIndex ||
			patternOrder.length !== lastPatternOrderLength ||
			patterns.length !== lastPatternsLength;

		if (sizeChanged) {
			updateSize();
			setupCanvas();
			lastCanvasWidth = canvasWidth;
			lastCanvasHeight = canvasHeight;
		}

		if (rowChanged || orderChanged || patternChanged || sizeChanged) {
			draw();
			lastDrawnRow = selectedRow;
			lastDrawnOrderIndex = currentPatternOrderIndex;
			lastPatternOrderLength = patternOrder.length;
			lastPatternsLength = patterns.length;
		}
	});

	$effect(() => {
		const handleResize = () => {
			if (document.hidden) return;
			updateSize();
			setupCanvas();
			draw();
		};

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				updateSize();
				setupCanvas();
				draw();
			}
		};

		window.addEventListener('resize', handleResize);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('resize', handleResize);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	$effect(() => {
		if (!containerDiv) return;

		const resizeObserver = new ResizeObserver(() => {
			if (containerDiv.clientHeight > 0) {
				updateSize();
				setupCanvas();
				draw();
			}
		});

		resizeObserver.observe(containerDiv);

		return () => {
			resizeObserver.disconnect();
		};
	});

	let lastPlaybackUpdate = 0;
	const PLAYBACK_THROTTLE_MS = 33;
	let userManuallyChangedPattern = $state(false);
	let lastManualPatternChangeTime = 0;
	let lastPatternOrderIndexFromPlayback = currentPatternOrderIndex;

	$effect(() => {
		if (currentPatternOrderIndex !== lastPatternOrderIndexFromPlayback) {
			userManuallyChangedPattern = true;
			lastManualPatternChangeTime = performance.now();

			if (services.audioService.playing) {
				if (initAllChips) {
					initAllChips();
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							services.audioService.chipProcessors.forEach((processor, index) => {
								const speed = getSpeedForChip ? getSpeedForChip(index) : undefined;
								if (processor.changePatternDuringPlayback) {
									processor.changePatternDuringPlayback(
										0,
										currentPatternOrderIndex,
										undefined,
										speed
									);
								} else {
									processor.playFromRow(0, currentPatternOrderIndex, speed);
								}
							});
						});
					});
				} else {
					const patternId = patternOrder[currentPatternOrderIndex];
					const pattern =
						patterns.find((p) => p.id === patternId) ||
						PatternService.createEmptyPattern(patternId);
					services.audioService.chipProcessors.forEach((processor, index) => {
						const speed = getSpeedForChip ? getSpeedForChip(index) : undefined;
						if (processor.changePatternDuringPlayback) {
							processor.changePatternDuringPlayback(
								0,
								currentPatternOrderIndex,
								pattern,
								speed
							);
						} else {
							processor.playFromRow(0, currentPatternOrderIndex, speed);
						}
					});
				}
			}
		}
	});

	$effect(() => {
		if (!chipProcessor) return;

		const currentPatterns = patterns;
		const currentPatternOrder = patternOrder;

		const handlePatternUpdate = (
			currentRow: number,
			currentPatternOrderIndexUpdate?: number
		) => {
			if (!services.audioService.playing) return;

			const now = performance.now();
			if (now - lastPlaybackUpdate < PLAYBACK_THROTTLE_MS) return;
			lastPlaybackUpdate = now;

			selectedRow = currentRow;
			if (currentPatternOrderIndexUpdate !== undefined) {
				// Always follow playback pattern changes, but reset manual change flag
				// if playback has moved to a different pattern or enough time has passed
				if (currentPatternOrderIndexUpdate !== currentPatternOrderIndex) {
					// Playback has moved to a different pattern - always follow
					currentPatternOrderIndex = currentPatternOrderIndexUpdate;
					lastPatternOrderIndexFromPlayback = currentPatternOrderIndexUpdate;
					userManuallyChangedPattern = false;
				} else if (
					userManuallyChangedPattern &&
					now - lastManualPatternChangeTime > MANUAL_PATTERN_CHANGE_TIMEOUT_MS
				) {
					// Enough time has passed since manual change - reset the flag
					userManuallyChangedPattern = false;
					lastPatternOrderIndexFromPlayback = currentPatternOrderIndexUpdate;
				}
			}
		};

		const handlePatternRequest = (requestedOrderIndex: number) => {
			const latestPatterns = patterns;
			const latestPatternOrder = patternOrder;

			if (requestedOrderIndex >= 0 && requestedOrderIndex < latestPatternOrder.length) {
				const patternId = latestPatternOrder[requestedOrderIndex];
				const requestedPattern =
					latestPatterns.find((p) => p.id === patternId) ||
					PatternService.createEmptyPattern(patternId);

				chipProcessor.sendRequestedPattern(requestedPattern, requestedOrderIndex);
			}
		};

		const handleSpeedUpdate = (newSpeed: number) => {
			services.audioService.updateSpeed(newSpeed);
		};

		chipProcessor.setCallbacks(handlePatternUpdate, handlePatternRequest, handleSpeedUpdate);
	});
</script>

<div bind:this={containerDiv} class="flex h-full flex-col gap-2">
	<div class="relative flex" style="max-height: {canvasHeight}px">
		<canvas
			bind:this={canvas}
			tabindex="0"
			onkeydown={handleKeyDown}
			onkeyup={handleKeyUp}
			onwheel={handleWheel}
			onmouseenter={handleMouseEnter}
			onmouseleave={handleMouseLeave}
			onmousedown={handleCanvasMouseDown}
			onmousemove={handleCanvasMouseMove}
			onmouseup={handleCanvasMouseUp}
			class="focus:border-opacity-50 border-pattern-empty focus:border-pattern-text block border transition-colors duration-150 focus:outline-none">
		</canvas>
	</div>
</div>
