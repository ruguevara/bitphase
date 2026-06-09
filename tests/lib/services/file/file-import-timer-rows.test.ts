import { describe, it, expect } from 'vitest';
import { FileImportService } from '@/lib/services/file/file-import';
import { normalizeAyInstrumentFields } from '@/lib/chips/ay/instrument';

describe('file import timer rows', () => {
	it('preserves fm and env fm timer waveforms on project load', async () => {
		const json = JSON.stringify({
			name: 'test',
			author: '',
			songs: [],
			instruments: [
				{
					id: '01',
					name: 'Test',
					loop: 0,
					rows: [{ tone: true, volume: 15 }],
					timerRows: [
						{
							sid: true,
							fm: true,
							envfm: true,
							timerWaveform: [15, 0],
							fmTimerWaveform: [0, 12, 4],
							envFmTimerWaveform: [-2, 2],
							fmOffsetMode: 'period'
						}
					]
				}
			]
		});

		const project = await FileImportService.reconstructFromJsonAsync(json);
		const instrument = project.instruments[0]!;
		const extended = instrument as typeof instrument & {
			timerRows?: {
				fmTimerWaveform?: number[];
				envFmTimerWaveform?: number[];
				fmOffsetMode?: string;
			}[];
		};

		expect(extended.timerRows?.[0]?.fmTimerWaveform).toEqual([0, 12, 4]);
		expect(extended.timerRows?.[0]?.envFmTimerWaveform).toEqual([-2, 2]);
		expect(extended.timerRows?.[0]?.fmOffsetMode).toBe('period');

		const fields = normalizeAyInstrumentFields(instrument);
		expect(fields.timerRows[0]?.fmTimerWaveform).toEqual([0, 12, 4]);
		expect(fields.timerRows[0]?.envFmTimerWaveform).toEqual([-2, 2]);
		expect(fields.timerRows[0]?.fmOffsetMode).toBe('period');
	});
});
