import { describe, it, expect } from 'vitest';
import { CHIP_TYPES } from '../../../src/lib/chips/chip-registration';
import { getAllChips, getChipByType } from '../../../src/lib/chips/registry';
import {
	ensureCoreRegistry,
	getChipByType as getCoreChipByType
} from '../../../src/lib/chips/registry-core';

describe('chip registry', () => {
	it('full registry lists every CHIP_TYPES entry', () => {
		const types = new Set(getAllChips().map((c) => c.type));
		for (const t of CHIP_TYPES) {
			expect(types.has(t)).toBe(true);
		}
		expect(types.size).toBe(CHIP_TYPES.length);
	});

	it('full getChipByType matches core getChipByType for identity fields', async () => {
		await ensureCoreRegistry();
		for (const t of CHIP_TYPES) {
			const full = getChipByType(t);
			const core = getCoreChipByType(t);
			expect(full).not.toBeNull();
			expect(core).not.toBeNull();
			expect(full!.type).toBe(core!.type);
			expect(full!.name).toBe(core!.name);
			expect(full!.audioSlotKind).toBe(core!.audioSlotKind);
		}
	});
});
