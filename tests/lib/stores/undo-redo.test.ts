import { describe, it, expect, beforeEach, vi } from 'vitest';
import { undoRedoStore } from '../../../src/lib/stores/undo-redo.svelte';
import type { Action, CursorPosition } from '../../../src/lib/models/actions';
import type { ProjectHistoryEntry } from '../../../src/lib/models/history';

class MockAction implements Action {
	executed = false;
	undone = false;

	constructor(
		private executeCallback: () => void,
		private undoCallback: () => void,
		private cursorPos: CursorPosition
	) {}

	execute(): void {
		this.executed = true;
		this.executeCallback();
	}

	undo(): void {
		this.undone = true;
		this.undoCallback();
	}

	getCursorPosition(): CursorPosition {
		return this.cursorPos;
	}
}

describe('UndoRedoStore', () => {
	beforeEach(() => {
		undoRedoStore.clear();
	});

	it('should start with empty stacks', () => {
		expect(undoRedoStore.canUndo).toBe(false);
		expect(undoRedoStore.canRedo).toBe(false);
		expect(undoRedoStore.getUndoStackSize()).toBe(0);
		expect(undoRedoStore.getRedoStackSize()).toBe(0);
	});

	it('should push action to undo stack', () => {
		const action = new MockAction(
			() => {},
			() => {},
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		undoRedoStore.pushAction(action);

		expect(undoRedoStore.canUndo).toBe(true);
		expect(undoRedoStore.canRedo).toBe(false);
		expect(undoRedoStore.getUndoStackSize()).toBe(1);
	});

	it('should undo action and move it to redo stack', () => {
		const undoCallback = vi.fn();
		const action = new MockAction(
			() => {},
			undoCallback,
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		undoRedoStore.pushAction(action);
		undoRedoStore.undo();

		expect(undoCallback).toHaveBeenCalledOnce();
		expect(undoRedoStore.canUndo).toBe(false);
		expect(undoRedoStore.canRedo).toBe(true);
		expect(undoRedoStore.getRedoStackSize()).toBe(1);
	});

	it('should redo action and move it back to undo stack', () => {
		const executeCallback = vi.fn();
		const action = new MockAction(
			executeCallback,
			() => {},
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		undoRedoStore.pushAction(action);
		undoRedoStore.undo();
		undoRedoStore.redo();

		expect(executeCallback).toHaveBeenCalledOnce();
		expect(undoRedoStore.canUndo).toBe(true);
		expect(undoRedoStore.canRedo).toBe(false);
	});

	it('should clear redo stack when new action is pushed', () => {
		const action1 = new MockAction(
			() => {},
			() => {},
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);
		const action2 = new MockAction(
			() => {},
			() => {},
			{ row: 1, column: 0, patternOrderIndex: 0 }
		);

		undoRedoStore.pushAction(action1);
		undoRedoStore.undo();
		expect(undoRedoStore.getRedoStackSize()).toBe(1);

		undoRedoStore.pushAction(action2);
		expect(undoRedoStore.getRedoStackSize()).toBe(0);
		expect(undoRedoStore.canRedo).toBe(false);
	});

	it('should handle multiple undo operations', () => {
		const undoCallbacks = [vi.fn(), vi.fn(), vi.fn()];
		const actions = undoCallbacks.map(
			(cb, i) =>
				new MockAction(() => {}, cb, { row: i, column: 0, patternOrderIndex: 0 })
		);

		actions.forEach((action) => undoRedoStore.pushAction(action));

		expect(undoRedoStore.getUndoStackSize()).toBe(3);

		undoRedoStore.undo();
		expect(undoCallbacks[2]).toHaveBeenCalledOnce();
		expect(undoRedoStore.getUndoStackSize()).toBe(2);

		undoRedoStore.undo();
		expect(undoCallbacks[1]).toHaveBeenCalledOnce();
		expect(undoRedoStore.getUndoStackSize()).toBe(1);

		undoRedoStore.undo();
		expect(undoCallbacks[0]).toHaveBeenCalledOnce();
		expect(undoRedoStore.getUndoStackSize()).toBe(0);
	});

	it('should handle multiple redo operations', () => {
		const executeCallbacks = [vi.fn(), vi.fn(), vi.fn()];
		const actions = executeCallbacks.map(
			(cb, i) =>
				new MockAction(cb, () => {}, { row: i, column: 0, patternOrderIndex: 0 })
		);

		actions.forEach((action) => undoRedoStore.pushAction(action));
		undoRedoStore.undo();
		undoRedoStore.undo();
		undoRedoStore.undo();

		expect(undoRedoStore.getRedoStackSize()).toBe(3);

		undoRedoStore.redo();
		expect(executeCallbacks[0]).toHaveBeenCalledOnce();

		undoRedoStore.redo();
		expect(executeCallbacks[1]).toHaveBeenCalledOnce();

		undoRedoStore.redo();
		expect(executeCallbacks[2]).toHaveBeenCalledOnce();

		expect(undoRedoStore.getRedoStackSize()).toBe(0);
	});

	it('should limit undo stack size', () => {
		const maxSize = 500;
		for (let i = 0; i < maxSize + 10; i++) {
			const action = new MockAction(
				() => {},
				() => {},
				{ row: i, column: 0, patternOrderIndex: 0 }
			);
			undoRedoStore.pushAction(action);
		}

		expect(undoRedoStore.getUndoStackSize()).toBe(maxSize);
	});

	it('should do nothing when undoing empty stack', () => {
		expect(() => undoRedoStore.undo()).not.toThrow();
		expect(undoRedoStore.canUndo).toBe(false);
	});

	it('should do nothing when redoing empty stack', () => {
		expect(() => undoRedoStore.redo()).not.toThrow();
		expect(undoRedoStore.canRedo).toBe(false);
	});

	it('should clear both stacks', () => {
		const action = new MockAction(
			() => {},
			() => {},
			{ row: 0, column: 0, patternOrderIndex: 0 }
		);

		undoRedoStore.pushAction(action);
		undoRedoStore.undo();

		expect(undoRedoStore.getUndoStackSize()).toBe(0);
		expect(undoRedoStore.getRedoStackSize()).toBe(1);

		undoRedoStore.clear();

		expect(undoRedoStore.getUndoStackSize()).toBe(0);
		expect(undoRedoStore.getRedoStackSize()).toBe(0);
		expect(undoRedoStore.canUndo).toBe(false);
		expect(undoRedoStore.canRedo).toBe(false);
	});

	it('should expose labels for project history entries', () => {
		const entry: ProjectHistoryEntry = {
			type: 'table.add',
			label: 'Add table 2',
			undoLabel: 'Undo Add Table',
			redoLabel: 'Redo Add Table',
			diffs: [],
			inverseDiffs: [],
			affectedDomains: ['tables']
		};

		undoRedoStore.pushProjectEntry(entry);

		expect(undoRedoStore.nextUndoLabel).toBe('Undo Add Table');
		expect(undoRedoStore.nextRedoLabel).toBe('Redo');
	});

	it('should apply project history entries and emit feedback', () => {
		const applier = vi.fn();
		const feedback = vi.fn();
		const unsubscribe = undoRedoStore.onFeedback(feedback);
		const entry: ProjectHistoryEntry = {
			type: 'instrument.add',
			label: 'Add instrument 02',
			undoLabel: 'Undo Add Instrument',
			redoLabel: 'Redo Add Instrument',
			diffs: [],
			inverseDiffs: [],
			affectedDomains: ['instruments']
		};

		undoRedoStore.setProjectEntryApplier(applier);
		undoRedoStore.pushProjectEntry(entry);
		undoRedoStore.undo();
		undoRedoStore.redo();
		unsubscribe();

		expect(applier).toHaveBeenNthCalledWith(1, entry, 'undo');
		expect(applier).toHaveBeenNthCalledWith(2, entry, 'redo');
		expect(feedback).toHaveBeenNthCalledWith(1, {
			direction: 'undo',
			label: 'Add instrument 02'
		});
		expect(feedback).toHaveBeenNthCalledWith(2, {
			direction: 'redo',
			label: 'Add instrument 02'
		});
	});
});

