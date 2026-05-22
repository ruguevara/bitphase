import type { Instrument } from '../../models/song';
import {
	effectiveRowDetune,
	effectiveRowPeriod,
	normalizeAyInstrumentFields,
	resolveAyTimerRowSidPeriodMode,
	resolveExclusiveTimerEffects,
	syncAyInstrumentTimerRows,
	type AySidPeriodMode,
	type AyTimerRow
} from './instrument';

type ExtendedInstrument = Instrument & {
	timerRows?: AyTimerRow[];
	timerWaveform?: number[];
	timerWaveformLoop?: number;
};

export class AyTimerEffectsController {
	fields = $state(normalizeAyInstrumentFields({ rows: [] } as Instrument));
	isDragging = $state(false);
	dragType = $state<'sid' | 'syncbuzzer' | 'mode' | null>(null);
	dragSidValue = $state<boolean | null>(null);
	dragSyncbuzzerValue = $state<boolean | null>(null);
	dragModeValue = $state<AySidPeriodMode | null>(null);

	private lastInstrumentId = '';
	private lastSyncedRowCount = 0;

	constructor(
		private getInstrument: () => Instrument,
		private onInstrumentChange: (instrument: Instrument) => void,
		private getAsHex: () => boolean
	) {
		this.syncFromInstrument(getInstrument());
	}

	timerRows = $derived(this.fields.timerRows);

	iconSizeClass(isExpanded: boolean): string {
		return isExpanded ? 'h-3.5 w-3.5' : 'h-3 w-3';
	}

	formatNum(value: number): string {
		if (this.getAsHex()) {
			return value.toString(16).toUpperCase().padStart(1, '0');
		}
		return String(value);
	}

	formatSignedNum(value: number): string {
		if (this.getAsHex()) {
			const sign = value < 0 ? '-' : '';
			return sign + Math.abs(value).toString(16).toUpperCase();
		}
		return String(value);
	}

	handleInstrumentChange(instrument: Instrument): void {
		if (instrument.id !== this.lastInstrumentId) {
			this.lastInstrumentId = instrument.id;
			this.syncFromInstrument(instrument);
			return;
		}
		if (instrument.rows.length !== this.lastSyncedRowCount) {
			this.syncFromInstrument(instrument);
		}
	}

	syncFromInstrument(instrument: Instrument): void {
		syncAyInstrumentTimerRows(instrument, Math.max(instrument.rows.length, 1));
		this.fields = normalizeAyInstrumentFields(instrument);
		this.lastSyncedRowCount = instrument.rows.length;
		this.lastInstrumentId = instrument.id;
	}

	stopDrag(): void {
		this.isDragging = false;
		this.dragType = null;
		this.dragSidValue = null;
		this.dragSyncbuzzerValue = null;
		this.dragModeValue = null;
	}

	private updateInstrument(updates: Partial<ExtendedInstrument>): void {
		this.onInstrumentChange({ ...this.getInstrument(), ...updates });
	}

	private commitFields(next: ReturnType<typeof normalizeAyInstrumentFields>): void {
		this.fields = next;
		this.updateInstrument({
			timerRows: next.timerRows,
			timerWaveform: next.timerWaveform,
			timerWaveformLoop: next.timerWaveformLoop
		});
	}

	private updateTimerRows(nextRows: AyTimerRow[]): void {
		this.commitFields({ ...this.fields, timerRows: nextRows });
	}

	updateSidRow(index: number, sid: boolean): void {
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) => {
				if (i !== index) {
					return row;
				}
				return resolveExclusiveTimerEffects({
					...row,
					sid,
					syncbuzzer: sid ? false : row.syncbuzzer
				});
			})
		);
	}

	updateSyncbuzzerRow(index: number, syncbuzzer: boolean): void {
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) => {
				if (i !== index) {
					return row;
				}
				return resolveExclusiveTimerEffects({
					...row,
					syncbuzzer,
					sid: syncbuzzer ? false : row.sid
				});
			})
		);
	}

	setRowSidPeriodMode(index: number, mode: AySidPeriodMode): void {
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) => (i === index ? { ...row, sidPeriodMode: mode } : row))
		);
	}

	beginDragMode(index: number): void {
		const row = this.fields.timerRows[index];
		if (!row) return;
		this.isDragging = true;
		this.dragType = 'mode';
		this.dragModeValue = resolveAyTimerRowSidPeriodMode(row) === 'auto' ? 'manual' : 'auto';
		this.setRowSidPeriodMode(index, this.dragModeValue);
	}

	dragOverMode(index: number): void {
		if (this.isDragging && this.dragType === 'mode' && this.dragModeValue !== null) {
			this.setRowSidPeriodMode(index, this.dragModeValue);
		}
	}

	beginDragSid(index: number): void {
		this.isDragging = true;
		this.dragType = 'sid';
		this.dragSidValue = !this.fields.timerRows[index].sid;
		this.updateSidRow(index, this.dragSidValue);
	}

	dragOverSid(index: number): void {
		if (this.isDragging && this.dragType === 'sid' && this.dragSidValue !== null) {
			this.updateSidRow(index, this.dragSidValue);
		}
	}

	beginDragSyncbuzzer(index: number): void {
		this.isDragging = true;
		this.dragType = 'syncbuzzer';
		this.dragSyncbuzzerValue = !this.fields.timerRows[index]?.syncbuzzer;
		this.updateSyncbuzzerRow(index, this.dragSyncbuzzerValue);
	}

	dragOverSyncbuzzer(index: number): void {
		if (this.isDragging && this.dragType === 'syncbuzzer' && this.dragSyncbuzzerValue !== null) {
			this.updateSyncbuzzerRow(index, this.dragSyncbuzzerValue);
		}
	}

	updateRowDetune(index: number, text: string): void {
		let parsed = this.parseSignedNum(text);
		if (parsed === null) return;
		if (parsed < -4095) parsed = -4095;
		if (parsed > 4095) parsed = 4095;
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) => (i === index ? { ...row, detune: parsed } : row))
		);
	}

	updateRowPeriod(index: number, text: string): void {
		const parsed = this.parseNum(text);
		if (parsed === null || parsed < 1) return;
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) => (i === index ? { ...row, period: parsed & 0xffff } : row))
		);
	}

	updateWaveformValue(index: number, text: string): void {
		const parsed = this.parseNum(text);
		if (parsed === null || parsed < 0 || parsed > 15) return;
		const nextWaveform = [...this.fields.timerWaveform];
		nextWaveform[index] = parsed;
		this.commitFields({ ...this.fields, timerWaveform: nextWaveform });
	}

	addWaveformStep(): void {
		if (this.fields.timerWaveform.length >= 32) return;
		this.commitFields({ ...this.fields, timerWaveform: [...this.fields.timerWaveform, 0] });
	}

	removeWaveformStep(index: number): void {
		if (this.fields.timerWaveform.length <= 1) return;
		const nextWaveform = this.fields.timerWaveform.filter((_, i) => i !== index);
		this.commitFields({ ...this.fields, timerWaveform: nextWaveform });
	}

	rowDetune(index: number): number {
		return effectiveRowDetune(this.fields.timerRows[index]);
	}

	rowPeriod(index: number): number {
		return effectiveRowPeriod(this.fields.timerRows[index]);
	}

	rowSidPeriodMode(index: number): AySidPeriodMode {
		return resolveAyTimerRowSidPeriodMode(this.fields.timerRows[index]);
	}

	rowSidEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.sid ?? false;
	}

	rowSyncbuzzerEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.syncbuzzer ?? false;
	}

	private parseNum(text: string): number | null {
		const trimmed = text.trim();
		if (this.getAsHex()) {
			if (!/^[0-9a-fA-F]+$/.test(trimmed)) return null;
			return parseInt(trimmed, 16);
		}
		if (!/^\d+$/.test(trimmed)) return null;
		return parseInt(trimmed, 10);
	}

	private parseSignedNum(text: string): number | null {
		const trimmed = text.trim();
		if (this.getAsHex()) {
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
}
