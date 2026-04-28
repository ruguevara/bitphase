<script lang="ts">
	import type { ChipProcessor } from '../../chips/base/processor';
	import type { ChipSetting } from '../../chips/base/schema';
	import type { Song } from '../../models/song';
	import { PROJECT_FIELDS } from '../../models/project-fields';
	import { getChipByType } from '../../chips/registry';
	import Card from '../Card/Card.svelte';
	import CardElement from '../Card/CardElement.svelte';
	import DynamicField from './DynamicField.svelte';
	import IconCarbonChip from '~icons/carbon/chip';
	import IconCarbonFolders from '~icons/carbon/folders';
	import { getContext } from 'svelte';
	import type { AudioService } from '../../services/audio/audio-service';
	import { projectStore } from '../../stores/project.svelte';

	let {
		chipProcessors,
		onChipSettingsApplied
	}: {
		chipProcessors: ChipProcessor[];
		onChipSettingsApplied?: () => void;
	} = $props();

	const songs = $derived(projectStore.songs);

	const services: { audioService: AudioService } = getContext('container');

	const songsByChipType = $derived.by(() => {
		const grouped = new Map<string, Song[]>();
		for (const song of songs) {
			if (!song.chipType) continue;
			if (!grouped.has(song.chipType)) {
				grouped.set(song.chipType, []);
			}
			grouped.get(song.chipType)!.push(song);
		}
		return Array.from(grouped.entries())
			.map(([chipType, songList]) => {
				const chip = getChipByType(chipType);
				return {
					chipType,
					songs: songList,
					chip,
					count: songList.length
				};
			})
			.filter((group) => group.chip !== null);
	});

	const chipsByType = $derived.by(() => {
		const grouped = new Map<string, ChipProcessor[]>();
		for (const processor of chipProcessors) {
			const type = processor.chip.type;
			if (!grouped.has(type)) {
				grouped.set(type, []);
			}
			grouped.get(type)!.push(processor);
		}
		return Array.from(grouped.entries()).map(([type, processors]) => ({
			type,
			processors,
			chip: processors[0].chip,
			count: processors.length
		}));
	});

	const projectSettings = $derived([
		...PROJECT_FIELDS,
		...chipsByType.flatMap(
			(group) => group.chip.schema.settings?.filter((s) => s.group === 'project') || []
		)
	]);

	const projectContextKeys = $derived([
		...new Set(projectSettings.flatMap((s) => s.dependsOn ?? []))
	] as string[]);

	let chipSettingOverrides = $state<Record<string, Record<string, unknown>>>({});
	let previousSongsRef = $state<Song[] | undefined>(undefined);
	let settingsHistorySnapshot = $state<Record<string, unknown>>({});
	$effect(() => {
		if (songs !== previousSongsRef) {
			previousSongsRef = songs;
			chipSettingOverrides = {};
			settingsHistorySnapshot = { ...projectStore.settings };
		}
	});

	let projectContextState = $state<Record<string, unknown>>({});
	$effect(() => {
		for (const key of projectContextKeys) {
			const v = songs[0];
			projectContextState[key] = v
				? Number((v as unknown as Record<string, unknown>)[key] ?? 50)
				: 50;
		}
	});
	const projectContext = $derived(projectContextState);

	function getDependsOnKey(setting: ChipSetting, context: Record<string, unknown>): string {
		if (!setting.dependsOn?.length) return setting.key;
		return setting.dependsOn.map((k) => String(context[k] ?? '')).join('-');
	}

	function handleSettingChange(key: string, value: unknown, setting: ChipSetting) {
		const beforeSettings = { ...settingsHistorySnapshot };
		const beforeSongs = projectStore.cloneForHistory(projectStore.songs);
		const normalized =
			setting.type === 'number' ? Number(value) || setting.defaultValue : value;
		for (const song of songs) {
			(song as unknown as Record<string, unknown>)[key] = normalized;
		}
		settingsHistorySnapshot = { ...projectStore.settings };
		projectStore.recordHistory(
			{
				type: 'settings.update',
				label: `Update ${setting.label}`,
				affectedDomains: ['settings', 'songs']
			},
			[
				projectStore.createSetDiff(['settings'], beforeSettings, projectStore.settings),
				projectStore.createSetDiff(['songs'], beforeSongs, projectStore.songs)
			]
		);
		if (setting.notifyAudioService) {
			services.audioService.chipSettings.set(key, value);
		}
	}

	function resolveAndPushTuningTable(chipType: string) {
		const chip = getChipByType(chipType);
		if (!chip?.schema.resolveTuningTable) return;
		const songsOfType = songs.filter((s) => s.chipType === chipType);
		if (songsOfType.length === 0) return;
		const song = songsOfType[0];
		const record = song as unknown as Record<string, unknown>;
		const table = chip.schema.resolveTuningTable(record);
		for (const s of songsOfType) {
			s.tuningTable = table;
		}
		services.audioService.chipSettings.set('tuningTable', [...table]);
	}

	function handleChipSettingChange(
		chipType: string,
		key: string,
		value: unknown,
		setting: ChipSetting
	) {
		const beforeSongs = projectStore.cloneForHistory(projectStore.songs);
		let normalized = setting.type === 'number' ? Number(value) || setting.defaultValue : value;
		if (setting.type === 'number' && setting.min !== undefined && setting.max !== undefined) {
			const n = Number(normalized);
			normalized = Math.min(setting.max, Math.max(setting.min, n));
		}
		const songsOfType = songs.filter((s) => s.chipType === chipType);
		for (const song of songsOfType) {
			(song as unknown as Record<string, unknown>)[key] = normalized;
		}
		chipSettingOverrides[chipType] = {
			...(chipSettingOverrides[chipType] ?? {}),
			[key]: normalized
		};
		if (projectContextKeys.includes(key)) {
			projectContextState[key] = Number(normalized);
		}

		const chip = getChipByType(chipType);
		if (chip?.schema.tuningTableSettingKeys?.includes(key)) {
			resolveAndPushTuningTable(chipType);
			onChipSettingsApplied?.();
		}

		if (setting.notifyAudioService) {
			const processors = chipsByType.find((g) => g.type === chipType)?.processors || [];
			for (const processor of processors) {
				processor.updateParameter(key, normalized);
			}
			services.audioService.chipSettings.set(key, normalized);
		}
		projectStore.recordHistory(
			{
				type: 'chipSettings.update',
				label: `Update ${setting.label}`,
				affectedDomains: ['chipSettings', 'songs']
			},
			[projectStore.createSetDiff(['songs'], beforeSongs, projectStore.songs)]
		);
	}

	function getChipSettingValue(chipType: string, key: string): unknown {
		const songsOfType = songs.filter((s) => s.chipType === chipType);
		if (songsOfType.length === 0) return undefined;
		return (songsOfType[0] as unknown as Record<string, unknown>)[key];
	}

	$effect(() => {
		songsByChipType.forEach((group) => {
			if (!group.chip) return;
			const settings = group.chip.schema.settings || [];
			settings
				.filter((s) => s.group === 'chip' && s.notifyAudioService)
				.forEach((s) => {
					const value = getChipSettingValue(group.chipType, s.key);
					if (value !== undefined) {
						services.audioService.chipSettings.set(s.key, value);
					}
				});
			if (group.chip?.schema.resolveTuningTable) {
				resolveAndPushTuningTable(group.chipType);
			}
		});
	});
</script>

<div class="flex h-full flex-col gap-3 overflow-auto p-4">
	<Card title="Project Info" icon={IconCarbonFolders} class="flex w-full flex-col gap-2 p-3">
		<div class="flex flex-wrap gap-2">
			{#each projectSettings as setting}
				<div
					class={setting.fullWidth
						? 'w-full basis-full'
						: setting.type === 'toggle'
							? ''
							: 'flex-1'}>
					<CardElement label={setting.label}>
						{#key getDependsOnKey(setting, projectContext)}
							<DynamicField
								{setting}
								bind:value={projectStore.settings[setting.key]}
								context={projectContext}
								hintOverride={setting.computedHint
									? setting.computedHint(projectStore.settings[setting.key], projectContext)
									: undefined}
								onChange={handleSettingChange} />
						{/key}
					</CardElement>
				</div>
			{/each}
		</div>
	</Card>

	{#each songsByChipType as group}
		{#if group.chip}
			{@const chipSettings =
				group.chip.schema.settings?.filter((s) => s.group === 'chip') || []}
			{#if chipSettings.length > 0}
				<Card
					title="{group.chip.name} Settings{group.count > 1
						? ` (${group.count} songs)`
						: ''}"
					icon={IconCarbonChip}
					class="flex w-full flex-col gap-2 p-3">
					{#key songs}
						<div class="flex flex-wrap gap-2">
							{#each chipSettings as setting}
								{#if setting.startNewRow}
									<div class="h-0 min-h-0 w-full basis-full" aria-hidden="true">
									</div>
								{/if}
								{@const baseValue =
									getChipSettingValue(group.chipType, setting.key) ??
									setting.defaultValue}
								{@const currentValue =
									chipSettingOverrides[group.chipType]?.[setting.key] ??
									baseValue}
								{@const context = Object.fromEntries(
									chipSettings.map((s) => [
										s.key,
										chipSettingOverrides[group.chipType]?.[s.key] ??
											getChipSettingValue(group.chipType, s.key) ??
											s.defaultValue
									])
								)}
								{@const settingVisible =
									!setting.showWhen ||
									context[setting.showWhen.key] == setting.showWhen.value}
								{#if settingVisible}
									<div
										class={setting.fullWidth
											? 'w-full basis-full'
											: setting.type === 'toggle'
												? ''
												: 'flex-1'}>
										<CardElement label={setting.label}>
											<DynamicField
												{setting}
												value={currentValue}
												{context}
												onChange={(key, value, s) => {
													handleChipSettingChange(
														group.chipType,
														key,
														value,
														s
													);
												}} />
										</CardElement>
									</div>
								{/if}
							{/each}
						</div>
					{/key}
				</Card>
			{/if}
		{/if}
	{/each}

	{#if chipsByType.length === 0 || chipsByType.every((g) => (g.chip.schema.settings?.filter((s) => s.group === 'chip') || []).length === 0)}
		{#if projectSettings.length === PROJECT_FIELDS.length}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm text-[var(--color-app-text-muted)]">
					No chip-specific settings available
				</p>
			</div>
		{/if}
	{/if}
</div>
