import { getContext, setContext } from 'svelte';
import type { AyTimerEffectsController } from './ay-timer-effects-controller.svelte.ts';

const AY_TIMER_EFFECTS_CONTEXT_KEY = Symbol('ay-timer-effects');

export function setAyTimerEffectsContext(controller: AyTimerEffectsController): void {
	setContext(AY_TIMER_EFFECTS_CONTEXT_KEY, controller);
}

export function getAyTimerEffectsContext(): AyTimerEffectsController {
	return getContext<AyTimerEffectsController>(AY_TIMER_EFFECTS_CONTEXT_KEY);
}
