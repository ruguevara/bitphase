<script lang="ts">
	import IconCarbonAdd from '~icons/carbon/add';
	import IconCarbonClose from '~icons/carbon/close';
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getContext } from 'svelte';
	import type { AudioService } from '../../services/audio/audio-service';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import {
		amplitudeToNearestSidStep,
		resolveAyChipVariant,
		sidStepToAmplitude,
		SID_WAVEFORM_PREVIEW_BASE_VOLUME
	} from './sid-waveform-volume';
	import { AY_TIMER_WAVEFORM_MAX_LENGTH } from './instrument';

	let {
		rowIndex,
		isExpanded = false,
		onclose
	}: {
		rowIndex: number;
		isExpanded?: boolean;
		onclose?: () => void;
	} = $props();

	const controller = getAyTimerEffectsContext();
	const containerContext: { audioService: AudioService } = getContext('container');
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
	const canvasHeight = $derived(isExpanded ? 104 : 72);

	const PLOT_PADDING = 10;
	const VIEW_HEIGHT = 72;
	const DOT_RADIUS_PX = 2.5;
	const DOT_RADIUS_ACTIVE_PX = 3.5;
	const GRADIENT_ID = $derived(`ay-timer-waveform-gradient-${rowIndex}`);

	let svgEl = $state<SVGSVGElement | null>(null);
	let plotSize = $state({ width: 0, height: 0 });
	let isDrawing = $state(false);
	let activeStepIndex = $state<number | null>(null);
	let hoverStepIndex = $state<number | null>(null);

	const chipVariant = $derived(
		resolveAyChipVariant(containerContext.audioService.chipSettings.get('chipVariant'))
	);

	const waveform = $derived(controller.rowTimerWaveform(rowIndex));

	const highlightedStepIndex = $derived(activeStepIndex ?? hoverStepIndex);

	const activeStepValue = $derived(
		highlightedStepIndex !== null ? (waveform[highlightedStepIndex] ?? null) : null
	);

	const canAppendStep = $derived(controller.canAppendRowWaveformStep(rowIndex));

	const waveformGraphic = $derived.by(() => {
		const steps = waveform.length;
		const viewWidth = Math.max(48, steps * 14 + PLOT_PADDING * 2);
		const innerWidth = viewWidth - PLOT_PADDING * 2;
		const innerHeight = VIEW_HEIGHT - PLOT_PADDING * 2;
		const stepWidth = steps > 0 ? innerWidth / steps : innerWidth;
		const baseY = VIEW_HEIGHT - PLOT_PADDING;

		const bars = waveform.map((value, index) => {
			const amplitude = sidStepToAmplitude(
				value,
				SID_WAVEFORM_PREVIEW_BASE_VOLUME,
				chipVariant
			);
			const centerX = PLOT_PADDING + stepWidth * index + stepWidth / 2;
			return {
				index,
				value,
				centerX,
				centerY: baseY - innerHeight * amplitude
			};
		});

		const stepColumns = bars.map((bar) => ({
			index: bar.index,
			x: PLOT_PADDING + stepWidth * bar.index,
			width: stepWidth
		}));

		const gridLines = [0.25, 0.5, 0.75].map((fraction) => ({
			y: baseY - innerHeight * fraction
		}));

		const waveformPath = buildSquareWaveformPath(bars, stepWidth, PLOT_PADDING);
		const waveformFillPath = buildSquareWaveformFillPath(
			bars,
			stepWidth,
			PLOT_PADDING,
			baseY
		);

		return {
			viewWidth,
			innerHeight,
			baseY,
			bars,
			stepColumns,
			gridLines,
			waveformPath,
			waveformFillPath
		};
	});

	function buildSquareWaveformPath(
		bars: Array<{ centerY: number }>,
		stepWidth: number,
		plotPadding: number
	): string {
		if (bars.length === 0) {
			return '';
		}

		const segments: string[] = [];
		for (let index = 0; index < bars.length; index++) {
			const xLeft = plotPadding + stepWidth * index;
			const xRight = plotPadding + stepWidth * (index + 1);
			const y = bars[index]!.centerY;

			if (index === 0) {
				segments.push(`M ${xLeft} ${y}`);
			}
			segments.push(`L ${xRight} ${y}`);
			if (index < bars.length - 1) {
				segments.push(`L ${xRight} ${bars[index + 1]!.centerY}`);
			}
		}

		return segments.join(' ');
	}

	function buildSquareWaveformFillPath(
		bars: Array<{ centerY: number }>,
		stepWidth: number,
		plotPadding: number,
		baseY: number
	): string {
		const wavePath = buildSquareWaveformPath(bars, stepWidth, plotPadding);
		if (!wavePath) {
			return '';
		}
		const endX = plotPadding + stepWidth * bars.length;
		return `${wavePath} L ${endX} ${baseY} L ${plotPadding} ${baseY} Z`;
	}

	function symmetricDotRadius(active: boolean): { rx: number; ry: number } {
		const { viewWidth } = waveformGraphic;
		if (plotSize.width <= 0 || plotSize.height <= 0) {
			const fallback = active ? 2.5 : 2;
			return { rx: fallback, ry: fallback };
		}
		const radiusPx = active ? DOT_RADIUS_ACTIVE_PX : DOT_RADIUS_PX;
		const scaleX = plotSize.width / viewWidth;
		const scaleY = plotSize.height / VIEW_HEIGHT;
		return { rx: radiusPx / scaleX, ry: radiusPx / scaleY };
	}

	function observePlotSize(node: HTMLDivElement): { destroy: () => void } {
		const sync = () => {
			const width = Math.floor(node.clientWidth);
			const height = Math.floor(node.clientHeight);
			if (width <= 0 || height <= 0) return;
			if (width !== plotSize.width || height !== plotSize.height) {
				plotSize = { width, height };
			}
		};
		sync();
		const observer = new ResizeObserver(() => sync());
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
		const svg = svgEl;
		if (!svg) return null;
		const point = svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const matrix = svg.getScreenCTM();
		if (!matrix) return null;
		const svgPoint = point.matrixTransform(matrix.inverse());
		return { x: svgPoint.x, y: svgPoint.y };
	}

	function pointerStepIndex(clientX: number, clientY: number): number | null {
		const point = clientToSvg(clientX, clientY);
		if (!point) return null;
		const steps = waveform.length;
		if (steps <= 0) return null;
		const innerWidth = waveformGraphic.viewWidth - PLOT_PADDING * 2;
		const stepWidth = innerWidth / steps;
		const x = point.x - PLOT_PADDING;
		if (x < 0 || x > stepWidth * steps) return null;
		const index = Math.floor(x / stepWidth);
		if (index < 0 || index >= steps) return null;
		return index;
	}

	function applyPointer(clientX: number, clientY: number): void {
		const index = pointerStepIndex(clientX, clientY);
		if (index === null) return;
		activeStepIndex = index;
		const point = clientToSvg(clientX, clientY);
		if (!point) return;
		const innerHeight = VIEW_HEIGHT - PLOT_PADDING * 2;
		const y = point.y - PLOT_PADDING;
		const amplitude = Math.max(0, Math.min(1, 1 - y / innerHeight));
		const step = amplitudeToNearestSidStep(
			amplitude,
			SID_WAVEFORM_PREVIEW_BASE_VOLUME,
			chipVariant
		);
		controller.setRowWaveformStep(rowIndex, index, step);
	}

	function handlePointerDown(event: PointerEvent): void {
		const svg = svgEl;
		if (!svg) return;
		isDrawing = true;
		svg.setPointerCapture(event.pointerId);
		applyPointer(event.clientX, event.clientY);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (isDrawing) {
			applyPointer(event.clientX, event.clientY);
			return;
		}
		hoverStepIndex = pointerStepIndex(event.clientX, event.clientY);
	}

	function handlePointerLeave(): void {
		if (!isDrawing) {
			hoverStepIndex = null;
		}
	}

	function stopDrawing(event: PointerEvent): void {
		if (!isDrawing) return;
		isDrawing = false;
		activeStepIndex = null;
		svgEl?.releasePointerCapture(event.pointerId);
	}

	function handleAppendStep(): void {
		if (!controller.appendRowWaveformStep(rowIndex)) {
			return;
		}
		activeStepIndex = controller.rowTimerWaveform(rowIndex).length - 1;
	}
</script>

<div
	class="mx-2 mt-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] p-3">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]"
			title="SID steps (0–15). Y axis uses {chipVariant} DAC curve.">
			<span
				class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-pattern-note)]/10 text-[var(--color-pattern-note)]">
				<IconCarbonWaveform class={iconSizeClass} />
			</span>
			<div class="leading-tight">
				<div class="text-[var(--color-app-text-secondary)]">SID steps · row {rowIndex + 1}</div>
				<div class="text-[10px] text-[var(--color-app-text-tertiary)]">{chipVariant} DAC curve</div>
			</div>
		</div>
		<div class="flex items-center gap-2 text-[10px] text-[var(--color-app-text-tertiary)]">
			<span>{waveform.length} SID steps</span>
			{#if activeStepValue !== null && highlightedStepIndex !== null}
				<span
					class="rounded-full border border-[var(--color-pattern-note)]/25 bg-[var(--color-pattern-note)]/10 px-2 py-0.5 font-mono text-[var(--color-pattern-note)]">
					#{highlightedStepIndex + 1} = {activeStepValue}
				</span>
			{/if}
			<button
				type="button"
				class="inline-flex cursor-pointer items-center justify-center rounded p-1 text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-app-text-secondary)]"
				title="Close waveform editor"
				aria-label="Close waveform editor"
				onclick={() => onclose?.()}>
				<IconCarbonClose class={iconSizeClass} />
			</button>
		</div>
	</div>

	<div
		class="flex overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface)] ring-1 ring-inset ring-[var(--color-app-border)]/60"
		style:height="{canvasHeight}px">
		<div class="min-w-0 flex-1 overflow-hidden" use:observePlotSize>
		<svg
			bind:this={svgEl}
			viewBox="0 0 {waveformGraphic.viewWidth} {VIEW_HEIGHT}"
			preserveAspectRatio="none"
			class="block h-full w-full cursor-crosshair touch-none"
			role="img"
			aria-label="SID steps editor"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={stopDrawing}
			onpointercancel={stopDrawing}
			onpointerleave={handlePointerLeave}>
			<defs>
				<linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--color-pattern-note)" stop-opacity="0.28" />
					<stop offset="100%" stop-color="var(--color-pattern-note)" stop-opacity="0.03" />
				</linearGradient>
			</defs>

			<rect
				x={PLOT_PADDING}
				y={PLOT_PADDING}
				width={waveformGraphic.viewWidth - PLOT_PADDING * 2}
				height={waveformGraphic.innerHeight}
				fill="var(--color-app-surface-secondary)"
				opacity="0.45"
				rx="2" />

			{#each waveformGraphic.gridLines as gridLine, gridIndex (gridIndex)}
				<line
					x1={PLOT_PADDING}
					y1={gridLine.y}
					x2={waveformGraphic.viewWidth - PLOT_PADDING}
					y2={gridLine.y}
					class="stroke-[var(--color-app-border)]"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
					stroke-dasharray="3 4"
					opacity="0.55" />
			{/each}

			{#each waveformGraphic.stepColumns as column (column.index)}
				{#if highlightedStepIndex === column.index}
					<rect
						x={column.x}
						y={PLOT_PADDING}
						width={column.width}
						height={waveformGraphic.innerHeight}
						fill="var(--color-pattern-note)"
						opacity="0.08" />
				{/if}
				<line
					x1={column.x + column.width}
					y1={PLOT_PADDING}
					x2={column.x + column.width}
					y2={waveformGraphic.baseY}
					class="stroke-[var(--color-app-border)]"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
					opacity={column.index === waveformGraphic.stepColumns.length - 1 ? 0.35 : 0.18} />
			{/each}

			<line
				x1={PLOT_PADDING}
				y1={waveformGraphic.baseY}
				x2={waveformGraphic.viewWidth - PLOT_PADDING}
				y2={waveformGraphic.baseY}
				class="stroke-[var(--color-app-border-hover)]"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
				opacity="0.8" />

			{#if waveformGraphic.waveformFillPath}
				<path d={waveformGraphic.waveformFillPath} fill="url(#{GRADIENT_ID})" />
			{/if}

			{#if waveformGraphic.waveformPath}
				<path
					d={waveformGraphic.waveformPath}
					fill="none"
					class="stroke-[var(--color-pattern-note)]"
					stroke-width="2"
					stroke-linejoin="miter"
					vector-effect="non-scaling-stroke"
					opacity="0.95" />
			{/if}

			{#each waveformGraphic.bars as bar (bar.index)}
				{@const dotRadius = symmetricDotRadius(highlightedStepIndex === bar.index)}
				<ellipse
					cx={bar.centerX}
					cy={bar.centerY}
					rx={dotRadius.rx}
					ry={dotRadius.ry}
					class={highlightedStepIndex === bar.index
						? 'fill-[var(--color-app-on-primary)] stroke-[var(--color-app-primary)]'
						: 'fill-[var(--color-pattern-note)] stroke-[var(--color-app-surface)]'}
					stroke-width="1.25"
					vector-effect="non-scaling-stroke" />
			{/each}
		</svg>
		</div>
		<button
			type="button"
			class="flex w-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 border-l border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] text-[var(--color-app-text-muted)] transition-colors hover:bg-[var(--color-app-surface-hover)] hover:text-[var(--color-pattern-note)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--color-app-surface-secondary)] disabled:hover:text-[var(--color-app-text-muted)]"
			disabled={!canAppendStep}
			title={canAppendStep ? 'Add SID step' : `Maximum ${AY_TIMER_WAVEFORM_MAX_LENGTH} SID steps`}
			aria-label="Add waveform step"
			onclick={handleAppendStep}>
			<IconCarbonAdd class={isExpanded ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
		</button>
	</div>
</div>
