import type { ProjectDiff, ProjectHistoryPath } from '../../models/history';
import { HistoryClone } from './history-clone';

type MutableContainer = Record<string, unknown> | unknown[];

export class ProjectDiffService {
	static filterNoOp(diffs: ProjectDiff[]): ProjectDiff[] {
		return diffs.filter((diff) => !this.isNoOp(diff));
	}

	static isNoOp(diff: ProjectDiff): boolean {
		switch (diff.kind) {
			case 'set':
				return this.valuesEqual(diff.before, diff.after);
			case 'insert':
			case 'remove':
				return diff.values.length === 0;
			case 'move':
				return diff.fromIndex === diff.toIndex;
		}
	}

	static invert(diff: ProjectDiff): ProjectDiff {
		switch (diff.kind) {
			case 'set':
				return {
					kind: 'set',
					path: diff.path,
					before: HistoryClone.value(diff.after),
					after: HistoryClone.value(diff.before)
				};
			case 'insert':
				return {
					kind: 'remove',
					path: diff.path,
					index: diff.index,
					values: diff.values.map((value) => HistoryClone.value(value))
				};
			case 'remove':
				return {
					kind: 'insert',
					path: diff.path,
					index: diff.index,
					values: diff.values.map((value) => HistoryClone.value(value))
				};
			case 'move':
				return {
					kind: 'move',
					path: diff.path,
					fromIndex: diff.toIndex,
					toIndex: diff.fromIndex
				};
		}
	}

	static invertAll(diffs: ProjectDiff[]): ProjectDiff[] {
		return diffs
			.slice()
			.reverse()
			.map((diff) => this.invert(diff));
	}

	static applyAll(target: unknown, diffs: ProjectDiff[]): void {
		for (const diff of diffs) {
			this.apply(target, diff);
		}
	}

	static apply(target: unknown, diff: ProjectDiff): void {
		switch (diff.kind) {
			case 'set':
				this.setAtPath(target, diff.path, HistoryClone.value(diff.after));
				break;
			case 'insert':
				this.arrayAtPath(target, diff.path).splice(
					diff.index,
					0,
					...diff.values.map((value) => HistoryClone.value(value))
				);
				this.refreshArrayContainer(target, diff.path);
				break;
			case 'remove':
				this.arrayAtPath(target, diff.path).splice(diff.index, diff.values.length);
				this.refreshArrayContainer(target, diff.path);
				break;
			case 'move':
				this.move(target, diff.path, diff.fromIndex, diff.toIndex);
				break;
		}
	}

	static getAtPath(target: unknown, path: ProjectHistoryPath): unknown {
		let current = target;
		for (const segment of path) {
			current = (current as Record<string | number, unknown>)[segment];
		}
		return current;
	}

	static setAtPath(target: unknown, path: ProjectHistoryPath, value: unknown): void {
		if (path.length === 0) return;
		const parent = this.containerAtPath(target, path.slice(0, -1));
		const key = path[path.length - 1];
		parent[key as keyof MutableContainer] = value as never;
		this.refreshArrayContainer(target, path.slice(0, -1));
	}

	private static move(
		target: unknown,
		path: ProjectHistoryPath,
		fromIndex: number,
		toIndex: number
	): void {
		if (fromIndex === toIndex) return;
		const array = this.arrayAtPath(target, path);
		const [item] = array.splice(fromIndex, 1);
		array.splice(toIndex, 0, item);
		this.refreshArrayContainer(target, path);
	}

	private static arrayAtPath(target: unknown, path: ProjectHistoryPath): unknown[] {
		const value = this.getAtPath(target, path);
		if (!Array.isArray(value)) {
			throw new Error(`History diff path is not an array: ${path.join('.')}`);
		}
		return value;
	}

	private static containerAtPath(target: unknown, path: ProjectHistoryPath): MutableContainer {
		const value = path.length === 0 ? target : this.getAtPath(target, path);
		if (!value || typeof value !== 'object') {
			throw new Error(`History diff path is not an object: ${path.join('.')}`);
		}
		return value as MutableContainer;
	}

	private static refreshArrayContainer(target: unknown, path: ProjectHistoryPath): void {
		if (path.length === 0) return;
		const key = path[path.length - 1];
		const parentPath = path.slice(0, -1);
		const parent = this.containerAtPath(target, parentPath);
		const value = parent[key as keyof MutableContainer];
		if (Array.isArray(value)) {
			parent[key as keyof MutableContainer] = [...value] as never;
		}
	}

	private static valuesEqual(left: unknown, right: unknown): boolean {
		if (Object.is(left, right)) return true;
		if (typeof left !== typeof right) return false;
		if (!left || !right || typeof left !== 'object') return false;
		if (Array.isArray(left) || Array.isArray(right)) {
			if (!Array.isArray(left) || !Array.isArray(right)) return false;
			if (left.length !== right.length) return false;
			return left.every((value, index) => this.valuesEqual(value, right[index]));
		}

		const leftObject = left as Record<string, unknown>;
		const rightObject = right as Record<string, unknown>;
		const leftKeys = Object.keys(leftObject);
		const rightKeys = Object.keys(rightObject);
		if (leftKeys.length !== rightKeys.length) return false;
		return leftKeys.every(
			(key) =>
				Object.hasOwn(rightObject, key) &&
				this.valuesEqual(leftObject[key], rightObject[key])
		);
	}
}
