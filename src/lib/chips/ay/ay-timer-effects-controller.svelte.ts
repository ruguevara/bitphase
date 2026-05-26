import type { Instrument } from '../../models/song';
import {
	createDefaultAyTimerRow,
	effectiveRowDetune,
	effectiveRowPeriod,
	effectiveRowToneDetune,
	formatAyTimerWaveform,
	normalizeAyInstrumentFields,
	parseAyTimerWaveform,
	parseAyTimerWaveformPartial,
	resolveAyTimerRowSidPeriodMode,
	resolveExclusiveTimerEffects,
	AY_TIMER_WAVEFORM_MAX_LENGTH,
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
	private lastInstrumentRef: Instrument | null = null;

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
		if (instrument === this.lastInstrumentRef) {
			return;
		}
		this.lastInstrumentRef = instrument;
		this.syncFromInstrument(instrument);
	}

	syncFromInstrument(instrument: Instrument): void {
		const rowCount = Math.max(instrument.rows.length, 1);
		const normalized = normalizeAyInstrumentFields(instrument);
		const timerRows = [...normalized.timerRows];
		while (timerRows.length < rowCount) {
			timerRows.push(createDefaultAyTimerRow());
		}
		if (timerRows.length > rowCount) {
			timerRows.length = rowCount;
		}
		this.fields = { ...normalized, timerRows };
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
			this.fields.timerRows.map((row, i) =>
				i === index ? { ...row, sidPeriodMode: mode } : row
			)
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
		if (
			this.isDragging &&
			this.dragType === 'syncbuzzer' &&
			this.dragSyncbuzzerValue !== null
		) {
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

	updateRowToneDetune(index: number, text: string): void {
		let parsed = this.parseSignedNum(text);
		if (parsed === null) return;
		if (parsed < -127) parsed = -127;
		if (parsed > 128) parsed = 128;
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) =>
				i === index ? { ...row, semitone: parsed } : row
			)
		);
	}

	updateRowPeriod(index: number, text: string): void {
		const parsed = this.parseNum(text);
		if (parsed === null || parsed < 1) return;
		this.updateTimerRows(
			this.fields.timerRows.map((row, i) =>
				i === index ? { ...row, period: parsed & 0xffff } : row
			)
		);
	}

	setWaveformStep(index: number, step: number): void {
		if (index < 0) return;
		const clamped = Math.max(0, Math.min(15, step | 0));
		const nextWaveform = [...this.fields.timerWaveform];
		while (nextWaveform.length <= index && nextWaveform.length < AY_TIMER_WAVEFORM_MAX_LENGTH) {
			nextWaveform.push(0);
		}
		if (index >= nextWaveform.length) return;
		if (nextWaveform[index] === clamped) return;
		nextWaveform[index] = clamped;
		this.commitFields({ ...this.fields, timerWaveform: nextWaveform });
	}

	formatTimerWaveform(): string {
		return formatAyTimerWaveform(this.fields.timerWaveform, this.getAsHex());
	}

	parseTimerWaveform(text: string): number[] | null {
		return parseAyTimerWaveform(text, this.getAsHex());
	}

	parseTimerWaveformPartial(text: string): number[] | null {
		return parseAyTimerWaveformPartial(text, this.getAsHex());
	}

	setTimerWaveform(values: number[]): void {
		if (values.length === 0) {
			return;
		}
		const nextWaveform = values
			.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			.map((value) => Math.max(0, Math.min(15, value | 0)));
		this.commitFields({ ...this.fields, timerWaveform: nextWaveform });
	}

	appendWaveformStep(step = 0): boolean {
		if (this.fields.timerWaveform.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			return false;
		}
		const clamped = Math.max(0, Math.min(15, step | 0));
		this.commitFields({
			...this.fields,
			timerWaveform: [...this.fields.timerWaveform, clamped]
		});
		return true;
	}

	canAppendWaveformStep(): boolean {
		return this.fields.timerWaveform.length < AY_TIMER_WAVEFORM_MAX_LENGTH;
	}

	rowDetune(index: number): number {
		return effectiveRowDetune(this.fields.timerRows[index]);
	}

	rowPeriod(index: number): number {
		return effectiveRowPeriod(this.fields.timerRows[index]);
	}

	rowToneDetune(index: number): number {
		return effectiveRowToneDetune(this.fields.timerRows[index]);
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
