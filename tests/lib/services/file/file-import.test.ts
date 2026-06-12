import { describe, it, expect } from 'vitest';
import { FileImportService } from '@/lib/services/file/file-import';
import { normalizeAyInstrumentFields } from '@/lib/chips/ay/instrument';
import type { Instrument } from '@/lib/models/song';

describe('FileImportService', () => {
	it('preserves fm and env-fm timer waveforms when reconstructing instruments', async () => {
		const json = JSON.stringify({
			name: 'test',
			chipType: 'AY',
			songs: [],
			instruments: [
				{
					id: '01',
					name: 'I01',
					loop: 0,
					rows: [{ tone: true, volume: 15, noise: false, envelope: true }],
					timerRows: [
						{
							sid: false,
							syncbuzzer: false,
							fm: true,
							envFm: true,
							fmOffsetMode: 'semitone',
							timerWaveform: [15, 0],
							timerWaveformLoop: 0,
							fmWaveform: [0, 12, -4],
							fmWaveformLoop: 1,
							envFmWaveform: [0, -7, 24],
							envFmWaveformLoop: 2
						}
					],
					timerLoop: 0
				}
			],
			patterns: [],
			tables: [],
			tuningTables: []
		});

		const project = await FileImportService.reconstructFromJsonAsync(json);
		const instrument = project.instruments[0] as Instrument & {
			timerRows?: {
				fmWaveform?: number[];
				fmWaveformLoop?: number;
				envFmWaveform?: number[];
				envFmWaveformLoop?: number;
			}[];
		};

		expect(instrument.timerRows?.[0]?.fmWaveform).toEqual([0, 12, -4]);
		expect(instrument.timerRows?.[0]?.fmWaveformLoop).toBe(1);
		expect(instrument.timerRows?.[0]?.envFmWaveform).toEqual([0, -7, 24]);
		expect(instrument.timerRows?.[0]?.envFmWaveformLoop).toBe(2);

		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.fmWaveform).toEqual([0, 12, -4]);
		expect(fields.timerRows[0]?.envFmWaveform).toEqual([0, -7, 24]);
	});
});
