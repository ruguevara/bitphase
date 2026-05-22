<script lang="ts">
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

	let { isExpanded = false }: { isExpanded?: boolean } = $props();

	const controller = getAyTimerEffectsContext();
	const containerContext: { audioService: AudioService } = getContext('container');
	const iconSizeClass = $derived(controller.iconSizeClass(isExpanded));
	const canvasHeight = $derived(isExpanded ? 96 : 64);

	const PLOT_PADDING = 8;
	const VIEW_HEIGHT = 64;
	const DOT_RADIUS_PX = 2;
	const DOT_RADIUS_ACTIVE_PX = 2.5;

	let svgEl = $state<SVGSVGElement | null>(null);
	let plotSize = $state({ width: 0, height: 0 });
	let waveformText = $state('');
	let waveformInputFocused = $state(false);
	let isDrawing = $state(false);
	let activeStepIndex = $state<number | null>(null);

	const chipVariant = $derived(
		resolveAyChipVariant(containerContext.audioService.chipSettings.get('chipVariant'))
	);

	const waveform = $derived(controller.fields.timerWaveform);

	const displayWaveform = $derived.by(() => {
		if (waveformInputFocused) {
			const preview = controller.parseTimerWaveformPartial(waveformText);
			if (preview !== null) {
				return preview;
			}
		}
		return waveform;
	});

	const displayedWaveformText = $derived(
		waveformInputFocused ? waveformText : controller.formatTimerWaveform()
	);

	$effect(() => {
		waveform;
		if (!waveformInputFocused) {
			waveformText = controller.formatTimerWaveform();
		}
	});

	function handleWaveformFocus(event: FocusEvent): void {
		waveformInputFocused = true;
		waveformText = controller.formatTimerWaveform();
		(event.target as HTMLInputElement).select();
	}

	function handleWaveformInput(event: Event): void {
		waveformText = (event.target as HTMLInputElement).value;
	}

	function handleWaveformBlur(): void {
		waveformInputFocused = false;
		const parsed = controller.parseTimerWaveform(waveformText);
		if (parsed !== null) {
			controller.setTimerWaveform(parsed);
		}
		waveformText = controller.formatTimerWaveform();
	}

	const waveformGraphic = $derived.by(() => {
		const steps = displayWaveform.length;
		const viewWidth = Math.max(48, steps * 14 + PLOT_PADDING * 2);
		const innerWidth = viewWidth - PLOT_PADDING * 2;
		const innerHeight = VIEW_HEIGHT - PLOT_PADDING * 2;
		const stepWidth = steps > 0 ? innerWidth / steps : innerWidth;

		const bars = displayWaveform.map((value, index) => {
			const amplitude = sidStepToAmplitude(
				value,
				SID_WAVEFORM_PREVIEW_BASE_VOLUME,
				chipVariant
			);
			const centerX = PLOT_PADDING + stepWidth * index + stepWidth / 2;
			const barWidth = stepWidth * 0.48;
			const barHeight = innerHeight * amplitude;
			const baseY = VIEW_HEIGHT - PLOT_PADDING;
			return {
				index,
				value,
				amplitude,
				x: centerX - barWidth / 2,
				y: baseY - barHeight,
				width: barWidth,
				height: barHeight > 0 ? barHeight : 2,
				centerX,
				centerY: baseY - barHeight
			};
		});

		const connectorPoints = bars
			.map((bar) => `${bar.centerX},${bar.centerY}`)
			.join(' ');

		return { viewWidth, bars, connectorPoints };
	});

	function symmetricDotRadius(active: boolean): { rx: number; ry: number } {
		const { viewWidth } = waveformGraphic;
		if (plotSize.width <= 0 || plotSize.height <= 0) {
			const fallback = active ? 2 : 1.5;
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
		const steps = displayWaveform.length;
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
		controller.setWaveformStep(index, step);
	}

	function handlePointerDown(event: PointerEvent): void {
		const svg = svgEl;
		if (!svg) return;
		isDrawing = true;
		svg.setPointerCapture(event.pointerId);
		applyPointer(event.clientX, event.clientY);
	}

	function handlePointerMove(event: PointerEvent): void {
		if (!isDrawing) return;
		applyPointer(event.clientX, event.clientY);
	}

	function stopDrawing(event: PointerEvent): void {
		if (!isDrawing) return;
		isDrawing = false;
		activeStepIndex = null;
		svgEl?.releasePointerCapture(event.pointerId);
	}
</script>

<div class="mt-3 ml-2">
	<div
		class="mb-1.5 flex items-center gap-2 text-xs text-[var(--color-app-text-muted)]"
		title="SID volume steps (0–15). Y axis uses {chipVariant} DAC curve.">
		<IconCarbonWaveform class={iconSizeClass} />
		<span>SID waveform</span>
		<span class="text-[var(--color-app-text-tertiary)]">({chipVariant} curve)</span>
	</div>

	<div
		class="mb-2 max-w-full overflow-hidden rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)]"
		style:height="{canvasHeight}px"
		use:observePlotSize>
		<svg
			bind:this={svgEl}
			viewBox="0 0 {waveformGraphic.viewWidth} {VIEW_HEIGHT}"
			preserveAspectRatio="none"
			class="block h-full w-full cursor-crosshair touch-none"
			role="img"
			aria-label="SID waveform editor"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={stopDrawing}
			onpointercancel={stopDrawing}>
			<line
				x1={PLOT_PADDING}
				y1={VIEW_HEIGHT - PLOT_PADDING}
				x2={waveformGraphic.viewWidth - PLOT_PADDING}
				y2={VIEW_HEIGHT - PLOT_PADDING}
				class="stroke-[var(--color-app-border)]"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
				opacity="0.35" />
			{#each waveformGraphic.bars as bar (bar.index)}
				<rect
					x={bar.x}
					y={bar.y}
					width={bar.width}
					height={bar.height}
					class={activeStepIndex === bar.index
						? 'fill-[var(--color-app-primary)]'
						: bar.amplitude > 0
							? 'fill-[var(--color-app-text-secondary)]'
							: 'fill-[var(--color-app-text-muted)]'}
					opacity={bar.amplitude > 0 ? 0.55 : 0.25} />
			{/each}
			{#if waveformGraphic.connectorPoints}
				<polyline
					points={waveformGraphic.connectorPoints}
					fill="none"
					class="stroke-[var(--color-pattern-note)]"
					stroke-width="1.5"
					vector-effect="non-scaling-stroke"
					opacity="0.9" />
			{/if}
			{#each waveformGraphic.bars as bar (bar.index)}
				{@const dotRadius = symmetricDotRadius(activeStepIndex === bar.index)}
				<ellipse
					cx={bar.centerX}
					cy={bar.centerY}
					rx={dotRadius.rx}
					ry={dotRadius.ry}
					class={activeStepIndex === bar.index
						? 'fill-[var(--color-app-primary)]'
						: 'fill-[var(--color-pattern-note)]'} />
			{/each}
		</svg>
	</div>

	<div class="flex items-center gap-2">
		<input
			type="text"
			class="min-w-0 flex-1 rounded border border-[var(--color-app-border)] bg-[var(--color-app-surface)] px-2 py-1 font-mono text-xs text-[var(--color-app-text-secondary)] placeholder-[var(--color-app-text-muted)] focus:border-[var(--color-app-primary)] focus:outline-none"
			value={displayedWaveformText}
			placeholder="15 0"
			spellcheck="false"
			title="Space-separated volume steps (0–15)"
			onfocus={handleWaveformFocus}
			oninput={handleWaveformInput}
			onblur={handleWaveformBlur} />
	</div>
</div>
