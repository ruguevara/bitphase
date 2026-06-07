<script lang="ts">
	import { tick } from 'svelte';
	import IconCarbonAlignHorizontalLeft from '~icons/carbon/align-horizontal-left';
	import IconCarbonAlignHorizontalRight from '~icons/carbon/align-horizontal-right';
	import IconCarbonRepeat from '~icons/carbon/repeat';
	import type { AyChipVariant } from '../../chips/ay/ay-sample-lut';
	import { sampleByteToDisplayFloat } from '../../chips/ay/ay-sample-lut';
	import type { WaveformPeak } from '../../utils/audio-sample-decode';
	import { normalizeWaveformPeaksForDisplay } from '../../utils/audio-sample-decode';

	type DragMode = 'start' | 'end' | 'loop' | 'move' | null;

	type EditorBounds = {
		start: number;
		end: number;
		loopStart: number;
		dataLength: number;
	};

	let {
		peaks = [],
		sampleData = undefined,
		chipVariant = 'AY',
		height = 140,
		totalSamples = 0,
		regionStart = $bindable(0),
		regionEnd = $bindable(0),
		loopStart = $bindable(0),
		loopEnabled = $bindable(true),
		onRegionCommit
	}: {
		peaks?: WaveformPeak[];
		sampleData?: Uint8Array;
		chipVariant?: AyChipVariant;
		height?: number;
		totalSamples?: number;
		regionStart?: number;
		regionEnd?: number;
		loopStart?: number;
		loopEnabled?: boolean;
		onRegionCommit?: (start: number, end: number, loopPoint: number) => void;
	} = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let rootEl: HTMLDivElement | null = $state(null);
	let dragMode = $state<DragMode>(null);
	let dragAnchorSample = $state(0);
	let dragAnchorStart = $state(0);
	let dragAnchorEnd = $state(0);
	let dragAnchorLoopStart = $state(0);
	let windowDragCleanup: (() => void) | null = null;

	const displayPeaks = $derived(normalizeWaveformPeaksForDisplay(peaks));

	const bounds = $derived.by((): EditorBounds | null => {
		if (totalSamples < 1) return null;
		let start = Math.max(0, Math.min(totalSamples - 1, Math.floor(regionStart)));
		let end = Math.max(start, Math.min(totalSamples - 1, Math.floor(regionEnd)));
		let loop = Math.max(start, Math.min(end, Math.floor(loopStart)));
		return { start, end, loopStart: loop, dataLength: totalSamples };
	});

	const startPercent = $derived(
		totalSamples > 0 ? ((bounds?.start ?? 0) / totalSamples) * 100 : 0
	);
	const endPercent = $derived(
		totalSamples > 0 ? (((bounds?.end ?? 0) + 1) / totalSamples) * 100 : 100
	);
	const loopPercent = $derived(
		totalSamples > 0 ? ((bounds?.loopStart ?? 0) / totalSamples) * 100 : 0
	);

	function resolveStrokeColor(el: HTMLCanvasElement): string {
		const fromCanvas = getComputedStyle(el).getPropertyValue('--color-pattern-note').trim();
		if (fromCanvas) return fromCanvas;
		const fromRoot = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-pattern-note')
			.trim();
		return fromRoot || '#89b4fa';
	}

	function resolvePrimaryColor(): string {
		const fromRoot = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-app-primary')
			.trim();
		return fromRoot || '#89b4fa';
	}

	function resolveLoopAccentColor(): string {
		const fromRoot = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-app-secondary')
			.trim();
		return fromRoot || '#b4befe';
	}

	function colorWithAlpha(color: string, alpha: number): string {
		if (!color.startsWith('#')) {
			return color;
		}
		const normalized = color.slice(1);
		const full =
			normalized.length === 3
				? normalized
						.split('')
						.map((channel) => channel + channel)
						.join('')
				: normalized;
		const red = Number.parseInt(full.slice(0, 2), 16);
		const green = Number.parseInt(full.slice(2, 4), 16);
		const blue = Number.parseInt(full.slice(4, 6), 16);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function drawRegionOverlay(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		total: number,
		start: number,
		end: number,
		loopPoint: number,
		showLoop: boolean
	): void {
		if (total < 1 || end < start) return;

		const playStartX = (start / total) * width;
		const playEndX = ((end + 1) / total) * width;
		const loopStartX = (loopPoint / total) * width;

		ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
		if (playStartX > 0) ctx.fillRect(0, 0, playStartX, canvasHeight);
		if (playEndX < width) ctx.fillRect(playEndX, 0, width - playEndX, canvasHeight);

		const primary = resolvePrimaryColor();
		const loopAccent = resolveLoopAccentColor();
		const playFill = primary.startsWith('#') ? `${primary}18` : 'rgba(137, 180, 250, 0.12)';
		const loopFill = colorWithAlpha(loopAccent, 0.2);

		ctx.fillStyle = playFill;
		ctx.fillRect(playStartX, 0, playEndX - playStartX, canvasHeight);

		if (showLoop && loopPoint > start) {
			ctx.fillStyle = loopFill;
			ctx.fillRect(loopStartX, 0, playEndX - loopStartX, canvasHeight);
		}

		if (showLoop) {
			ctx.strokeStyle = colorWithAlpha(loopAccent, 0.95);
			ctx.lineWidth = Math.max(1, Math.floor((window.devicePixelRatio ?? 1) * 1.5));
			ctx.setLineDash([4 * (window.devicePixelRatio ?? 1), 3 * (window.devicePixelRatio ?? 1)]);
			ctx.beginPath();
			ctx.moveTo(loopStartX, 0);
			ctx.lineTo(loopStartX, canvasHeight);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	function sampleToCanvasY(
		sampleValue: number,
		midY: number,
		halfHeight: number,
		variant: AyChipVariant
	): number {
		return midY - sampleByteToDisplayFloat(sampleValue, variant) * halfHeight;
	}

	function drawDacSteppedWaveform(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		samples: Uint8Array,
		strokeColor: string,
		variant: AyChipVariant
	): void {
		const sampleCount = samples.length;
		if (sampleCount < 1) return;

		const midY = canvasHeight / 2;
		const halfHeight = canvasHeight * 0.38;
		const stepWidth = width / sampleCount;

		ctx.fillStyle = strokeColor;
		ctx.globalAlpha = 0.35;
		ctx.beginPath();
		ctx.moveTo(0, midY);
		for (let i = 0; i < sampleCount; i++) {
			const y = sampleToCanvasY(samples[i], midY, halfHeight, variant);
			const xStart = i * stepWidth;
			const xEnd = (i + 1) * stepWidth;
			ctx.lineTo(xStart, y);
			ctx.lineTo(xEnd, y);
		}
		ctx.lineTo(width, midY);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = strokeColor;
		ctx.globalAlpha = 0.95;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < sampleCount; i++) {
			const y = sampleToCanvasY(samples[i], midY, halfHeight, variant);
			const xStart = i * stepWidth;
			const xEnd = (i + 1) * stepWidth;
			if (i === 0) {
				ctx.moveTo(xStart, y);
			} else {
				ctx.lineTo(xStart, y);
			}
			ctx.lineTo(xEnd, y);
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	function drawPeakWaveform(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		data: WaveformPeak[],
		strokeColor: string
	): void {
		const midY = canvasHeight / 2;
		const halfHeight = canvasHeight * 0.38;
		const stepX = width / data.length;

		ctx.fillStyle = strokeColor;
		ctx.globalAlpha = 0.38;
		for (let i = 0; i < data.length; i++) {
			const x = Math.floor(i * stepX);
			const nextX = Math.floor((i + 1) * stepX);
			const colWidth = Math.max(1, nextX - x);
			const topY = midY - data[i].max * halfHeight;
			const bottomY = midY - data[i].min * halfHeight;
			ctx.fillRect(x, topY, colWidth, Math.max(1, bottomY - topY));
		}
		ctx.globalAlpha = 1;

		ctx.globalAlpha = 1;
	}

	function drawPeaks(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		data: WaveformPeak[],
		strokeColor: string,
		editorBounds: EditorBounds,
		samples: Uint8Array | undefined,
		variant: AyChipVariant
	): void {
		ctx.clearRect(0, 0, width, canvasHeight);

		const midY = canvasHeight / 2;
		if (samples?.length) {
			drawDacSteppedWaveform(ctx, width, canvasHeight, samples, strokeColor, variant);
		} else if (data.length > 0) {
			drawPeakWaveform(ctx, width, canvasHeight, data, strokeColor);
		} else {
			ctx.strokeStyle = strokeColor;
			ctx.globalAlpha = 0.35;
			ctx.beginPath();
			ctx.moveTo(0, midY);
			ctx.lineTo(width, midY);
			ctx.stroke();
			ctx.globalAlpha = 1;
		}

		ctx.strokeStyle = strokeColor;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, midY);
		ctx.lineTo(width, midY);
		ctx.stroke();
		ctx.globalAlpha = 1;

		drawRegionOverlay(
			ctx,
			width,
			canvasHeight,
			editorBounds.dataLength,
			editorBounds.start,
			editorBounds.end,
			editorBounds.loopStart,
			loopEnabled
		);
	}

	function paintCanvas(): void {
		const el = canvasEl;
		const editorBounds = bounds;
		if (!el || !editorBounds) return;

		const rect = el.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;

		const dpr = window.devicePixelRatio ?? 1;
		const w = Math.max(1, Math.floor(rect.width * dpr));
		const h = Math.max(1, Math.floor(rect.height * dpr));
		if (el.width !== w || el.height !== h) {
			el.width = w;
			el.height = h;
		}

		const ctx = el.getContext('2d');
		if (!ctx) return;

		drawPeaks(ctx, w, h, displayPeaks, resolveStrokeColor(el), editorBounds, sampleData, chipVariant);
	}

	function sampleIndexFromClientX(clientX: number): number {
		const rect = rootEl?.getBoundingClientRect();
		if (!rect || rect.width < 1 || totalSamples < 1) return 0;
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		return Math.round(ratio * (totalSamples - 1));
	}

	function commitBounds(start: number, end: number, loopPoint: number): void {
		const clampedStart = Math.max(0, Math.min(totalSamples - 1, Math.floor(start)));
		const clampedEnd = Math.max(clampedStart, Math.min(totalSamples - 1, Math.floor(end)));
		const clampedLoop = Math.max(clampedStart, Math.min(clampedEnd, Math.floor(loopPoint)));
		regionStart = clampedStart;
		regionEnd = clampedEnd;
		loopStart = clampedLoop;
	}

	function notifyRegionCommit(): void {
		onRegionCommit?.(regionStart, regionEnd, loopStart);
	}

	const maxSampleIndex = $derived(Math.max(0, totalSamples - 1));

	function commitManualField(field: 'start' | 'end' | 'loop', rawValue: number): void {
		if (!Number.isFinite(rawValue) || totalSamples < 1) return;
		if (field === 'start') {
			commitBounds(rawValue, regionEnd, loopStart);
		} else if (field === 'end') {
			commitBounds(regionStart, rawValue, loopStart);
		} else {
			commitBounds(regionStart, regionEnd, rawValue);
		}
		notifyRegionCommit();
	}

	function handleManualFieldCommit(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const field = input.dataset.field as 'start' | 'end' | 'loop' | undefined;
		if (!field) return;
		commitManualField(field, Number.parseInt(input.value, 10));
	}

	function handleManualFieldKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter') return;
		handleManualFieldCommit(event);
		(event.currentTarget as HTMLInputElement).blur();
	}

	function applyDrag(sampleIndex: number): void {
		if (!dragMode || totalSamples < 1) return;

		if (dragMode === 'start') {
			const nextStart = Math.max(0, Math.min(dragAnchorEnd, sampleIndex));
			const nextLoop = Math.max(nextStart, Math.min(dragAnchorEnd, dragAnchorLoopStart));
			commitBounds(nextStart, dragAnchorEnd, nextLoop);
			return;
		}

		if (dragMode === 'end') {
			const nextEnd = Math.max(dragAnchorStart, Math.min(totalSamples - 1, sampleIndex));
			const nextLoop = Math.max(dragAnchorStart, Math.min(nextEnd, dragAnchorLoopStart));
			commitBounds(dragAnchorStart, nextEnd, nextLoop);
			return;
		}

		if (dragMode === 'loop') {
			const nextLoop = Math.max(dragAnchorStart, Math.min(dragAnchorEnd, sampleIndex));
			commitBounds(dragAnchorStart, dragAnchorEnd, nextLoop);
			return;
		}

		const offset = sampleIndex - dragAnchorSample;
		const span = dragAnchorEnd - dragAnchorStart;
		let nextStart = dragAnchorStart + offset;
		nextStart = Math.max(0, Math.min(totalSamples - 1 - span, nextStart));
		const nextEnd = nextStart + span;
		const loopOffset = dragAnchorLoopStart - dragAnchorStart;
		commitBounds(nextStart, nextEnd, nextStart + loopOffset);
	}

	function stopWindowDragListeners(): void {
		if (windowDragCleanup) {
			windowDragCleanup();
			windowDragCleanup = null;
		}
	}

	function finishDrag(): void {
		if (!dragMode) return;
		dragMode = null;
		stopWindowDragListeners();
		notifyRegionCommit();
	}

	function beginDrag(mode: DragMode, event: PointerEvent): void {
		if (totalSamples < 1 || !rootEl) return;
		event.preventDefault();
		event.stopPropagation();
		stopWindowDragListeners();
		dragMode = mode;
		dragAnchorSample = sampleIndexFromClientX(event.clientX);
		dragAnchorStart = bounds?.start ?? 0;
		dragAnchorEnd = bounds?.end ?? 0;
		dragAnchorLoopStart = bounds?.loopStart ?? 0;

		const pointerId = event.pointerId;
		try {
			rootEl.setPointerCapture(pointerId);
		} catch {
			// capture may fail for touch in some browsers; window listeners still handle the drag
		}

		const onMove = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== pointerId) return;
			applyDrag(sampleIndexFromClientX(moveEvent.clientX));
		};
		const onEnd = (endEvent: PointerEvent) => {
			if (endEvent.pointerId !== pointerId) return;
			if (rootEl) {
				try {
					rootEl.releasePointerCapture(pointerId);
				} catch {
					// already released
				}
			}
			finishDrag();
		};

		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onEnd);
		window.addEventListener('pointercancel', onEnd);
		windowDragCleanup = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onEnd);
			window.removeEventListener('pointercancel', onEnd);
		};
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!dragMode) return;
		applyDrag(sampleIndexFromClientX(event.clientX));
	}

	function endDrag(event: PointerEvent): void {
		if (!dragMode || !rootEl) return;
		try {
			rootEl.releasePointerCapture(event.pointerId);
		} catch {
			// already released
		}
		finishDrag();
	}

	$effect(() => {
		displayPeaks;
		sampleData;
		chipVariant;
		canvasEl;
		height;
		regionStart;
		regionEnd;
		loopStart;
		loopEnabled;
		totalSamples;

		const el = canvasEl;
		if (!el) return;

		let disposed = false;
		let rafId = 0;

		const schedulePaint = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				if (!disposed) paintCanvas();
			});
		};

		const resizeObserver = new ResizeObserver(schedulePaint);
		resizeObserver.observe(el);
		schedulePaint();
		tick().then(() => {
			if (!disposed) schedulePaint();
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		if (!loopEnabled && dragMode === 'loop') {
			finishDrag();
		}
	});

	$effect(() => {
		return () => {
			stopWindowDragListeners();
		};
	});
</script>

<div
	class="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface)] p-2 shadow-sm">
	<div
		bind:this={rootEl}
		class="relative overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] {dragMode !==
		null
			? 'ring-2 ring-[var(--color-app-primary)]/50'
			: ''}"
		style="height: {height}px; touch-action: none;"
		onpointermove={handlePointerMove}
		onpointerup={endDrag}
		onpointercancel={endDrag}>
		<canvas bind:this={canvasEl} class="pointer-events-none block h-full w-full"></canvas>

		{#if bounds}
			<div
				class="pointer-events-none absolute inset-y-0 border-y border-[var(--color-app-primary)]/35 bg-[var(--color-app-primary)]/5"
				style="left: {startPercent}%; width: {endPercent - startPercent}%;"></div>

			{#if loopEnabled}
				<button
					type="button"
					class="absolute top-0 bottom-0 z-30 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center border-0 bg-transparent p-0"
					style="left: {loopPercent}%"
					aria-label="Adjust loop start"
					onpointerdown={(event) => beginDrag('loop', event)}>
					<span
						class="flex h-10 w-2 flex-col items-center justify-center gap-0.5 rounded-sm bg-[var(--color-app-secondary)] shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ring-2 ring-[var(--color-app-surface)]">
						<span class="h-1 w-1 rounded-full bg-[var(--color-app-surface)]"></span>
						<span class="h-1 w-1 rounded-full bg-[var(--color-app-surface)]"></span>
						<span class="h-1 w-1 rounded-full bg-[var(--color-app-surface)]"></span>
					</span>
				</button>
			{/if}

			<div
				class="absolute inset-y-0"
				style="left: {startPercent}%; width: {endPercent - startPercent}%;">
				<button
					type="button"
					class="absolute inset-y-0 -left-2 z-20 flex w-4 cursor-ew-resize items-center justify-center border-0 bg-transparent p-0"
					aria-label="Adjust sample start"
					onpointerdown={(event) => beginDrag('start', event)}>
					<span
						class="h-10 w-1.5 rounded-full bg-[var(--color-app-primary)] shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ring-2 ring-[var(--color-app-surface)]"></span>
				</button>
				<button
					type="button"
					class="absolute inset-0 z-10 cursor-grab border-0 bg-transparent active:cursor-grabbing"
					aria-label="Move sample region"
					onpointerdown={(event) => beginDrag('move', event)}></button>
				<button
					type="button"
					class="absolute inset-y-0 -right-2 z-20 flex w-4 cursor-ew-resize items-center justify-center border-0 bg-transparent p-0"
					aria-label="Adjust sample end"
					onpointerdown={(event) => beginDrag('end', event)}>
					<span
						class="h-10 w-1.5 rounded-full bg-[var(--color-app-primary)] shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ring-2 ring-[var(--color-app-surface)]"></span>
				</button>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-end justify-between gap-3 px-0.5">
		{#if totalSamples > 0}
			<div class="flex flex-wrap items-end gap-2">
				<label class="flex flex-col gap-1">
					<span
						class="inline-flex items-center gap-1 text-xs text-[var(--color-app-text-secondary)]">
						<IconCarbonAlignHorizontalLeft
							class="h-3 w-3 shrink-0 text-[var(--color-app-text-tertiary)]" />
						Start
					</span>
					<input
						type="number"
						data-field="start"
						class="w-[5.5rem] rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] tabular-nums focus:border-[var(--color-app-primary)] focus:outline-none"
						min={0}
						max={maxSampleIndex}
						step={1}
						value={regionStart}
						onchange={handleManualFieldCommit}
						onkeydown={handleManualFieldKeydown} />
				</label>
				<label class="flex flex-col gap-1">
					<span
						class="inline-flex items-center gap-1 text-xs text-[var(--color-app-text-secondary)]">
						<IconCarbonAlignHorizontalRight
							class="h-3 w-3 shrink-0 text-[var(--color-app-text-tertiary)]" />
						End
					</span>
					<input
						type="number"
						data-field="end"
						class="w-[5.5rem] rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] tabular-nums focus:border-[var(--color-app-primary)] focus:outline-none"
						min={0}
						max={maxSampleIndex}
						step={1}
						value={regionEnd}
						onchange={handleManualFieldCommit}
						onkeydown={handleManualFieldKeydown} />
				</label>
				<label class="flex flex-col gap-1 {loopEnabled ? '' : 'opacity-50'}">
					<span
						class="inline-flex items-center gap-1 text-xs text-[var(--color-app-text-secondary)]">
						<IconCarbonRepeat class="h-3 w-3 shrink-0 text-[var(--color-app-text-tertiary)]" />
						Loop
					</span>
					<input
						type="number"
						data-field="loop"
						class="w-[5.5rem] rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-primary)] tabular-nums focus:border-[var(--color-app-primary)] focus:outline-none disabled:cursor-not-allowed"
						min={0}
						max={maxSampleIndex}
						step={1}
						value={loopStart}
						disabled={!loopEnabled}
						onchange={handleManualFieldCommit}
						onkeydown={handleManualFieldKeydown} />
				</label>
			</div>
		{/if}
		<label
			class="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] px-2.5 py-1.5 select-none">
			<input
				type="checkbox"
				class="h-3.5 w-3.5 cursor-pointer rounded border-[var(--color-app-border)] bg-[var(--color-app-surface)] text-[var(--color-app-primary)] focus:ring-[var(--color-app-primary)]"
				bind:checked={loopEnabled} />
			<IconCarbonRepeat class="h-3.5 w-3.5 shrink-0 text-[var(--color-app-text-secondary)]" />
			<span class="text-xs text-[var(--color-app-text-secondary)]">Loop</span>
		</label>
	</div>
</div>
