export const TMR_FRAME_SIZE = 20;
export const TMR_ITEM_SIZE = 22;
export const TMR_HEADER_SIZE = 32;
export const TMR_TIMER_EVENT_STOP = 0xffff;
export const TMR_PSG_MASK_TIMER_BITS = 0x0003;

export type TmrEventItemRecord = {
	psgData: number[];
	psgMask: number;
	timerInterval: number;
	timerEventIndex: number;
};

export function registerMaskFromEventPsgApplyMask(mask: number): number {
	return mask & ~TMR_PSG_MASK_TIMER_BITS;
}

export function timerIndexFromEventPsgApplyMask(mask: number): number {
	return mask & TMR_PSG_MASK_TIMER_BITS;
}

export function encodeEventPsgApplyMask(registerMask: number, timerIndex: number): number {
	return registerMaskFromEventPsgApplyMask(registerMask) | (timerIndex & TMR_PSG_MASK_TIMER_BITS);
}
