import type { Pattern } from '../../models/song';
import type { NavigationState, NavigationContext } from './pattern-navigation';
import { PatternNavigationService } from './pattern-navigation';

export interface PatternKeyboardShortcutsContext {
	isPlaying: boolean;
	selectedColumn: number;
	selectedRow: number;
	currentPatternOrderIndex: number;
	pattern: Pattern;
	hasSelection: () => boolean;
	onUndo: () => void;
	onRedo: () => void;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onDelete: () => void;
	onSelectAll: (column: number, startRow: number, endRow: number) => void;
	onTogglePlayback: () => void;
	onPausePlayback: () => void;
	onPlayFromCursor: () => void;
	onMoveRow: (delta: number) => void;
	onMoveColumn: (delta: number) => void;
	onSetSelectedRow: (row: number) => void;
	onSetSelectedColumn: (column: number) => void;
	onSetCurrentPatternOrderIndex: (index: number) => void;
	onClearSelection: () => void;
	onSetSelectionAnchor: (row: number, column: number) => void;
	onExtendSelection: (row: number, column: number) => void;
	onIncrementFieldValue: (delta: number, isOctaveIncrement?: boolean) => void;
	navigationContext: NavigationContext;
}

export interface KeyboardShortcutResult {
	handled: boolean;
	shouldPreventDefault: boolean;
}

export class PatternKeyboardShortcutsService {
	private static isEnterKeyHeld = false;

	static handleKeyDown(
		event: KeyboardEvent,
		shortcutsContext: PatternKeyboardShortcutsContext
	): KeyboardShortcutResult {
		if (event.key === 'Enter' && !event.repeat && !this.isEnterKeyHeld) {
			this.isEnterKeyHeld = true;
			shortcutsContext.onPlayFromCursor();
			return { handled: true, shouldPreventDefault: true };
		}

		const isModifier = event.shiftKey;
		const key = event.key.toLowerCase();

		if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') {
			shortcutsContext.onUndo();
			return { handled: true, shouldPreventDefault: true };
		}

		if (((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z') || ((event.ctrlKey || event.metaKey) && key === 'y')) {
			shortcutsContext.onRedo();
			return { handled: true, shouldPreventDefault: true };
		}

		if ((event.ctrlKey || event.metaKey) && key === 'c') {
			shortcutsContext.onCopy();
			return { handled: true, shouldPreventDefault: true };
		}

		if ((event.ctrlKey || event.metaKey) && key === 'x') {
			shortcutsContext.onCut();
			return { handled: true, shouldPreventDefault: true };
		}

		if ((event.ctrlKey || event.metaKey) && key === 'v') {
			shortcutsContext.onPaste();
			return { handled: true, shouldPreventDefault: true };
		}

		if (isModifier && key === 'a') {
			if (!shortcutsContext.isPlaying) {
				shortcutsContext.onSelectAll(
					shortcutsContext.selectedColumn,
					0,
					shortcutsContext.pattern.length - 1
				);
			}
			return { handled: true, shouldPreventDefault: true };
		}

		if ((event.ctrlKey || event.metaKey) && !isModifier) {
			return { handled: false, shouldPreventDefault: false };
		}

		if (
			(event.key === 'Delete' || event.key === 'Backspace') &&
			shortcutsContext.hasSelection()
		) {
			shortcutsContext.onDelete();
			return { handled: true, shouldPreventDefault: true };
		}

		switch (event.key) {
			case ' ':
				if (shortcutsContext.isPlaying) {
					shortcutsContext.onPausePlayback();
				} else {
					shortcutsContext.onTogglePlayback();
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowUp':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							-1
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(-1);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowDown':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							1
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(1);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowLeft':
				if (event.shiftKey) {
					if (!shortcutsContext.hasSelection()) {
						shortcutsContext.onSetSelectionAnchor(
							shortcutsContext.selectedRow,
							shortcutsContext.selectedColumn
						);
					}
					const newState = PatternNavigationService.moveColumnByDelta(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext,
						-1
					);
					shortcutsContext.onExtendSelection(
						newState.selectedRow,
						newState.selectedColumn
					);
					shortcutsContext.onSetSelectedColumn(newState.selectedColumn);
				} else {
					shortcutsContext.onClearSelection();
					shortcutsContext.onMoveColumn(-1);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'ArrowRight':
				if (event.shiftKey) {
					if (!shortcutsContext.hasSelection()) {
						shortcutsContext.onSetSelectionAnchor(
							shortcutsContext.selectedRow,
							shortcutsContext.selectedColumn
						);
					}
					const newState = PatternNavigationService.moveColumnByDelta(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext,
						1
					);
					shortcutsContext.onExtendSelection(
						newState.selectedRow,
						newState.selectedColumn
					);
					shortcutsContext.onSetSelectedColumn(newState.selectedColumn);
				} else {
					shortcutsContext.onClearSelection();
					shortcutsContext.onMoveColumn(1);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'PageUp':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							-16
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(-16);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'PageDown':
				if (!shortcutsContext.isPlaying) {
					if (event.shiftKey) {
						if (!shortcutsContext.hasSelection()) {
							shortcutsContext.onSetSelectionAnchor(
								shortcutsContext.selectedRow,
								shortcutsContext.selectedColumn
							);
						}
						const newState = PatternNavigationService.moveRow(
							{
								selectedRow: shortcutsContext.selectedRow,
								currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
								selectedColumn: shortcutsContext.selectedColumn
							},
							shortcutsContext.navigationContext,
							16
						);
						shortcutsContext.onExtendSelection(
							newState.selectedRow,
							newState.selectedColumn
						);
						shortcutsContext.onSetSelectedRow(newState.selectedRow);
						if (
							newState.currentPatternOrderIndex !==
							shortcutsContext.currentPatternOrderIndex
						) {
							shortcutsContext.onSetCurrentPatternOrderIndex(
								newState.currentPatternOrderIndex
							);
						}
					} else {
						shortcutsContext.onClearSelection();
						shortcutsContext.onMoveRow(16);
					}
				}
				return { handled: true, shouldPreventDefault: true };
			case 'Home':
				if (event.ctrlKey || event.metaKey) {
					if (!shortcutsContext.isPlaying) {
						if (event.shiftKey) {
							shortcutsContext.onExtendSelection(0, shortcutsContext.selectedColumn);
						} else {
							shortcutsContext.onClearSelection();
						}
						shortcutsContext.onSetSelectedRow(0);
					}
				} else {
					if (event.shiftKey) {
						shortcutsContext.onExtendSelection(shortcutsContext.selectedRow, 0);
					} else {
						shortcutsContext.onClearSelection();
					}
					shortcutsContext.onSetSelectedColumn(0);
				}
				return { handled: true, shouldPreventDefault: true };
			case 'End':
				if (event.ctrlKey || event.metaKey) {
					if (!shortcutsContext.isPlaying) {
						if (event.shiftKey) {
							shortcutsContext.onExtendSelection(
								shortcutsContext.pattern.length - 1,
								shortcutsContext.selectedColumn
							);
						} else {
							shortcutsContext.onClearSelection();
						}
						shortcutsContext.onSetSelectedRow(shortcutsContext.pattern.length - 1);
					}
				} else {
					const navigationState = PatternNavigationService.moveToRowEnd(
						{
							selectedRow: shortcutsContext.selectedRow,
							currentPatternOrderIndex: shortcutsContext.currentPatternOrderIndex,
							selectedColumn: shortcutsContext.selectedColumn
						},
						shortcutsContext.navigationContext
					);
					if (event.shiftKey) {
						shortcutsContext.onExtendSelection(
							shortcutsContext.selectedRow,
							navigationState.selectedColumn
						);
					} else {
						shortcutsContext.onClearSelection();
					}
					shortcutsContext.onSetSelectedColumn(navigationState.selectedColumn);
				}
				return { handled: true, shouldPreventDefault: true };
			case '+':
			case '=':
				if (!shortcutsContext.isPlaying) {
					shortcutsContext.onIncrementFieldValue(1, isModifier);
				}
				return { handled: true, shouldPreventDefault: true };
			case '-':
			case '_':
				if (!shortcutsContext.isPlaying) {
					shortcutsContext.onIncrementFieldValue(-1, isModifier);
				}
				return { handled: true, shouldPreventDefault: true };
		}

		return { handled: false, shouldPreventDefault: false };
	}
}
