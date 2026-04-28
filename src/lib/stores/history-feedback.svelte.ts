import { undoRedoStore } from './undo-redo.svelte';

export interface HistoryToast {
	id: number;
	message: string;
	kind: 'undo' | 'redo';
}

class HistoryFeedbackStore {
	toasts = $state<HistoryToast[]>([]);
	private nextId = 1;
	private timeoutIds = new Map<number, ReturnType<typeof setTimeout>>();

	constructor() {
		undoRedoStore.onFeedback(({ direction, label }) => {
			this.show(`${direction === 'undo' ? 'Undone' : 'Redone'}: ${label}`, direction);
		});
	}

	show(message: string, kind: HistoryToast['kind']): void {
		const toast: HistoryToast = {
			id: this.nextId++,
			message,
			kind
		};
		this.toasts = [...this.toasts.slice(-3), toast];
		const timeoutId = setTimeout(() => {
			this.dismiss(toast.id);
		}, 2400);
		this.timeoutIds.set(toast.id, timeoutId);
	}

	dismiss(id: number): void {
		const timeoutId = this.timeoutIds.get(id);
		if (timeoutId) {
			clearTimeout(timeoutId);
			this.timeoutIds.delete(id);
		}
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
	}
}

export const historyFeedbackStore = new HistoryFeedbackStore();
