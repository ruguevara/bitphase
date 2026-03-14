import type { Song, Instrument, Pattern } from '../models/song';
import { Project, Table } from '../models/project';
import { undoRedoStore } from './undo-redo.svelte';

class ProjectStore {
	songs = $state<Song[]>([]);
	patterns = $state<Pattern[][]>([]);
	patternOrder = $state<number[]>([]);
	patternOrderColors = $state<Record<number, string>>({});
	tables = $state<Table[]>([]);
	instruments = $state<Instrument[]>([]);
	settings = $state<Record<string, unknown>>({
		title: '',
		author: '',
		initialSpeed: 3
	});
	initialized = $state(false);

	applyProject(project: Project): void {
		undoRedoStore.clear();
		this.settings = {
			title: project.name,
			author: project.author,
			initialSpeed: project.songs[0]?.initialSpeed ?? 3
		};
		this.patterns = project.songs.map((song) => song.patterns);
		this.songs = project.songs;
		this.patternOrder = project.patternOrder;
		this.patternOrderColors = project.patternOrderColors ?? {};
		this.tables = project.tables;
		this.instruments = project.instruments;
	}

	getCurrentProject(): Project {
		const songs = this.songs.map((song, i) => {
			song.patterns = this.patterns[i] ?? [];
			return song;
		});
		return new Project(
			this.settings.title as string,
			this.settings.author as string,
			songs,
			0,
			this.patternOrder,
			this.tables,
			this.patternOrderColors,
			this.instruments
		);
	}

	removeSong(index: number): void {
		this.songs = this.songs.filter((_, i) => i !== index);
		this.patterns = this.patterns.filter((_, i) => i !== index);
	}

	addSong(song: Song): void {
		this.songs = [...this.songs, song];
		this.patterns = [...this.patterns, song.patterns];
	}

	updatePatterns(songIndex: number, newPatterns: Pattern[]): void {
		this.patterns[songIndex] = newPatterns;
		this.patterns = [...this.patterns];
	}

	addPatternToAllSongs(pattern: Pattern): void {
		this.patterns = this.patterns.map((songPatterns) => {
			const existing = songPatterns.find((p) => p.id === pattern.id);
			if (existing) {
				return songPatterns.map((p) => (p.id === pattern.id ? pattern : p));
			}
			return [...songPatterns, pattern];
		});
	}
}

export const projectStore = new ProjectStore();
