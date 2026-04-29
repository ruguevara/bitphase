import { describe, it, expect, beforeEach } from 'vitest';
import { ACTION_REDO, ACTION_UNDO, buildEditMenuItems } from '../../../src/lib/config/keybindings';
import type { Action, CursorPosition } from '../../../src/lib/models/actions';
import { playbackStore } from '../../../src/lib/stores/playback.svelte';
import { undoRedoStore } from '../../../src/lib/stores/undo-redo.svelte';

class TestAction implements Action {
	execute(): void {}

	undo(): void {}

	getCursorPosition(): CursorPosition {
		return { row: 0, column: 0, patternOrderIndex: 0 };
	}
}

function getDisabledState(action: string): boolean {
	const item = buildEditMenuItems().find((menuItem) => menuItem.action === action);
	const disabled = item?.disabled;
	return typeof disabled === 'function' ? disabled() : disabled === true;
}

describe('buildEditMenuItems', () => {
	beforeEach(() => {
		playbackStore.isPlaying = false;
		undoRedoStore.clear();
	});

	it('disables undo and redo while playback is active', () => {
		undoRedoStore.pushAction(new TestAction());
		undoRedoStore.pushAction(new TestAction());
		undoRedoStore.undo();
		playbackStore.isPlaying = true;

		expect(getDisabledState(ACTION_UNDO)).toBe(true);
		expect(getDisabledState(ACTION_REDO)).toBe(true);
	});

	it('enables undo and redo when playback is inactive and history is available', () => {
		undoRedoStore.pushAction(new TestAction());
		undoRedoStore.pushAction(new TestAction());
		undoRedoStore.undo();

		expect(getDisabledState(ACTION_UNDO)).toBe(false);
		expect(getDisabledState(ACTION_REDO)).toBe(false);
	});
});
