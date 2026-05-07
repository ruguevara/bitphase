import { registerAudioSlotKind } from './audio-slot-registry.js';
import { AyumiSlot } from './ayumi-slot.js';

registerAudioSlotKind('ayumi', (port, chipIndex, sharedTimeline, initData) => {
	const slot = new AyumiSlot(port, chipIndex, sharedTimeline);
	void slot.handleMessage({ type: 'init', wasmBuffer: initData.wasmBuffer });
	return slot;
});
