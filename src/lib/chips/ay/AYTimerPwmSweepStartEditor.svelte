<script lang="ts">
	import IconCarbonWaveform from '~icons/carbon/waveform';
	import { getAyTimerEffectsContext } from './ay-timer-effects-context';
	import {
		AY_TIMER_PWM_SWEEP_SHAPE_LABELS,
		AY_TIMER_PWM_SWEEP_SHAPES,
		AY_TIMER_PWM_SWEEP_START_PHASE_MAX,
		buildTimerPwmSweepShapeFillPath,
		buildTimerPwmSweepShapePath,
		timerPwmSweepPhaseToPoint,
		timerPwmSweepPointToPhase,
		type AyTimerPwmSweepShape
	} from './instrument';

	let {
		isExpanded = false,
		enabled = true
	}: {
		isExpanded?: boolean;
		enabled?: boolean;
	} = $props();

	const controller = getAyTimerEffectsContext();
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
	const canvasHeight = $derived(isExpanded ? 104 : 72);

	const PLOT_PADDING = 10;
	const VIEW_WIDTH = 220;
	const VIEW_HEIGHT = 72;
	const DOT_RADIUS_PX = 2.5;
	const DOT_RADIUS_ACTIVE_PX = 3.5;
	const GRADIENT_ID = 'ay-timer-pwm-sweep-gradient';

	let svgEl = $state<SVGSVGElement | null>(null);
	let plotSize = $state({ width: 0, height: 0 });
	let isDragging = $state(false);
	let isHovering = $state(false);

	const minDuty = $derived(
		controller.timerPwmSweep() > 0 ? controller.timerPwmSweepMin() : 0
	);
	const maxDuty = $derived(controller.timerPwmDuty());
	const startPhase = $derived(controller.timerPwmSweepStartPhase());
	const sweepShape = $derived(controller.timerPwmSweepShape());
	const shapeLabel = $derived(AY_TIMER_PWM_SWEEP_SHAPE_LABELS[sweepShape]);

	const sweepGraphic = $derived.by(() => {
		const innerWidth = VIEW_WIDTH - PLOT_PADDING * 2;
		const innerHeight = VIEW_HEIGHT - PLOT_PADDING * 2;
		const baseY = VIEW_HEIGHT - PLOT_PADDING;
		const shapePath = buildTimerPwmSweepShapePath(
			sweepShape,
			minDuty,
			maxDuty,
			VIEW_WIDTH,
			VIEW_HEIGHT,
			PLOT_PADDING
		);
		const shapeFillPath = buildTimerPwmSweepShapeFillPath(
			sweepShape,
			minDuty,
			maxDuty,
			VIEW_WIDTH,
			VIEW_HEIGHT,
			PLOT_PADDING
		);
		const marker = timerPwmSweepPhaseToPoint(
			startPhase,
			minDuty,
			maxDuty,
			VIEW_WIDTH,
			VIEW_HEIGHT,
			PLOT_PADDING,
			sweepShape
		);
		const gridLines = [0.25, 0.5, 0.75].map((fraction) => ({
			y: baseY - innerHeight * fraction
		}));
		const highlightWidth = Math.max(8, innerWidth / 24);
		const markerColumn = {
			x: Math.max(PLOT_PADDING, marker.x - highlightWidth / 2),
			width: highlightWidth
		};

		return {
			innerWidth,
			innerHeight,
			baseY,
			shapePath,
			shapeFillPath,
			marker,
			gridLines,
			markerColumn
		};
	});

	const markerHighlighted = $derived(isDragging || isHovering);
	const dotRadius = $derived.by(() => symmetricDotRadius(markerHighlighted));

	function symmetricDotRadius(active: boolean): { rx: number; ry: number } {
		if (plotSize.width <= 0 || plotSize.height <= 0) {
			const fallback = active ? 2.5 : 2;
			return { rx: fallback, ry: fallback };
		}
		const radiusPx = active ? DOT_RADIUS_ACTIVE_PX : DOT_RADIUS_PX;
		const scaleX = plotSize.width / VIEW_WIDTH;
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

	function applyPointer(clientX: number): void {
		if (!enabled) return;
		const point = clientToSvg(clientX, 0);
		if (!point) return;
		controller.setTimerPwmSweepStartPhase(
			timerPwmSweepPointToPhase(point.x, VIEW_WIDTH, PLOT_PADDING)
		);
	}

	function handlePointerDown(event: PointerEvent): void {
		if (!enabled || !svgEl) return;
		isDragging = true;
		svgEl.setPointerCapture(event.pointerId);
		applyPointer(event.clientX);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (isDragging) {
			applyPointer(event.clientX);
		}
	}

	function handlePointerEnter(): void {
		if (enabled) {
			isHovering = true;
		}
	}

	function handlePointerLeave(): void {
		if (!isDragging) {
			isHovering = false;
		}
	}

	function stopDrawing(event: PointerEvent): void {
		if (!isDragging) return;
		isDragging = false;
		isHovering = false;
		svgEl?.releasePointerCapture(event.pointerId);
	}

	function shapeButtonClass(shape: AyTimerPwmSweepShape): string {
		const active = shape === sweepShape;
		return `rounded px-2 py-0.5 text-[10px] ${enabled ? 'cursor-pointer' : 'cursor-not-allowed'} ${
			active
				? 'bg-[var(--color-app-primary)] text-white'
				: 'bg-[var(--color-app-surface)] text-[var(--color-app-text-muted)] hover:bg-[var(--color-app-surface-hover)]'
		}`;
	}
</script>

<div
	class="mx-2 mt-3 rounded-lg border border-[var(--color-app-border)] bg-[var(--color-app-surface-secondary)] p-3 {enabled
		? ''
		: 'opacity-60'}">
	<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
		<div
			class="flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]"
			title="PWM automation between min and max. Drag the marker to choose where playback starts.">
			<span
				class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-pattern-note)]/10 text-[var(--color-pattern-note)]">
				<IconCarbonWaveform class={iconSizeClass} />
			</span>
			<div class="leading-tight">
				<div class="text-[var(--color-app-text-secondary)]">PWM sweep start</div>
				<div class="text-[10px] text-[var(--color-app-text-tertiary)]">
					{shapeLabel} duty automation ({minDuty}%–{maxDuty}%)
				</div>
			</div>
		</div>
		<div class="flex items-center gap-2 text-[10px] text-[var(--color-app-text-tertiary)]">
			<span
				class="rounded-full border border-[var(--color-pattern-note)]/25 bg-[var(--color-pattern-note)]/10 px-2 py-0.5 font-mono text-[var(--color-pattern-note)]">
				start = {sweepGraphic.marker.duty}%
			</span>
		</div>
	</div>

	<div class="mb-2 flex flex-wrap gap-1">
		{#each AY_TIMER_PWM_SWEEP_SHAPES as shape (shape)}
			<button
				type="button"
				class={shapeButtonClass(shape)}
				disabled={!enabled}
				onclick={() => controller.setTimerPwmSweepShape(shape)}>
				{AY_TIMER_PWM_SWEEP_SHAPE_LABELS[shape]}
			</button>
		{/each}
	</div>

	<div
		class="overflow-hidden rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface)] ring-1 ring-inset ring-[var(--color-app-border)]/60 {enabled
			? ''
			: 'pointer-events-none'}"
		style:height="{canvasHeight}px">
		<div class="h-full min-w-0 overflow-hidden" use:observePlotSize>
			<svg
				bind:this={svgEl}
				viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}"
				preserveAspectRatio="none"
				class="block h-full w-full touch-none {enabled ? 'cursor-crosshair' : 'cursor-not-allowed'}"
				role="slider"
				tabindex={enabled ? 0 : -1}
				aria-label="PWM sweep start position on automation curve"
				aria-valuemin={0}
				aria-valuemax={AY_TIMER_PWM_SWEEP_START_PHASE_MAX}
				aria-valuenow={startPhase}
				aria-disabled={!enabled}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={stopDrawing}
				onpointercancel={stopDrawing}
				onpointerenter={handlePointerEnter}
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
					width={VIEW_WIDTH - PLOT_PADDING * 2}
					height={sweepGraphic.innerHeight}
					fill="var(--color-app-surface-secondary)"
					opacity="0.45"
					rx="2" />

				{#each sweepGraphic.gridLines as gridLine, gridIndex (gridIndex)}
					<line
						x1={PLOT_PADDING}
						y1={gridLine.y}
						x2={VIEW_WIDTH - PLOT_PADDING}
						y2={gridLine.y}
						class="stroke-[var(--color-app-border)]"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
						stroke-dasharray="3 4"
						opacity="0.55" />
				{/each}

				{#if markerHighlighted}
					<rect
						x={sweepGraphic.markerColumn.x}
						y={PLOT_PADDING}
						width={sweepGraphic.markerColumn.width}
						height={sweepGraphic.innerHeight}
						fill="var(--color-pattern-note)"
						opacity="0.08" />
				{/if}

				<line
					x1={PLOT_PADDING}
					y1={sweepGraphic.baseY}
					x2={VIEW_WIDTH - PLOT_PADDING}
					y2={sweepGraphic.baseY}
					class="stroke-[var(--color-app-border-hover)]"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
					opacity="0.8" />

				{#if sweepGraphic.shapeFillPath}
					<path d={sweepGraphic.shapeFillPath} fill="url(#{GRADIENT_ID})" />
				{/if}

				{#if sweepGraphic.shapePath}
					<path
						d={sweepGraphic.shapePath}
						fill="none"
						class="stroke-[var(--color-pattern-note)]"
						stroke-width="2"
						stroke-linejoin="miter"
						vector-effect="non-scaling-stroke"
						opacity="0.95" />
				{/if}

				<ellipse
					cx={sweepGraphic.marker.x}
					cy={sweepGraphic.marker.y}
					rx={dotRadius.rx}
					ry={dotRadius.ry}
					class={markerHighlighted
						? 'fill-[var(--color-app-on-primary)] stroke-[var(--color-app-primary)]'
						: 'fill-[var(--color-pattern-note)] stroke-[var(--color-app-surface)]'}
					stroke-width="1.25"
					vector-effect="non-scaling-stroke" />
			</svg>
		</div>
	</div>
</div>
