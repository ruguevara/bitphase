import { Instrument } from '../../models/song';
import {
	createDefaultAyTimerRow,
	DEFAULT_AY_TIMER_WAVEFORM,
	DEFAULT_AY_SYNCBUZZER_WAVEFORM,
	DEFAULT_AY_FM_WAVEFORM,
	DEFAULT_AY_FM_PERIOD_WAVEFORM,
	DEFAULT_AY_ENV_FM_WAVEFORM,
	defaultAyFmWaveform,
	defaultAyEnvFmWaveform,
	clampFmWaveformValue,
	clampFmPeriodOffset,
	clampFmSemitone,
	isIncompleteSignedNumericToken,
	effectiveRowDetune,
	effectiveRowFmWaveform,
	effectiveRowEnvFmWaveform,
	resolveAyFmOffsetMode,
	effectiveRowPeriod,
	effectiveScopeTimerPwmDuty,
	effectiveScopeTimerPwmSweep,
	effectiveScopeTimerPwmSweepMin,
	effectiveScopeTimerPwmSweepShape,
	effectiveScopeTimerPwmAutomationTrigger,
	effectiveScopeTimerPwmReverseSweep,
	effectiveRowTimerWaveform,
	effectiveRowTimerWaveformLoop,
	instrumentSupportsTimerPwm,
	instrumentScopeSupportsTimerPwm,
	normalizeAllInstrumentTimerPwmFields,
	normalizeInstrumentTimerPwmScopeFields,
	normalizeTimerPwmScopeFields,
	effectiveRowToneDetune,
	formatAyTimerWaveform,
	formatAyFmWaveform,
	formatAyEnvFmWaveform,
	isDefaultSidTimerWaveform,
	normalizeAyInstrumentFields,
	parseAyFmWaveform,
	parseAyFmWaveformPartial,
	parseAyEnvFmWaveform,
	parseAyEnvFmWaveformPartial,
	parseAyTimerWaveform,
	parseAyTimerWaveformPartial,
	resolveExclusiveTimerEffects,
	rowHasSidOrSyncbuzzer,
	resolveTimerWaveformEditLayer,
	resolveTimerWaveformStorageField,
	rowEffectiveWaveformForEditLayer,
	rowTimerWaveformEditLayers,
	type AyTimerWaveformEditLayer,
	clampTimerPwmDuty,
	clampTimerPwmSweep,
	clampTimerPwmSweepMin,
	normalizeTimerPwmSweepShape,
	type AyTimerPwmSweepShape,
	AY_TIMER_WAVEFORM_MIN_LENGTH,
	AY_TIMER_WAVEFORM_MAX_LENGTH,
	type AyFmOffsetMode,
	type AyInstrumentFields,
	type AyTimerPwmScope,
	AY_TIMER_PWM_SCOPES,
	type AyTimerPwmAutomationTrigger,
	type AyTimerRow
} from './instrument';

type ExtendedInstrument = Instrument & Partial<AyInstrumentFields>;

export class AyTimerEffectsController {
	fields = $state(normalizeAyInstrumentFields(new Instrument('', [])));
	waveformEditorRowIndex = $state<number | null>(null);
	waveformEditLayerByRow = $state<Partial<Record<number, AyTimerWaveformEditLayer>>>({});
	isDragging = $state(false);
	dragType = $state<'sid' | 'syncbuzzer' | 'fm' | 'envfm' | null>(null);
	dragBooleanValue = $state<boolean | null>(null);

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
			...normalizeAllInstrumentTimerPwmFields(normalized)
		};
		if (
			this.waveformEditorRowIndex !== null &&
			this.waveformEditorRowIndex >= timerRows.length
		) {
			this.waveformEditorRowIndex = null;
		}
		this.lastSyncedRowCount = instrument.rows.length;
		this.lastInstrumentId = instrument.id;
		this.syncWaveformEditLayers();
	}

	stopDrag(): void {
		this.isDragging = false;
		this.dragType = null;
		this.dragBooleanValue = null;
	}

	private syncWaveformEditLayers(): void {
		const next: Partial<Record<number, AyTimerWaveformEditLayer>> = {};
		for (let index = 0; index < this.fields.timerRows.length; index++) {
			const layer = resolveTimerWaveformEditLayer(
				this.fields.timerRows[index],
				this.waveformEditLayerByRow[index]
			);
			next[index] = layer;
		}
		this.waveformEditLayerByRow = next;
	}

	private afterTimerRowMutation(): void {
		this.syncWaveformEditLayers();
	}

	rowTimerWaveformEditLayers(rowIndex: number): AyTimerWaveformEditLayer[] {
		return rowTimerWaveformEditLayers(this.fields.timerRows[rowIndex]);
	}

	rowHasMultipleTimerWaveformEditLayers(rowIndex: number): boolean {
		return this.rowTimerWaveformEditLayers(rowIndex).length > 1;
	}

	rowTimerWaveformEditLayer(rowIndex: number): AyTimerWaveformEditLayer {
		return resolveTimerWaveformEditLayer(
			this.fields.timerRows[rowIndex],
			this.waveformEditLayerByRow[rowIndex]
		);
	}

	setRowTimerWaveformEditLayer(rowIndex: number, layer: AyTimerWaveformEditLayer): void {
		if (!this.rowTimerWaveformEditLayers(rowIndex).includes(layer)) {
			return;
		}
		this.waveformEditLayerByRow[rowIndex] = layer;
	}

	openWaveformEditor(rowIndex: number): void {
		if (rowIndex < 0 || rowIndex >= this.fields.timerRows.length) {
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
		this.syncWaveformEditLayers();
		this.updateInstrument({
			timerRows: next.timerRows,
			timerPwmSidSyncDuty: next.timerPwmSidSyncDuty,
			timerPwmSidSyncSweepMin: next.timerPwmSidSyncSweepMin,
			timerPwmSidSyncSweep: next.timerPwmSidSyncSweep,
			timerPwmSidSyncSweepShape: next.timerPwmSidSyncSweepShape,
			timerPwmSidSyncAutomationTrigger: next.timerPwmSidSyncAutomationTrigger,
			timerPwmSidSyncReverseSweep: next.timerPwmSidSyncReverseSweep,
			timerPwmFmDuty: next.timerPwmFmDuty,
			timerPwmFmSweepMin: next.timerPwmFmSweepMin,
			timerPwmFmSweep: next.timerPwmFmSweep,
			timerPwmFmSweepShape: next.timerPwmFmSweepShape,
			timerPwmFmAutomationTrigger: next.timerPwmFmAutomationTrigger,
			timerPwmFmReverseSweep: next.timerPwmFmReverseSweep,
			timerPwmEfmDuty: next.timerPwmEfmDuty,
			timerPwmEfmSweepMin: next.timerPwmEfmSweepMin,
			timerPwmEfmSweep: next.timerPwmEfmSweep,
			timerPwmEfmSweepShape: next.timerPwmEfmSweepShape,
			timerPwmEfmAutomationTrigger: next.timerPwmEfmAutomationTrigger,
			timerPwmEfmReverseSweep: next.timerPwmEfmReverseSweep
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

	instrumentScopeSupportsTimerPwm(scope: AyTimerPwmScope): boolean {
		return instrumentScopeSupportsTimerPwm(this.fields, scope);
	}

	timerPwmDuty(scope: AyTimerPwmScope): number {
		return effectiveScopeTimerPwmDuty(this.fields, scope);
	}

	timerPwmSweepMin(scope: AyTimerPwmScope): number {
		return effectiveScopeTimerPwmSweepMin(this.fields, scope);
	}

	timerPwmSweep(scope: AyTimerPwmScope): number {
		return effectiveScopeTimerPwmSweep(this.fields, scope);
	}

	timerPwmSweepShape(scope: AyTimerPwmScope): AyTimerPwmSweepShape {
		return effectiveScopeTimerPwmSweepShape(this.fields, scope);
	}

	timerPwmScopeHasActiveSweep(scope: AyTimerPwmScope): boolean {
		return AY_TIMER_PWM_SCOPES.some(
			(entry) => entry === scope && this.instrumentScopeSupportsTimerPwm(scope) && this.timerPwmSweep(scope) > 0
		);
	}

	timerPwmAnyScopeHasActiveSweep(): boolean {
		return AY_TIMER_PWM_SCOPES.some((scope) => this.timerPwmScopeHasActiveSweep(scope));
	}

	timerPwmAutomationTrigger(scope: AyTimerPwmScope): AyTimerPwmAutomationTrigger {
		return effectiveScopeTimerPwmAutomationTrigger(this.fields, scope);
	}

	setTimerPwmAutomationTrigger(scope: AyTimerPwmScope, trigger: AyTimerPwmAutomationTrigger): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope)) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		this.commitFields(
			this.applyTimerPwmScopeFields(scope, {
				...scoped,
				automationTrigger: trigger
			})
		);
	}

	timerPwmReverseSweep(scope: AyTimerPwmScope): boolean {
		return effectiveScopeTimerPwmReverseSweep(this.fields, scope);
	}

	setTimerPwmReverseSweep(scope: AyTimerPwmScope, reverse: boolean): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope) || this.timerPwmSweep(scope) <= 0) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		this.commitFields(
			this.applyTimerPwmScopeFields(scope, {
				...scoped,
				reverseSweep: reverse
			})
		);
	}

	setTimerPwmSweepShape(scope: AyTimerPwmScope, shape: AyTimerPwmSweepShape): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope)) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		this.commitFields(
			this.applyTimerPwmScopeFields(scope, {
				...scoped,
				sweepShape: normalizeTimerPwmSweepShape(shape)
			})
		);
	}

	setTimerPwmDuty(scope: AyTimerPwmScope, duty: number): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope)) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		const nextScope = normalizeTimerPwmScopeFields({
			...scoped,
			duty: clampTimerPwmDuty(duty)
		});
		this.commitFields(this.applyTimerPwmScopeFields(scope, nextScope));
	}

	setTimerPwmSweepMin(scope: AyTimerPwmScope, min: number): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope) || this.timerPwmSweep(scope) <= 0) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		const nextScope = normalizeTimerPwmScopeFields({
			...scoped,
			sweepMin: clampTimerPwmSweepMin(min, scoped.duty)
		});
		this.commitFields(this.applyTimerPwmScopeFields(scope, nextScope));
	}

	updateTimerPwmSweep(scope: AyTimerPwmScope, text: string): void {
		if (!this.instrumentScopeSupportsTimerPwm(scope)) return;
		const parsed = this.parseNum(text);
		if (parsed === null) return;
		const scoped = normalizeInstrumentTimerPwmScopeFields(this.fields, scope);
		const nextScope = normalizeTimerPwmScopeFields({
			...scoped,
			sweep: clampTimerPwmSweep(parsed)
		});
		this.commitFields(this.applyTimerPwmScopeFields(scope, nextScope));
	}

	private applyTimerPwmScopeFields(
		scope: AyTimerPwmScope,
		fields: {
			duty: number;
			sweepMin: number;
			sweep: number;
			sweepShape: AyTimerPwmSweepShape;
			automationTrigger: AyTimerPwmAutomationTrigger;
			reverseSweep: boolean;
		}
	): AyInstrumentFields {
		if (scope === 'sidSync') {
			return {
				...this.fields,
				timerPwmSidSyncDuty: fields.duty,
				timerPwmSidSyncSweepMin: fields.sweepMin,
				timerPwmSidSyncSweep: fields.sweep,
				timerPwmSidSyncSweepShape: fields.sweepShape,
				timerPwmSidSyncAutomationTrigger: fields.automationTrigger,
				timerPwmSidSyncReverseSweep: fields.reverseSweep
			};
		}
		if (scope === 'fm') {
			return {
				...this.fields,
				timerPwmFmDuty: fields.duty,
				timerPwmFmSweepMin: fields.sweepMin,
				timerPwmFmSweep: fields.sweep,
				timerPwmFmSweepShape: fields.sweepShape,
				timerPwmFmAutomationTrigger: fields.automationTrigger,
				timerPwmFmReverseSweep: fields.reverseSweep
			};
		}
		return {
			...this.fields,
			timerPwmEfmDuty: fields.duty,
			timerPwmEfmSweepMin: fields.sweepMin,
			timerPwmEfmSweep: fields.sweep,
			timerPwmEfmSweepShape: fields.sweepShape,
			timerPwmEfmAutomationTrigger: fields.automationTrigger,
			timerPwmEfmReverseSweep: fields.reverseSweep
		};
	}

	parseTimerPwmNum(text: string): number | null {
		return this.parseNum(text);
	}

	usesHexNumerals(): boolean {
		return this.getAsHex();
	}

	updateSidRow(index: number, sid: boolean): void {
		this.mapTimerRow(index, (row) => {
			const wasSync = row.syncbuzzer;
			const hadSidOrSync = rowHasSidOrSyncbuzzer(row);
			const resolved = resolveExclusiveTimerEffects({
				...row,
				sid,
				syncbuzzer: sid ? false : row.syncbuzzer
			});
			if (!sid) {
				return resolved;
			}
			const next: AyTimerRow = { ...resolved };
			if (!hadSidOrSync && (row.fm || row.envfm)) {
				if (row.fm) {
					next.fmTimerWaveform = effectiveRowFmWaveform(row);
				}
				if (row.envfm) {
					next.envFmTimerWaveform = effectiveRowEnvFmWaveform(row);
				}
				next.timerWaveform = [...DEFAULT_AY_TIMER_WAVEFORM];
			} else if (wasSync || isDefaultSidTimerWaveform(effectiveRowTimerWaveform(resolved))) {
				next.timerWaveform = [...DEFAULT_AY_TIMER_WAVEFORM];
			}
			return next;
		});
		if (sid) {
			this.waveformEditLayerByRow[index] = 'sid';
		}
	}

	updateSyncbuzzerRow(index: number, syncbuzzer: boolean): void {
		this.mapTimerRow(index, (row) => {
			const hadSidOrSync = rowHasSidOrSyncbuzzer(row);
			const resolved = resolveExclusiveTimerEffects({
				...row,
				syncbuzzer,
				sid: syncbuzzer ? false : row.sid
			});
			if (!syncbuzzer) {
				return resolved;
			}
			const next: AyTimerRow = { ...resolved };
			if (!hadSidOrSync && row.fm) {
				next.fmTimerWaveform = effectiveRowFmWaveform(row);
			}
			if (!hadSidOrSync && row.envfm) {
				next.envFmTimerWaveform = effectiveRowEnvFmWaveform(row);
			}
			if (
				!hadSidOrSync ||
				isDefaultSidTimerWaveform(effectiveRowTimerWaveform(resolved))
			) {
				next.timerWaveform = [...DEFAULT_AY_SYNCBUZZER_WAVEFORM];
			}
			return next;
		});
		if (syncbuzzer) {
			this.waveformEditLayerByRow[index] = 'syncbuzzer';
		}
	}

	updateFmRow(index: number, fm: boolean): void {
		this.mapTimerRow(index, (row) => {
			const resolved = { ...row, fm };
			if (!fm) {
				return resolved;
			}
			if (rowHasSidOrSyncbuzzer(row)) {
				return {
					...resolved,
					fmTimerWaveform: row.fmTimerWaveform?.length
						? row.fmTimerWaveform
						: defaultAyFmWaveform(resolveAyFmOffsetMode(resolved))
				};
			}
			if (
				isDefaultSidTimerWaveform(effectiveRowTimerWaveform(resolved)) ||
				!row.timerWaveform?.length
			) {
				return {
					...resolved,
					timerWaveform: defaultAyFmWaveform(resolveAyFmOffsetMode(resolved))
				};
			}
			return resolved;
		});
		if (fm) {
			this.waveformEditLayerByRow[index] = 'fm';
		}
	}

	updateEnvfmRow(index: number, envfm: boolean): void {
		this.mapTimerRow(index, (row) => {
			const resolved = { ...row, envfm };
			if (!envfm) {
				return resolved;
			}
			if (rowHasSidOrSyncbuzzer(row) || row.fm) {
				return {
					...resolved,
					fmOffsetMode: 'period',
					envFmTimerWaveform: row.envFmTimerWaveform?.length
						? row.envFmTimerWaveform
						: defaultAyEnvFmWaveform('period')
				};
			}
			if (
				isDefaultSidTimerWaveform(effectiveRowTimerWaveform(resolved)) ||
				!row.timerWaveform?.length
			) {
				return {
					...resolved,
					fmOffsetMode: 'period',
					timerWaveform: defaultAyEnvFmWaveform('period')
				};
			}
			return resolved;
		});
		if (envfm) {
			this.waveformEditLayerByRow[index] = 'envfm';
		}
	}

	updateFmOffsetMode(index: number, mode: AyFmOffsetMode): void {
		this.mapTimerRow(index, (row) => {
			if (!row.fm && !row.envfm) {
				return { ...row, fmOffsetMode: mode };
			}
			const currentMode = resolveAyFmOffsetMode(row);
			if (currentMode === mode) {
				return row;
			}
			const currentWaveform = row.fm
				? effectiveRowFmWaveform({ ...row, fmOffsetMode: currentMode })
				: effectiveRowEnvFmWaveform({ ...row, fmOffsetMode: currentMode });
			const usesDefaultWaveform = row.fm
				? currentMode === 'semitone'
					? currentWaveform.every(
							(value, stepIndex) =>
								clampFmSemitone(value) === clampFmSemitone(DEFAULT_AY_FM_WAVEFORM[stepIndex] ?? 0)
						) && currentWaveform.length === DEFAULT_AY_FM_WAVEFORM.length
					: currentWaveform.every(
							(value, stepIndex) =>
								clampFmPeriodOffset(value) ===
								clampFmPeriodOffset(DEFAULT_AY_FM_PERIOD_WAVEFORM[stepIndex] ?? 0)
						) && currentWaveform.length === DEFAULT_AY_FM_PERIOD_WAVEFORM.length
				: currentMode === 'semitone'
					? currentWaveform.every(
							(value, stepIndex) =>
								clampFmSemitone(value) === clampFmSemitone(DEFAULT_AY_FM_WAVEFORM[stepIndex] ?? 0)
						) && currentWaveform.length === DEFAULT_AY_FM_WAVEFORM.length
					: currentWaveform.every(
							(value, stepIndex) =>
								clampFmPeriodOffset(value) ===
								clampFmPeriodOffset(DEFAULT_AY_ENV_FM_WAVEFORM[stepIndex] ?? 0)
						) && currentWaveform.length === DEFAULT_AY_ENV_FM_WAVEFORM.length;
			return {
				...row,
				fmOffsetMode: mode,
				...(row.fm
					? rowHasSidOrSyncbuzzer(row)
						? {
								fmTimerWaveform: usesDefaultWaveform
									? defaultAyFmWaveform(mode)
									: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
							}
						: {
								timerWaveform: usesDefaultWaveform
									? defaultAyFmWaveform(mode)
									: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
							}
					: rowHasSidOrSyncbuzzer(row) || row.fm
						? {
								envFmTimerWaveform: usesDefaultWaveform
									? defaultAyEnvFmWaveform(mode)
									: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
							}
						: {
								timerWaveform: usesDefaultWaveform
									? defaultAyEnvFmWaveform(mode)
									: currentWaveform.map((value) => clampFmWaveformValue(value, mode))
							})
			};
		});
	}

	toggleFmOffsetMode(index: number): void {
		const row = this.fields.timerRows[index];
		if (!row?.fm && !row?.envfm) return;
		const nextMode = resolveAyFmOffsetMode(row) === 'period' ? 'semitone' : 'period';
		this.updateFmOffsetMode(index, nextMode);
	}

	beginDragSid(index: number): void {
		this.isDragging = true;
		this.dragType = 'sid';
		this.dragBooleanValue = !this.fields.timerRows[index].sid;
		this.updateSidRow(index, this.dragBooleanValue);
	}

	dragOverSid(index: number): void {
		if (this.isDragging && this.dragBooleanValue !== null) {
			this.updateSidRow(index, this.dragBooleanValue);
		}
	}

	beginDragSyncbuzzer(index: number): void {
		this.isDragging = true;
		this.dragType = 'syncbuzzer';
		this.dragBooleanValue = !this.fields.timerRows[index]?.syncbuzzer;
		this.updateSyncbuzzerRow(index, this.dragBooleanValue);
	}

	dragOverSyncbuzzer(index: number): void {
		if (this.isDragging && this.dragBooleanValue !== null) {
			this.updateSyncbuzzerRow(index, this.dragBooleanValue);
		}
	}

	beginDragFm(index: number): void {
		this.isDragging = true;
		this.dragType = 'fm';
		this.dragBooleanValue = !this.fields.timerRows[index]?.fm;
		this.updateFmRow(index, this.dragBooleanValue);
	}

	dragOverFm(index: number): void {
		if (this.isDragging && this.dragBooleanValue !== null) {
			this.updateFmRow(index, this.dragBooleanValue);
		}
	}

	beginDragEnvfm(index: number): void {
		this.isDragging = true;
		this.dragType = 'envfm';
		this.dragBooleanValue = !this.fields.timerRows[index]?.envfm;
		this.updateEnvfmRow(index, this.dragBooleanValue);
	}

	dragOverEnvfm(index: number): void {
		if (this.isDragging && this.dragBooleanValue !== null) {
			this.updateEnvfmRow(index, this.dragBooleanValue);
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
		const row = this.fields.timerRows[rowIndex];
		return rowEffectiveWaveformForEditLayer(row, this.rowTimerWaveformEditLayer(rowIndex));
	}

	private clampWaveformValuesForEditLayer(
		row: AyTimerRow | undefined,
		layer: AyTimerWaveformEditLayer,
		values: readonly number[]
	): number[] {
		if (layer === 'fm' || layer === 'envfm') {
			return values
				.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
				.map((value) => clampFmWaveformValue(value, resolveAyFmOffsetMode(row)));
		}
		return values
			.slice(0, AY_TIMER_WAVEFORM_MAX_LENGTH)
			.map((value) => Math.max(0, Math.min(15, value | 0)));
	}

	rowTimerWaveformLoop(rowIndex: number): number {
		return effectiveRowTimerWaveformLoop(this.fields.timerRows[rowIndex]);
	}

	formatRowTimerWaveform(rowIndex: number): string {
		const row = this.fields.timerRows[rowIndex];
		const layer = this.rowTimerWaveformEditLayer(rowIndex);
		const waveform = this.rowTimerWaveform(rowIndex);
		if (layer === 'envfm') {
			return formatAyEnvFmWaveform(waveform, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		if (layer === 'fm') {
			return formatAyFmWaveform(waveform, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		return formatAyTimerWaveform(waveform, this.getAsHex());
	}

	setRowTimerWaveform(rowIndex: number, values: number[]): void {
		if (values.length === 0) {
			return;
		}
		const layer = this.rowTimerWaveformEditLayer(rowIndex);
		const nextWaveform = this.clampWaveformValuesForEditLayer(
			this.fields.timerRows[rowIndex],
			layer,
			values
		);
		this.mapTimerRow(rowIndex, (current) => ({
			...current,
			[resolveTimerWaveformStorageField(current, layer)]: nextWaveform
		}));
	}

	setRowWaveformStep(rowIndex: number, stepIndex: number, step: number): void {
		if (stepIndex < 0) return;
		const row = this.fields.timerRows[rowIndex];
		const layer = this.rowTimerWaveformEditLayer(rowIndex);
		const clamped =
			layer === 'fm' || layer === 'envfm'
				? clampFmWaveformValue(step, resolveAyFmOffsetMode(row))
				: Math.max(0, Math.min(15, step | 0));
		const nextWaveform = [...this.rowTimerWaveform(rowIndex)];
		while (nextWaveform.length <= stepIndex && nextWaveform.length < AY_TIMER_WAVEFORM_MAX_LENGTH) {
			nextWaveform.push(0);
		}
		if (stepIndex >= nextWaveform.length) return;
		if (nextWaveform[stepIndex] === clamped) return;
		nextWaveform[stepIndex] = clamped;
		this.mapTimerRow(rowIndex, (current) => ({
			...current,
			[resolveTimerWaveformStorageField(current, layer)]: nextWaveform
		}));
	}

	parseTimerWaveform(text: string, rowIndex?: number): number[] | null {
		const row = rowIndex !== undefined ? this.fields.timerRows[rowIndex] : undefined;
		const layer =
			rowIndex !== undefined ? this.rowTimerWaveformEditLayer(rowIndex) : undefined;
		if (layer === 'envfm') {
			return parseAyEnvFmWaveform(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		if (layer === 'fm') {
			return parseAyFmWaveform(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		return parseAyTimerWaveform(text, this.getAsHex());
	}

	parseTimerWaveformPartial(text: string, rowIndex?: number): number[] | null {
		const row = rowIndex !== undefined ? this.fields.timerRows[rowIndex] : undefined;
		const layer =
			rowIndex !== undefined ? this.rowTimerWaveformEditLayer(rowIndex) : undefined;
		if (layer === 'envfm') {
			return parseAyEnvFmWaveformPartial(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		if (layer === 'fm') {
			return parseAyFmWaveformPartial(text, this.getAsHex(), resolveAyFmOffsetMode(row));
		}
		return parseAyTimerWaveformPartial(text, this.getAsHex());
	}

	appendRowWaveformStep(rowIndex: number, step = 0): boolean {
		const current = this.rowTimerWaveform(rowIndex);
		if (current.length >= AY_TIMER_WAVEFORM_MAX_LENGTH) {
			return false;
		}
		const row = this.fields.timerRows[rowIndex];
		const layer = this.rowTimerWaveformEditLayer(rowIndex);
		const clamped =
			layer === 'fm' || layer === 'envfm'
				? clampFmWaveformValue(step, resolveAyFmOffsetMode(row))
				: Math.max(0, Math.min(15, step | 0));
		this.mapTimerRow(rowIndex, (currentRow) => ({
			...currentRow,
			[resolveTimerWaveformStorageField(currentRow, layer)]: [...current, clamped]
		}));
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
		const layer = this.rowTimerWaveformEditLayer(rowIndex);
		this.mapTimerRow(rowIndex, (row) => ({
			...row,
			[resolveTimerWaveformStorageField(row, layer)]: current.slice(0, -1)
		}));
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

	rowSidEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.sid ?? false;
	}

	rowSyncbuzzerEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.syncbuzzer ?? false;
	}

	rowFmEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.fm ?? false;
	}

	rowEnvfmEnabled(index: number): boolean {
		return this.fields.timerRows[index]?.envfm ?? false;
	}

	rowTimerWaveformUsesEnvelopeShapes(index: number): boolean {
		return this.rowTimerWaveformEditLayer(index) === 'syncbuzzer';
	}

	rowTimerWaveformUsesEnvFmOffsets(index: number): boolean {
		return (
			this.rowTimerWaveformEditLayer(index) === 'envfm' &&
			this.rowFmOffsetMode(index) === 'period'
		);
	}

	rowFmOffsetMode(index: number): AyFmOffsetMode {
		return resolveAyFmOffsetMode(this.fields.timerRows[index]);
	}

	rowTimerWaveformUsesFmSemitones(index: number): boolean {
		const layer = this.rowTimerWaveformEditLayer(index);
		return (layer === 'fm' || layer === 'envfm') && this.rowFmOffsetMode(index) === 'semitone';
	}

	rowTimerWaveformUsesFmPeriodOffsets(index: number): boolean {
		return this.rowTimerWaveformEditLayer(index) === 'fm' && this.rowFmOffsetMode(index) === 'period';
	}

	rowTimerWaveformEditLayerUsesFmOffsetMode(index: number): boolean {
		const layer = this.rowTimerWaveformEditLayer(index);
		return layer === 'fm' || layer === 'envfm';
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
