import { describe, it, expect } from 'vitest';
import { Pattern, Note, NoteName, Effect, EffectType } from '../../../../src/lib/models/song';
import { AY_CHIP_SCHEMA } from '../../../../src/lib/chips/ay/schema';
import { resolveEffectiveRowFields } from '../../../../src/lib/services/audio/play-from-position';

function makePattern(id: number, length = 8): Pattern {
	return new Pattern(id, length, AY_CHIP_SCHEMA);
}

function resolve(
	patterns: Pattern[],
	orderIndex: number,
	row: number,
	channel: number,
	extraGlobalKeys: string[] = []
) {
	const order = patterns.map((p) => p.id);
	return resolveEffectiveRowFields(
		order,
		(pid) => patterns.find((p) => p.id === pid),
		orderIndex,
		row,
		channel,
		AY_CHIP_SCHEMA,
		extraGlobalKeys
	);
}

describe('resolveEffectiveRowFields', () => {
	it('reads values set on the target row itself', () => {
		const p = makePattern(0);
		const ch = p.channels[0].rows;
		ch[2].instrument = 5;
		ch[2].volume = 12;
		ch[2].note = new Note(NoteName.C, 4);
		p.patternRows[2].noiseValue = 0x0a;

		const { channelFields, globalFields } = resolve([p], 0, 2, 0);
		expect(channelFields.instrument).toBe(5);
		expect(channelFields.volume).toBe(12);
		expect((channelFields.note as Note).name).toBe(NoteName.C);
		expect(globalFields.noiseValue).toBe(0x0a);
	});

	it('backtracks to an earlier row within the same pattern', () => {
		const p = makePattern(0);
		p.channels[0].rows[1].instrument = 3;
		p.patternRows[1].envelopeValue = 0x1234;

		const { channelFields, globalFields } = resolve([p], 0, 5, 0);
		expect(channelFields.instrument).toBe(3);
		expect(globalFields.envelopeValue).toBe(0x1234);
	});

	it('does not backtrack a nonZero-only field that is zero', () => {
		const p = makePattern(0);
		p.channels[0].rows[1].volume = 7;
		p.channels[0].rows[3].volume = 0;

		const { channelFields } = resolve([p], 0, 5, 0);
		expect(channelFields.volume).toBe(7);
	});

	it('treats an explicit-zero table (-1) as a set value', () => {
		const p = makePattern(0);
		p.channels[0].rows[1].table = 4;
		p.channels[0].rows[3].table = -1;

		const { channelFields } = resolve([p], 0, 5, 0);
		expect(channelFields.table).toBe(-1);
	});

	it('crosses pattern boundaries following the order', () => {
		const p0 = makePattern(0);
		const p1 = makePattern(1);
		p0.channels[0].rows[6].instrument = 9;

		const { channelFields } = resolve([p0, p1], 1, 2, 0);
		expect(channelFields.instrument).toBe(9);
	});

	it('resolves per requested channel only', () => {
		const p = makePattern(0);
		p.channels[0].rows[1].instrument = 1;
		p.channels[1].rows[1].instrument = 2;

		expect(resolve([p], 0, 5, 0).channelFields.instrument).toBe(1);
		expect(resolve([p], 0, 5, 1).channelFields.instrument).toBe(2);
	});

	it('resolves extra global keys (e.g. envelopeEffect) by most recent value', () => {
		const p = makePattern(0);
		p.patternRows[2].envelopeEffect = new Effect(EffectType.AutoEnvelope, 0, 0x21);

		const { globalFields } = resolve([p], 0, 5, 0, ['envelopeEffect']);
		const effect = globalFields.envelopeEffect as Effect;
		expect(effect.effect).toBe(EffectType.AutoEnvelope);
		expect(effect.parameter).toBe(0x21);
	});

	it('omits extra global keys when not requested', () => {
		const p = makePattern(0);
		p.patternRows[2].envelopeEffect = new Effect(EffectType.AutoEnvelope, 0, 0x21);

		const { globalFields } = resolve([p], 0, 5, 0);
		expect('envelopeEffect' in globalFields).toBe(false);
	});
});
