import type { Action } from '../models/actions';
import type { ProjectHistoryEntry } from '../models/history';

const MAX_HISTORY_SIZE = 500;

type HistoryStackEntry =
	| { kind: 'project'; entry: ProjectHistoryEntry }
	| { kind: 'legacy'; action: Action };

type ApplyProjectHistoryEntry = (entry: ProjectHistoryEntry, direction: 'undo' | 'redo') => void;
type HistoryFeedback = { direction: 'undo' | 'redo'; label: string };
type HistoryFeedbackListener = (feedback: HistoryFeedback) => void;

class UndoRedoStore {
	private undoStack: HistoryStackEntry[] = $state([]);
	private redoStack: HistoryStackEntry[] = $state([]);
	private applyProjectEntry: ApplyProjectHistoryEntry | null = null;
	private feedbackListeners = new Set<HistoryFeedbackListener>();
	isApplying = $state(false);

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	get nextUndoLabel(): string {
		const entry = this.undoStack[this.undoStack.length - 1];
		if (!entry) return 'Undo';
		return entry.kind === 'project' ? entry.entry.undoLabel : 'Undo';
	}

	get nextRedoLabel(): string {
		const entry = this.redoStack[this.redoStack.length - 1];
		if (!entry) return 'Redo';
		return entry.kind === 'project' ? entry.entry.redoLabel : 'Redo';
	}

	pushAction(action: Action): void {
		this.push({ kind: 'legacy', action });
	}

	pushProjectEntry(entry: ProjectHistoryEntry): void {
		this.push({ kind: 'project', entry });
	}

	setProjectEntryApplier(applier: ApplyProjectHistoryEntry): void {
		this.applyProjectEntry = applier;
	}

	onFeedback(listener: HistoryFeedbackListener): () => void {
		this.feedbackListeners.add(listener);
		return () => this.feedbackListeners.delete(listener);
	}

	private push(entry: HistoryStackEntry): void {
		this.undoStack.push(entry);
		this.redoStack = [];

		if (this.undoStack.length > MAX_HISTORY_SIZE) {
			this.undoStack.shift();
		}
	}

	undo(): void {
		const entry = this.undoStack.pop();
		if (!entry) return;

		this.apply(entry, 'undo');
		this.redoStack.push(entry);
	}

	redo(): void {
		const entry = this.redoStack.pop();
		if (!entry) return;

		this.apply(entry, 'redo');
		this.undoStack.push(entry);
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
	}

	getUndoStackSize(): number {
		return this.undoStack.length;
	}

	getRedoStackSize(): number {
		return this.redoStack.length;
	}

	private apply(entry: HistoryStackEntry, direction: 'undo' | 'redo'): void {
		this.isApplying = true;
		try {
			if (entry.kind === 'project') {
				if (!this.applyProjectEntry) {
					throw new Error('Project history applier is not registered');
				}
				this.applyProjectEntry(entry.entry, direction);
				this.emitFeedback({
					direction,
					label: entry.entry.label
				});
				return;
			}
			if (direction === 'undo') entry.action.undo();
			else entry.action.execute();
		} finally {
			this.isApplying = false;
		}
	}

	private emitFeedback(feedback: HistoryFeedback): void {
		for (const listener of this.feedbackListeners) {
			listener(feedback);
		}
	}
}

export const undoRedoStore = new UndoRedoStore();
