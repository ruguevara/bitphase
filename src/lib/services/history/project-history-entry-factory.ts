import type {
	ProjectDiff,
	ProjectHistoryEntry,
	ProjectHistoryMetadata
} from '../../models/history';
import { HistoryClone } from './history-clone';
import { ProjectDiffService } from './project-diff-service';

export class ProjectHistoryEntryFactory {
	static create(
		metadata: ProjectHistoryMetadata,
		diffs: ProjectDiff[]
	): ProjectHistoryEntry | null {
		const meaningfulDiffs = ProjectDiffService.filterNoOp(diffs);
		if (meaningfulDiffs.length === 0) return null;
		const stableDiffs = meaningfulDiffs.map((diff) => this.cloneDiff(diff));
		return {
			...metadata,
			undoLabel: metadata.undoLabel ?? `Undo ${metadata.label}`,
			redoLabel: metadata.redoLabel ?? `Redo ${metadata.label}`,
			diffs: stableDiffs,
			inverseDiffs: ProjectDiffService.invertAll(stableDiffs)
		};
	}

	private static cloneDiff(diff: ProjectDiff): ProjectDiff {
		switch (diff.kind) {
			case 'set':
				return {
					...diff,
					before: HistoryClone.value(diff.before),
					after: HistoryClone.value(diff.after)
				};
			case 'insert':
			case 'remove':
				return {
					...diff,
					values: diff.values.map((value) => HistoryClone.value(value))
				};
			case 'move':
				return { ...diff };
		}
	}
}
