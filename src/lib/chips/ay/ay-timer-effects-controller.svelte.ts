import { Instrument } from '../../models/song';
import {
	createDefaultAyTimerRow,
	effectiveRowDetune,
	effectiveRowPeriod,
	effectiveInstrumentTimerPwmDuty,
	effectiveInstrumentTimerPwmSweep,
	effectiveInstrumentTimerPwmSweepMin,
	effectiveRowTimerWaveform,
	effectiveRowTimerWaveformLoop,
	instrumentSupportsTimerPwm,
	effectiveRowToneDetune,
	formatAyTimerWaveform,
	normalizeAyInstrumentFields,
	normalizeInstrumentTimerPwmFields,
	parseAyTimerWaveform,
	parseAyTimerWaveformPartial,
	resolveAyTimerRowSidPeriodMode,
	resolveExclusiveTimerEffects,
	clampTimerPwmDuty,
	clampTimerPwmSweepMin,
	AY_TIMER_WAVEFORM_MIN_LENGTH,
	AY_TIMER_WAVEFORM_MAX_LENGTH,
	type AyInstrumentFields,
	type AySidPeriodMode,
	type AyTimerRow
} from './instrument';

type ExtendedInstrument = Instrument & Partial<AyInstrumentFields>;

export class AyTimerEffectsController {
	fields = $state(normalizeAyInstrumentFields(new Instrument('', [])));
	waveformEditorRowIndex = $state<number | null>(null);
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
		this.fields = {
			timerRows,
			timerPwmDuty: normalized.timerPwmDuty,
			timerPwmSweepMin: normalized.timerPwmSweepMin,
			timerPwmSweep: normalized.timerPwmSweep,
			timerPwmPreserveOnNewNote: normalized.timerPwmPreserveOnNewNote
		};
		if (
			this.waveformEditorRowIndex !== null &&
			this.waveformEditorRowIndex >= timerRows.length
		) {
			this.waveformEditorRowIndex = null;
		}
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

	openWaveformEditor(rowIndex: number): void {
		if (rowIndex < 0 || rowIndex >= this.fields.timerRows.length) {
			return;
		}
		if (this.fields.timerRows[rowIndex]?.syncbuzzer) {
			return;
		}
		this.waveformEditorRowIndex =
			this.waveformEditorRowIndex === rowIndex ? null : rowIndex;
	}

	closeWaveformEditor(): void {
		this.waveformEditorRowIndex = null;
	}

	private updateInstrument(updates: Partial<ExtendedInstrument>): void {
		this.onInstrumentChange({ ...this.getInstrument(), ...updates });
	}

	private commitFields(next: AyInstrumentFields): void {
		this.fields = next;
		this.updateInstrument({
			timerRows: next.timerRows,
			timerPwmDuty: next.timerPwmDuty,
			timerPwmSweepMin: next.timerPwmSweepMin,
			timerPwmSweep: next.timerPwmSweep,
			timerPwmPreserveOnNewNote: next.timerPwmPreserveOnNewNote
		});
	}

	private updateTimerRows(nextRows: AyTimerRow[]): void {
		this.commitFields({ ...this.fields, timerRows: nextRows });
	}

	private mapTimerRow(rowIndex: number, mapRow: (row: AyTimerRow) => AyTimerRow): void {
		this.updateTimerRows(
			this.fields.timerRows.map((row, index) => (index === rowIndex ? mapRow(row) : row))
		);
	}

	instrumentSupportsTimerPwm(): boolean {
		return instrumentSupportsTimerPwm(this.fields);
	}

	timerPwmDuty(): number {
		return effectiveInstrumentTimerPwmDuty(this.fields);
	}

	timerPwmSweepMin(): number {
		return effectiveInstrumentTimerPwmSweepMin(this.fields);
	}

	timerPwmSweep(): number {
		return effectiveInstrumentTimerPwmSweep(this.fields);
	}

	timerPwmPreserveOnNewNote(): boolean {
		return this.fields.timerPwmPreserveOnNewNote;
	}

	setTimerPwmPreserveOnNewNote(preserve: boolean): void {
		if (!this.instrumentSupportsTimerPwm()) return;
		this.commitFields({ ...this.fields, timerPwmPreserveOnNewNote: preserve });
	}

	setTimerPwmDuty(duty: number): void {
		if (!this.instrumentSupportsTimerPwm()) return;
		const pwmFields = normalizeInstrumentTimerPwmFields({
			...this.fields,
			timerPwmDuty: clampTimerPwmDuty(duty)
		});
		this.commitFields({ ...this.fields, ...pwmFields });
	}

	setTimerPwmSweepMin(min: number): void {
		if (!this.instrumentSupportsTimerPwm() || this.fields.timerPwmSweep <= 0) return;
		const pwmFields = normalizeInstrumentTimerPwmFields({
			...this.fields,
			timerPwmSweepMin: clampTimerPwmSweepMin(min, this.fields.timerPwmDuty)
		});
		this.commitFields({ ...this.fields, ...pwmFields });
	}

	updateTimerPwmSweep(text: string): void {
		if (!this.instrumentSupportsTimerPwm()) return;
		const parsed = this.parseNum(text);
		if (parsed === null) return;
		const pwmFields = normalizeInstrumentTimerPwmFields({
			...this.fields,
			timerPwmSweep: Math.max(0, Math.min(50, parsed))
		});
		this.commitFields({ ...this.fields, ...pwmFields });
	}

	updateSidRow(index: number, sid: boolean): void {
		this.mapTimerRow(index, (row) =>
			resolveExclusiveTimerEffects({
				...row,
				sid,
				syncbuzzer: sid ? false : row.syncbuzzer
			})
		);
	}

	updateSyncbuzzerRow(index: number, syncbuzzer: boolean): void {
		this.mapTimerRow(index, (row) =>
			resolveExclusiveTimerEffects({
				...row,
				syncbuzzer,
				sid: syncbuzzer ? false : row.sid
			})
		);
		if (syncbuzzer && this.waveformEditorRowIndex === index) {
			this.waveformEditorRowIndex = null;
		}
	}

	setRowSidPeriodMode(index: number, mode: AySidPeriodMode): void {
		this.mapTimerRow(index, (row) => ({ ...row, sidPeriodMode: mode }));
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
		this.mapTimerRow(index, (row) => ({ ...row, detune: parsed }));
	}

	updateRowToneDetune(index: number, text: string): void {
		let parsed = this.parseSignedNum(text);
		if (parsed === null) return;
		if (parsed < -127) parsed = -127;
		if (parsed > 128) parsed = 128;
		this.mapTimerRow(index, (row) => ({ ...row, semitone: parsed }));
	}

	updateRowPeriod(index: number, text: string): void {
		const parsed = this.parseNum(text);
		if (parsed === null || parsed < 1) return;
		this.mapTimerRow(index, (row) => ({ ...row, period: parsed & 0xffff }));
	}

	rowTimerWaveform(rowIndex: number): number[] {
		return effectiveRowTimerWaveform(this.fields.timerRows[rowIndex]);
	}

	rowTimerWaveformLoop(rowIndex: number): number {
		return effectiveRowTimerWaveformLoop(this.fields.timerRows[rowIndex]);
	}

	formatRowTimerWaveform(rowIndex: number): string {
		return formatAyTimerWaveform(this.rowTimerWaveform(rowIndex), this.getAsHex());
	}

	setRowTimerWaveform(rowIndex: number, values: number[]): void {
		if (values.length === 0) {
			return;
		}
		const nextWaveform = values
			.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			.map((value) => Math.max(0, Math.min(15, value | 0)));
		this.mapTimerRow(rowIndex, (row) => ({ ...row, timerWaveform: nextWaveform }));
	}

	setRowWaveformStep(rowIndex: number, stepIndex: number, step: number): void {
		if (stepIndex < 0) return;
		const clamped = Math.max(0, Math.min(15, step | 0));
		const nextWaveform = [...this.rowTimerWaveform(rowIndex)];
		while (nextWaveform.length <= stepIndex && nextWaveform.length < AY_TIMER_WAVEFORM_MAX_LENGTH) {
			nextWaveform.push(0);
		}
		if (stepIndex >= nextWaveform.length) return;
		if (nextWaveform[stepIndex] === clamped) return;
		nextWaveform[stepIndex] = clamped;
		this.mapTimerRow(rowIndex, (row) => ({ ...row, timerWaveform: nextWaveform }));
	}

	parseTimerWaveform(text: string): number[] | null {
		return parseAyTimerWaveform(text, this.getAsHex());
	}

	parseTimerWaveformPartial(text: string): number[] | null {
		return parseAyTimerWaveformPartial(text, this.getAsHex());
	}

	appendRowWaveformStep(rowIndex: number, step = 0): boolean {
		const current = this.rowTimerWaveform(rowIndex);
		if (current.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			return false;
		}
		const clamped = Math.max(0, Math.min(15, step | 0));
		this.mapTimerRow(rowIndex, (row) => ({ ...row, timerWaveform: [...current, clamped] }));
		return true;
	}

	canAppendRowWaveformStep(rowIndex: number): boolean {
		return this.rowTimerWaveform(rowIndex).length < AY_TIMER_WAVEFORM_MAX_LENGTH;
	}

	removeRowWaveformStep(rowIndex: number): boolean {
		const current = this.rowTimerWaveform(rowIndex);
		if (current.length <= AY_TIMER_WAVEFORM_MIN_LENGTH) {
			return false;
		}
		this.mapTimerRow(rowIndex, (row) => ({ ...row, timerWaveform: current.slice(0, -1) }));
		return true;
	}

	canRemoveRowWaveformStep(rowIndex: number): boolean {
		return this.rowTimerWaveform(rowIndex).length > AY_TIMER_WAVEFORM_MIN_LENGTH;
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

	rowSidStepsEnabled(index: number): boolean {
		return !this.rowSyncbuzzerEnabled(index);
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
