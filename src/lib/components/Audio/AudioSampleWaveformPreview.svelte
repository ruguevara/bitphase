<script lang="ts">
	import { tick } from 'svelte';
	import type { WaveformPeak } from '../../utils/audio-sample-decode';
	import { normalizeWaveformPeaksForDisplay } from '../../utils/audio-sample-decode';

	let {
		peaks = [],
		height = 120,
		class: className = '',
		regionStart = 0,
		regionLength = 0,
		totalSamples = 0
	}: {
		peaks?: WaveformPeak[];
		height?: number;
		class?: string;
		regionStart?: number;
		regionLength?: number;
		totalSamples?: number;
	} = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);

	const displayPeaks = $derived(normalizeWaveformPeaksForDisplay(peaks));

	function resolveStrokeColor(el: HTMLCanvasElement): string {
		const fromCanvas = getComputedStyle(el).getPropertyValue('--color-pattern-note').trim();
		if (fromCanvas) {
			return fromCanvas;
		}
		const fromRoot = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-pattern-note')
			.trim();
		return fromRoot || '#89b4fa';
	}

	function drawRegionOverlay(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		total: number,
		start: number,
		length: number
	): void {
		if (total < 1 || length < 1) {
			return;
		}
		const clampedStart = Math.max(0, Math.min(total - 1, Math.floor(start)));
		const clampedLength = Math.max(1, Math.min(total - clampedStart, Math.floor(length)));
		const regionStartX = (clampedStart / total) * width;
		const regionEndX = ((clampedStart + clampedLength) / total) * width;

		ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
		if (regionStartX > 0) {
			ctx.fillRect(0, 0, regionStartX, canvasHeight);
		}
		if (regionEndX < width) {
			ctx.fillRect(regionEndX, 0, width - regionEndX, canvasHeight);
		}

		ctx.fillStyle = 'rgba(137, 180, 250, 0.12)';
		ctx.fillRect(regionStartX, 0, regionEndX - regionStartX, canvasHeight);

		ctx.strokeStyle = 'rgba(137, 180, 250, 0.85)';
		ctx.lineWidth = Math.max(1, Math.floor((window.devicePixelRatio ?? 1) * 1));
		ctx.beginPath();
		ctx.moveTo(regionStartX, 0);
		ctx.lineTo(regionStartX, canvasHeight);
		ctx.moveTo(regionEndX, 0);
		ctx.lineTo(regionEndX, canvasHeight);
		ctx.stroke();
	}

	function drawPeaks(
		ctx: CanvasRenderingContext2D,
		width: number,
		canvasHeight: number,
		data: WaveformPeak[],
		strokeColor: string,
		regionStartValue: number,
		regionLengthValue: number,
		totalSampleCount: number
	): void {
		ctx.clearRect(0, 0, width, canvasHeight);
		if (data.length === 0) {
			ctx.strokeStyle = strokeColor;
			ctx.globalAlpha = 0.35;
			ctx.beginPath();
			ctx.moveTo(0, canvasHeight / 2);
			ctx.lineTo(width, canvasHeight / 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
			drawRegionOverlay(
				ctx,
				width,
				canvasHeight,
				totalSampleCount,
				regionStartValue,
				regionLengthValue
			);
			return;
		}

		const midY = canvasHeight / 2;
		const halfHeight = canvasHeight * 0.38;
		const stepX = width / data.length;
		const barWidth = Math.max(1, stepX * 0.85);

		ctx.fillStyle = strokeColor;
		ctx.globalAlpha = 0.28;
		for (let i = 0; i < data.length; i++) {
			const x = i * stepX + (stepX - barWidth) / 2;
			const topY = midY - data[i].max * halfHeight;
			const bottomY = midY - data[i].min * halfHeight;
			const barHeight = Math.max(1, bottomY - topY);
			ctx.fillRect(x, topY, barWidth, barHeight);
		}
		ctx.globalAlpha = 1;

		ctx.strokeStyle = strokeColor;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, midY);
		ctx.lineTo(width, midY);
		ctx.stroke();

		drawRegionOverlay(
			ctx,
			width,
			canvasHeight,
			totalSampleCount,
			regionStartValue,
			regionLengthValue
		);
	}

	function paintCanvas(): void {
		const el = canvasEl;
		const data = displayPeaks;
		if (!el) return;

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

		const strokeColor = resolveStrokeColor(el);
		drawPeaks(ctx, w, h, data, strokeColor, regionStart, regionLength, totalSamples);
	}

	$effect(() => {
		displayPeaks;
		canvasEl;
		height;
		regionStart;
		regionLength;
		totalSamples;

		const el = canvasEl;
		if (!el) return;

		let disposed = false;
		let rafId = 0;

		const schedulePaint = () => {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				if (!disposed) {
					paintCanvas();
				}
			});
		};

		const resizeObserver = new ResizeObserver(schedulePaint);
		resizeObserver.observe(el);
		schedulePaint();
		tick().then(() => {
			if (!disposed) {
				schedulePaint();
			}
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
	});
</script>

<div
	class="box-border w-full min-w-0 rounded-md border border-[var(--color-app-border)] bg-[var(--color-app-surface)] {className}"
	style="height: {height}px">
	<canvas bind:this={canvasEl} class="block h-full w-full" style="width: 100%; height: 100%"></canvas>
</div>
