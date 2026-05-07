import type { ResolvedConfig } from 'vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function getGitCommitHash() {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

function getBuildDate() {
	return new Date().toISOString().split('T')[0];
}

function serviceWorkerCacheVersion() {
	let outDir = 'dist';
	return {
		name: 'sw-cache-version',
		apply: 'build' as const,
		configResolved(config: ResolvedConfig) {
			outDir = config.build.outDir;
		},
		closeBundle() {
			const swPath = join(outDir, 'sw.js');
			const content = readFileSync(swPath, 'utf-8');
			writeFileSync(swPath, content.replace('__BUILD_VERSION__', getGitCommitHash()));
		}
	};
}

// https://vite.dev/config/
export default defineConfig({
	base: '/',
	assetsInclude: ['**/*.wasm'],
	build: {
		target: 'esnext',
		rollupOptions: {
			external: (id) =>
				id === 'ayumi-constants.js' ||
				id.endsWith('/ayumi-constants.js') ||
				id === '/ayumi-constants.js'
		}
	},
	plugins: [
		svelte(),
		tailwindcss(),
		Icons({
			compiler: 'svelte'
		}),
		serviceWorkerCacheVersion()
	],
	define: {
		'import.meta.env.VITE_COMMIT_HASH': JSON.stringify(getGitCommitHash()),
		'import.meta.env.VITE_BUILD_DATE': JSON.stringify(getBuildDate())
	}
});
