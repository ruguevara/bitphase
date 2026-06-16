import { settingsStore } from './settings.svelte';

const EDITOR_STATE_STORAGE_KEY = 'editorState';

interface StoredEditorState {
	octave?: number;
	step?: number;
}

class EditorStateStore {
	octave = $state(4);
	step = $state(0);
	envelopeAsNote = $state(false);
	currentInstrument = $state('01');

	init(): void {
		this.envelopeAsNote = settingsStore.envelopeAsNote;
		const stored = localStorage.getItem(EDITOR_STATE_STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as StoredEditorState;
			if (typeof parsed.octave === 'number' && parsed.octave >= 1 && parsed.octave <= 8) {
				this.octave = parsed.octave;
			} else if (typeof parsed.octave === 'number' && parsed.octave === 0) {
				this.octave = 1;
			}
			if (typeof parsed.step === 'number' && parsed.step >= 0 && parsed.step <= 255) {
				this.step = parsed.step;
			}
		}
	}

	setOctave(octave: number): void {
		if (octave >= 1 && octave <= 8) {
			this.octave = octave;
			this.saveEditorState();
		}
	}

	setStep(step: number): void {
		if (step >= 0 && step <= 255) {
			this.step = step;
			this.saveEditorState();
		}
	}

	private saveEditorState(): void {
		localStorage.setItem(
			EDITOR_STATE_STORAGE_KEY,
			JSON.stringify({ octave: this.octave, step: this.step })
		);
	}

	setEnvelopeAsNote(envelopeAsNote: boolean): void {
		if (this.envelopeAsNote === envelopeAsNote) return;
		this.envelopeAsNote = envelopeAsNote;
		settingsStore.set('envelopeAsNote', envelopeAsNote);
	}

	setCurrentInstrument(instrument: string): void {
		this.currentInstrument = instrument;
	}

	selectInstrumentRequest = $state<string | null>(null);

	requestSelectInstrument(instrumentId: string): void {
		this.currentInstrument = instrumentId;
		this.selectInstrumentRequest = instrumentId;
	}

	clearSelectInstrumentRequest(): void {
		this.selectInstrumentRequest = null;
	}

	currentTable = $state(0);

	setCurrentTable(tableId: number): void {
		this.currentTable = tableId;
	}

	selectTableRequest = $state<number | null>(null);

	requestSelectTable(tableId: number): void {
		this.currentTable = tableId;
		this.selectTableRequest = tableId;
	}

	clearSelectTableRequest(): void {
		this.selectTableRequest = null;
	}
}

export const editorStateStore = new EditorStateStore();
