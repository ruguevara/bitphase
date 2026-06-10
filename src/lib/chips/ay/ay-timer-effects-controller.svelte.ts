import { Instrument } from '../../models/song';
import {
	createDefaultAyTimerRow,
	DEFAULT_AY_TIMER_WAVEFORM,
	DEFAULT_AY_SYNCBUZZER_WAVEFORM,
	defaultAyFmWaveform,
	clampFmWaveformValue,
	clampFmPeriodOffset,
	clampFmSemitone,
	isIncompleteSignedNumericToken,
	effectiveRowDetune,
	effectiveRowWaveform,
	effectiveRowWaveformLoop,
	resolveAyFmOffsetMode,
	resolveAyEnvFmOffsetMode,
	effectiveRowPeriod,
	resolveSidSyncbuzzerExclusiveRow,
	rowSupportsTimerPwm,
	instrumentSupportsTimerPwm,
	effectiveRowToneDetune,
	formatAyTimerWaveform,
	formatAyFmWaveform,
	normalizeAyInstrumentFields,
	normalizeAyTimerEffectPwmFields,
	parseAyFmWaveform,
	parseAyFmWaveformPartial,
	parseAyTimerWaveform,
	parseAyTimerWaveformPartial,
	clampTimerPwmDuty,
	clampTimerPwmSweep,
	clampTimerPwmSweepMin,
	getTimerEffectPwmFields,
	AY_TIMER_WAVEFORM_MIN_LENGTH,
	AY_TIMER_WAVEFORM_MAX_LENGTH,
	type AyFmOffsetMode,
	type AyInstrumentFields,
	type AyTimerEffectType,
	type AyTimerRow
} from './instrument';

type ExtendedInstrument = Instrument & Partial<AyInstrumentFields>;

const EFFECT_TYPES: AyTimerEffectType[] = ['sid', 'syncbuzzer', 'fm', 'envFm'];

export class AyTimerEffectsController {
	fields = $state(normalizeAyInstrumentFields(new Instrument('', [])));
	waveformEditorRowIndex = $state<number | null>(null);
	waveformEditorTab = $state<AyTimerEffectType>('sid');
	pwmEditorTab = $state<AyTimerEffectType>('sid');
	isDragging = $state(false);
	dragType = $state<'sid' | 'syncbuzzer' | 'fm' | 'envFm' | null>(null);
	dragSidValue = $state<boolean | null>(null);
	dragSyncbuzzerValue = $state<boolean | null>(null);
	dragFmValue = $state<boolean | null>(null);
	dragEnvFmValue = $state<boolean | null>(null);

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
		this.fields = normalized;
		this.fields.timerRows = timerRows;
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
		this.dragFmValue = null;
		this.dragEnvFmValue = null;
	}

	openWaveformEditor(rowIndex: number): void {
		if (rowIndex < 0 || rowIndex >= this.fields.timerRows.length) {
			return;
		}
		if (this.waveformEditorRowIndex === rowIndex) {
			this.waveformEditorRowIndex = null;
			return;
		}
		this.waveformEditorRowIndex = rowIndex;
		const row = this.fields.timerRows[rowIndex];
		this.waveformEditorTab =
			EFFECT_TYPES.find((effectType) => this.isEffectEnabled(rowIndex, effectType)) ?? 'sid';
	}

	closeWaveformEditor(): void {
		this.waveformEditorRowIndex = null;
	}

	setWaveformEditorTab(tab: AyTimerEffectType): void {
		this.waveformEditorTab = tab;
	}

	setPwmEditorTab(tab: AyTimerEffectType): void {
		this.pwmEditorTab = tab;
	}

	private updateInstrument(updates: Partial<ExtendedInstrument>): void {
		this.onInstrumentChange({ ...this.getInstrument(), ...updates });
	}

	private commitFields(next: AyInstrumentFields): void {
		this.fields = next;
		this.updateInstrument({
			timerRows: next.timerRows,
			sidTimerPwm: next.sidTimerPwm,
			syncbuzzerTimerPwm: next.syncbuzzerTimerPwm,
			fmTimerPwm: next.fmTimerPwm,
			envFmTimerPwm: next.envFmTimerPwm
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

	private updateEffectPwm(
		effectType: AyTimerEffectType,
		updates: Partial<AyInstrumentFields['sidTimerPwm']>
	): void {
		const key = `${effectType}TimerPwm` as keyof AyInstrumentFields;
		const current = getTimerEffectPwmFields(this.fields, effectType);
		const nextPwm = normalizeAyTimerEffectPwmFields({ ...current, ...updates });
		this.commitFields({ ...this.fields, [key]: nextPwm });
	}

	instrumentSupportsTimerPwm(effectType?: AyTimerEffectType): boolean {
		if (effectType) {
			return this.fields.timerRows.some((row) => rowSupportsTimerPwm(row, effectType));
		}
		return instrumentSupportsTimerPwm(this.fields);
	}

	timerPwmDuty(effectType: AyTimerEffectType): number {
		return clampTimerPwmDuty(getTimerEffectPwmFields(this.fields, effectType).duty);
	}

	timerPwmSweepMin(effectType: AyTimerEffectType): number {
		const pwm = getTimerEffectPwmFields(this.fields, effectType);
		return clampTimerPwmSweepMin(pwm.sweepMin, pwm.duty);
	}

	timerPwmSweep(effectType: AyTimerEffectType): number {
		return clampTimerPwmSweep(getTimerEffectPwmFields(this.fields, effectType).sweep);
	}

	timerPwmPreserveOnNewNote(effectType: AyTimerEffectType): boolean {
		return getTimerEffectPwmFields(this.fields, effectType).preserveOnNewNote;
	}

	setTimerPwmPreserveOnNewNote(effectType: AyTimerEffectType, preserve: boolean): void {
		if (!this.instrumentSupportsTimerPwm(effectType)) return;
		this.updateEffectPwm(effectType, { preserveOnNewNote: preserve });
	}

	timerPwmReverseSweep(effectType: AyTimerEffectType): boolean {
		return getTimerEffectPwmFields(this.fields, effectType).reverseSweep;
	}

	setTimerPwmReverseSweep(effectType: AyTimerEffectType, reverse: boolean): void {
		if (!this.instrumentSupportsTimerPwm(effectType) || this.timerPwmSweep(effectType) <= 0) {
			return;
		}
		this.updateEffectPwm(effectType, { reverseSweep: reverse });
	}

	setTimerPwmDuty(effectType: AyTimerEffectType, duty: number): void {
		if (!this.instrumentSupportsTimerPwm(effectType)) return;
		this.updateEffectPwm(effectType, { duty: clampTimerPwmDuty(duty) });
	}

	setTimerPwmSweepMin(effectType: AyTimerEffectType, min: number): void {
		if (
			!this.instrumentSupportsTimerPwm(effectType) ||
			this.timerPwmSweep(effectType) <= 0
		) {
			return;
		}
		const duty = getTimerEffectPwmFields(this.fields, effectType).duty;
		this.updateEffectPwm(effectType, {
			sweepMin: clampTimerPwmSweepMin(min, duty)
		});
	}

	parseTimerPwmNum(text: string): number | null {
		return this.parseNum(text);
	}

	usesHexNumerals(): boolean {
		return this.getAsHex();
	}

	updateTimerPwmSweep(effectType: AyTimerEffectType, text: string): void {
		if (!this.instrumentSupportsTimerPwm(effectType)) return;
		const parsed = this.parseNum(text);
		if (parsed === null) return;
		this.updateEffectPwm(effectType, { sweep: clampTimerPwmSweep(parsed) });
	}

	updateSidRow(index: number, sid: boolean): void {
		this.mapTimerRow(index, (row) =>
			resolveSidSyncbuzzerExclusiveRow({
				...row,
				sid,
				syncbuzzer: sid ? false : row.syncbuzzer
			})
		);
	}

	updateSyncbuzzerRow(index: number, syncbuzzer: boolean): void {
		this.mapTimerRow(index, (row) =>
			resolveSidSyncbuzzerExclusiveRow({
				...row,
				syncbuzzer,
				sid: syncbuzzer ? false : row.sid
			})
		);
	}

	updateFmRow(index: number, fm: boolean): void {
		this.mapTimerRow(index, (row) => ({ ...row, fm }));
	}

	updateEnvFmRow(index: number, envFm: boolean): void {
		this.mapTimerRow(index, (row) => ({ ...row, envFm }));
	}

	updateFmOffsetMode(index: number, mode: AyFmOffsetMode): void {
		this.mapTimerRow(index, (row) => {
			const currentMode = resolveAyFmOffsetMode(row);
			if (currentMode === mode) {
				return { ...row, fmOffsetMode: mode };
			}
			const currentWaveform = effectiveRowWaveform({ ...row, fmOffsetMode: currentMode }, 'fm');
			return {
				...row,
				fmOffsetMode: mode,
				fmWaveform: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
			};
		});
	}

	toggleFmOffsetMode(index: number): void {
		const row = this.fields.timerRows[index];
		if (!row?.fm) return;
		const nextMode = resolveAyFmOffsetMode(row) === 'period' ? 'semitone' : 'period';
		this.updateFmOffsetMode(index, nextMode);
	}

	updateEnvFmOffsetMode(index: number, mode: AyFmOffsetMode): void {
		this.mapTimerRow(index, (row) => {
			const currentMode = resolveAyEnvFmOffsetMode(row);
			if (currentMode === mode) {
				return { ...row, envFmOffsetMode: mode };
			}
			const currentWaveform = effectiveRowWaveform(
				{ ...row, envFmOffsetMode: currentMode },
				'envFm'
			);
			return {
				...row,
				envFmOffsetMode: mode,
				envFmWaveform: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
			};
		});
	}

	toggleEnvFmOffsetMode(index: number): void {
		const row = this.fields.timerRows[index];
		if (!row?.envFm) return;
		const nextMode = resolveAyEnvFmOffsetMode(row) === 'period' ? 'semitone' : 'period';
		this.updateEnvFmOffsetMode(index, nextMode);
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

	beginDragFm(index: number): void {
		this.isDragging = true;
		this.dragType = 'fm';
		this.dragFmValue = !this.fields.timerRows[index]?.fm;
		this.updateFmRow(index, this.dragFmValue);
	}

	dragOverFm(index: number): void {
		if (this.isDragging && this.dragType === 'fm' && this.dragFmValue !== null) {
			this.updateFmRow(index, this.dragFmValue);
		}
	}

	beginDragEnvFm(index: number): void {
		this.isDragging = true;
		this.dragType = 'envFm';
		this.dragEnvFmValue = !this.fields.timerRows[index]?.envFm;
		this.updateEnvFmRow(index, this.dragEnvFmValue);
	}

	dragOverEnvFm(index: number): void {
		if (this.isDragging && this.dragType === 'envFm' && this.dragEnvFmValue !== null) {
			this.updateEnvFmRow(index, this.dragEnvFmValue);
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

	isEffectEnabled(rowIndex: number, effectType: AyTimerEffectType): boolean {
		const row = this.fields.timerRows[rowIndex];
		if (!row) return false;
		switch (effectType) {
			case 'sid':
				return row.sid;
			case 'syncbuzzer':
				return row.syncbuzzer === true;
			case 'fm':
				return row.fm === true;
			case 'envFm':
				return row.envFm === true;
		}
	}

	rowWaveform(rowIndex: number, effectType: AyTimerEffectType): number[] {
		return effectiveRowWaveform(this.fields.timerRows[rowIndex], effectType);
	}

	rowWaveformLoop(rowIndex: number, effectType: AyTimerEffectType): number {
		return effectiveRowWaveformLoop(this.fields.timerRows[rowIndex], effectType);
	}

	formatRowWaveform(rowIndex: number, effectType: AyTimerEffectType): string {
		const waveform = this.rowWaveform(rowIndex, effectType);
		if (effectType === 'fm') {
			return formatAyFmWaveform(
				waveform,
				this.getAsHex(),
				resolveAyFmOffsetMode(this.fields.timerRows[rowIndex])
			);
		}
		if (effectType === 'envFm') {
			return formatAyFmWaveform(
				waveform,
				this.getAsHex(),
				resolveAyEnvFmOffsetMode(this.fields.timerRows[rowIndex])
			);
		}
		return formatAyTimerWaveform(waveform, this.getAsHex());
	}

	private waveformFieldKey(
		effectType: AyTimerEffectType
	): 'sidWaveform' | 'syncbuzzerWaveform' | 'fmWaveform' | 'envFmWaveform' {
		switch (effectType) {
			case 'sid':
				return 'sidWaveform';
			case 'syncbuzzer':
				return 'syncbuzzerWaveform';
			case 'fm':
				return 'fmWaveform';
			case 'envFm':
				return 'envFmWaveform';
		}
	}

	setRowWaveform(rowIndex: number, effectType: AyTimerEffectType, values: number[]): void {
		if (values.length === 0) {
			return;
		}
		const row = this.fields.timerRows[rowIndex];
		const fieldKey = this.waveformFieldKey(effectType);
		const nextWaveform =
			effectType === 'fm' || effectType === 'envFm'
				? values
						.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
						.map((value) =>
							clampFmWaveformValue(
								value,
								effectType === 'fm'
									? resolveAyFmOffsetMode(row)
									: resolveAyEnvFmOffsetMode(row)
							)
						)
				: values
						.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
						.map((value) => Math.max(0, Math.min(15, value | 0)));
		this.mapTimerRow(rowIndex, (current) => ({ ...current, [fieldKey]: nextWaveform }));
	}

	setRowWaveformStep(
		rowIndex: number,
		effectType: AyTimerEffectType,
		stepIndex: number,
		step: number
	): void {
		if (stepIndex < 0) return;
		const row = this.fields.timerRows[rowIndex];
		const clamped =
			effectType === 'fm' || effectType === 'envFm'
				? clampFmWaveformValue(
						step,
						effectType === 'fm'
							? resolveAyFmOffsetMode(row)
							: resolveAyEnvFmOffsetMode(row)
					)
				: Math.max(0, Math.min(15, step | 0));
		const nextWaveform = [...this.rowWaveform(rowIndex, effectType)];
		while (nextWaveform.length <= stepIndex && nextWaveform.length < AY_TIMER_WAVEFORM_MAX_LENGTH) {
			nextWaveform.push(0);
		}
		if (stepIndex >= nextWaveform.length) return;
		if (nextWaveform[stepIndex] === clamped) return;
		nextWaveform[stepIndex] = clamped;
		this.setRowWaveform(rowIndex, effectType, nextWaveform);
	}

	parseWaveform(text: string, rowIndex: number, effectType: AyTimerEffectType): number[] | null {
		const row = this.fields.timerRows[rowIndex];
		if (effectType === 'fm') {
			return parseAyFmWaveform(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		if (effectType === 'envFm') {
			return parseAyFmWaveform(text, this.getAsHex(), resolveAyEnvFmOffsetMode(row));
		}
		return parseAyTimerWaveform(text, this.getAsHex());
	}

	parseWaveformPartial(
		text: string,
		rowIndex: number,
		effectType: AyTimerEffectType
	): number[] | null {
		const row = this.fields.timerRows[rowIndex];
		if (effectType === 'fm') {
			return parseAyFmWaveformPartial(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		if (effectType === 'envFm') {
			return parseAyFmWaveformPartial(text, this.getAsHex(), resolveAyEnvFmOffsetMode(row));
		}
		return parseAyTimerWaveformPartial(text, this.getAsHex());
	}

	appendRowWaveformStep(
		rowIndex: number,
		effectType: AyTimerEffectType,
		step = 0
	): boolean {
		const current = this.rowWaveform(rowIndex, effectType);
		if (current.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			return false;
		}
		const row = this.fields.timerRows[rowIndex];
		const clamped =
			effectType === 'fm' || effectType === 'envFm'
				? clampFmWaveformValue(
						step,
						effectType === 'fm'
							? resolveAyFmOffsetMode(row)
							: resolveAyEnvFmOffsetMode(row)
					)
				: Math.max(0, Math.min(15, step | 0));
		this.setRowWaveform(rowIndex, effectType, [...current, clamped]);
		return true;
	}

	canAppendRowWaveformStep(rowIndex: number, effectType: AyTimerEffectType): boolean {
		return this.rowWaveform(rowIndex, effectType).length < AY_TIMER_WAVEFORM_MAX_LENGTH;
	}

	removeRowWaveformStep(rowIndex: number, effectType: AyTimerEffectType): boolean {
		const current = this.rowWaveform(rowIndex, effectType);
		if (current.length <= AY_TIMER_WAVEFORM_MIN_LENGTH) {
			return false;
		}
		this.setRowWaveform(rowIndex, effectType, current.slice(0, -1));
		return true;
	}

	canRemoveRowWaveformStep(rowIndex: number, effectType: AyTimerEffectType): boolean {
		return this.rowWaveform(rowIndex, effectType).length > AY_TIMER_WAVEFORM_MIN_LENGTH;
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

	rowSidEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.sid ?? false;
	}

	rowSyncbuzzerEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.syncbuzzer ?? false;
	}

	rowFmEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.fm ?? false;
	}

	rowEnvFmEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.envFm ?? false;
	}

	rowWaveformUsesEnvelopeShapes(index: number, effectType: AyTimerEffectType): boolean {
		return effectType === 'syncbuzzer';
	}

	rowFmOffsetMode(index: number): AyFmOffsetMode {
		return resolveAyFmOffsetMode(this.fields.timerRows[index]);
	}

	rowEnvFmOffsetMode(index: number): AyFmOffsetMode {
		return resolveAyEnvFmOffsetMode(this.fields.timerRows[index]);
	}

	rowWaveformUsesFmSemitones(index: number, effectType: AyTimerEffectType): boolean {
		if (effectType === 'fm') {
			return this.rowFmEnabled(index) && this.rowFmOffsetMode(index) === 'semitone';
		}
		if (effectType === 'envFm') {
			return this.rowEnvFmEnabled(index) && this.rowEnvFmOffsetMode(index) === 'semitone';
		}
		return false;
	}

	rowWaveformUsesFmPeriodOffsets(index: number, effectType: AyTimerEffectType): boolean {
		if (effectType === 'fm') {
			return this.rowFmEnabled(index) && this.rowFmOffsetMode(index) === 'period';
		}
		if (effectType === 'envFm') {
			return this.rowEnvFmEnabled(index) && this.rowEnvFmOffsetMode(index) === 'period';
		}
		return false;
	}

	activeEffectCount(rowIndex: number): number {
		return EFFECT_TYPES.filter((effectType) => this.isEffectEnabled(rowIndex, effectType)).length;
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
		if (isIncompleteSignedNumericToken(trimmed)) {
			return null;
		}
		if (this.getAsHex()) {
			let sign = 1;
			let temp = trimmed;
			if (temp.startsWith('-')) {
				sign = -1;
				temp = temp.substring(1);
			}
			if (temp.length === 0 || (sign < 0 && /^0+$/.test(temp))) {
				return null;
			}
			if (!/^[0-9a-fA-F]+$/.test(temp)) return null;
			return sign * parseInt(temp, 16);
		}
		if (!/^-?\d+$/.test(trimmed)) return null;
		return parseInt(trimmed, 10);
	}
}
