import { describe, it, expect } from 'vitest';
import { AutoEnvService } from '@/lib/services/pattern/auto-env-service';
import { Pattern } from '@/lib/models/song';
import { AY_CHIP_SCHEMA } from '@/lib/chips/ay/schema';
import { PT3TuneTables } from '@/lib/models/pt3/tuning-tables';

describe('AutoEnvService', () => {
	const tuningTable = PT3TuneTables[2];

	describe('calculateEnvelopeValue', () => {
		it('should calculate envelope value for envelope shape 8 with 1:1 ratio', () => {
			const noteIndex = 48;
			const envelopeShape = 8;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.calculateEnvelopeValue(
				noteIndex,
				envelopeShape,
				tuningTable,
				ratio
			);

			expect(result).toBe(Math.round(tuningTable[noteIndex] / 16));
		});

		it('should calculate envelope value for envelope shape 10 with 1:2 ratio', () => {
			const noteIndex = 48;
			const envelopeShape = 10;
			const ratio = { numerator: 1, denominator: 2, label: '1:2' };

			const result = AutoEnvService.calculateEnvelopeValue(
				noteIndex,
				envelopeShape,
				tuningTable,
				ratio
			);

			expect(result).toBe(Math.round((tuningTable[noteIndex] * 1) / 2 / 32));
		});

		it('should calculate envelope value for envelope shape 12 with 3:2 ratio', () => {
			const noteIndex = 60;
			const envelopeShape = 12;
			const ratio = { numerator: 3, denominator: 2, label: '3:2' };

			const result = AutoEnvService.calculateEnvelopeValue(
				noteIndex,
				envelopeShape,
				tuningTable,
				ratio
			);

			expect(result).toBe(Math.round((tuningTable[noteIndex] * 3) / 2 / 16));
		});

		it('should return null for invalid envelope shape', () => {
			const noteIndex = 48;
			const envelopeShape = 5;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.calculateEnvelopeValue(
				noteIndex,
				envelopeShape,
				tuningTable,
				ratio
			);

			expect(result).toBeNull();
		});

		it('should return null for invalid note index', () => {
			const noteIndex = -1;
			const envelopeShape = 8;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.calculateEnvelopeValue(
				noteIndex,
				envelopeShape,
				tuningTable,
				ratio
			);

			expect(result).toBeNull();
		});
	});

	describe('applyAutoEnvelope', () => {
		it('should apply auto envelope to pattern', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			pattern.channels[0].rows[0].note = { name: 2, octave: 4 };
			pattern.channels[0].rows[0].envelopeShape = 8;

			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelope(pattern, 0, 0, tuningTable, ratio);

			expect(result).not.toBeNull();
			expect(result!.patternRows[0].envelopeValue).toBeGreaterThan(0);
		});

		it('should return null for row without note', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelope(pattern, 0, 0, tuningTable, ratio);

			expect(result).toBeNull();
		});

		it('should return null for invalid channel index', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelope(pattern, 0, -1, tuningTable, ratio);

			expect(result).toBeNull();
		});

		it('should return null if envelope value is unchanged', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			pattern.channels[0].rows[0].note = { name: 2, octave: 4 };
			pattern.channels[0].rows[0].envelopeShape = 8;

			const ratio = { numerator: 1, denominator: 1, label: '1:1' };
			const noteIndex = (4 - 1) * 12 + (2 - 2);
			const expectedValue = Math.round(tuningTable[noteIndex] / 16);
			pattern.patternRows[0].envelopeValue = expectedValue;

			const result = AutoEnvService.applyAutoEnvelope(pattern, 0, 0, tuningTable, ratio);

			expect(result).toBeNull();
		});
	});

	describe('applyAutoEnvelopeIfEligible', () => {
		it('returns pattern unchanged when disabled', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			pattern.channels[0].rows[0].note = { name: 2, octave: 4 };
			pattern.channels[0].rows[0].envelopeShape = 8;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelopeIfEligible(
				pattern,
				0,
				{ channelIndex: 0, fieldType: 'note' },
				tuningTable,
				ratio,
				false
			);

			expect(result).toBe(pattern);
			expect(result.patternRows[0].envelopeValue).toBe(0);
		});

		it('applies auto envelope for note field edits when enabled', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			pattern.channels[0].rows[0].note = { name: 2, octave: 4 };
			pattern.channels[0].rows[0].envelopeShape = 8;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelopeIfEligible(
				pattern,
				0,
				{ channelIndex: 0, fieldType: 'note' },
				tuningTable,
				ratio,
				true
			);

			expect(result.patternRows[0].envelopeValue).toBeGreaterThan(0);
		});

		it('ignores non-note and non-envelope-shape fields', () => {
			const pattern = new Pattern(1, 64, AY_CHIP_SCHEMA);
			pattern.channels[0].rows[0].note = { name: 2, octave: 4 };
			pattern.channels[0].rows[0].envelopeShape = 8;
			const ratio = { numerator: 1, denominator: 1, label: '1:1' };

			const result = AutoEnvService.applyAutoEnvelopeIfEligible(
				pattern,
				0,
				{ channelIndex: 0, fieldKey: 'instrument' },
				tuningTable,
				ratio,
				true
			);

			expect(result).toBe(pattern);
			expect(result.patternRows[0].envelopeValue).toBe(0);
		});
	});
});
