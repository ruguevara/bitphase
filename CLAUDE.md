# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bitphase is a chiptune tracker for creating music on retro sound chips. Built with Svelte 5, TypeScript, Vite, and Tailwind 4.

## Commands

Package manager is **pnpm** (do not use npm/yarn).

- `pnpm dev` - Build WASM + start dev server (HMR)
- `pnpm build` - Build WASM + production build
- `pnpm build:wasm` - Build only the Ayumi WASM (needs Emscripten `emcc` on PATH or `EMSDK` set). Run once, or when `external/ayumi/` changes.
- `pnpm check` - Type checking: `svelte-check` (app) + `tsc` (node config). This is the primary correctness gate.
- `pnpm test` - Vitest watch mode
- `pnpm test:run` - Vitest run once
- Run a single test: `pnpm test:run tests/path/to/file.test.ts` or filter by name with `pnpm test:run -t "test name"`
- `pnpm btp-to-wav` - CLI to render a `.btp` project to WAV (`cli/btp-to-wav.ts`)

Formatting is enforced with Prettier: `npx prettier --check .` (CI) / `npx prettier --write .` to fix.

### Note on linting

There is a stale `.eslintrc.cjs`, but **ESLint is not installed and there is no `lint` script**. The actual gates are `pnpm check` (types) and Prettier (formatting). Always run `pnpm check` after changes — type errors have caused production bugs. CI (`.github/workflows/test.yml`) runs `pnpm check` + `pnpm test:run` + `prettier --check`.

## Architecture

### Directory Structure

- `src/lib/chips/` - Chip implementations. Each chip provides `schema.ts` (channel/field definitions), `adapter.ts` (data manipulation), `renderer.ts` (pattern display), `types.ts`. `base/` holds the generic interfaces/base classes all chips extend.
- `src/lib/models/` - Domain models: `project.ts`, `song.ts`, `project-fields.ts`
- `src/lib/services/` - Business logic: `audio/`, `file/` (import/export), `pattern/` (editing, navigation, clipboard), `project/`, `modal/`, `history/`, `backup/`, `midi/`, `user-scripts/`
- `src/lib/stores/` - Reactive state in `.svelte.ts` files using the `$state` rune
- `src/lib/ui-rendering/` - Canvas-based renderers for pattern editor and order list
- `src/lib/components/` - UI components organized by feature (Menu, Song, Tables, Instruments, Modal, etc.)
- `src/lib/config/` - App configuration (menu definitions, settings, themes)
- `tests/` - Test files mirroring `src/` structure

### Key Patterns

- **Chip abstraction**: Never hardcode chip-specific features. Use `src/lib/chips/base/schema.ts` for generic definitions. Chips implement adapters/renderers extending base classes. Chips are registered in `src/lib/chips/registry.ts`, keyed by the `ChipType` union in `chip-registration.ts` (currently only `'ay'`). Look chips up via `getChipByType` / `getAllChips`.
- **State management**: Use Svelte 5 runes (`$state`, `$derived`, `$effect`) in `.svelte.ts` files. Do not use writable stores.
- **Pattern editing**: Field-based editing system in `src/lib/services/pattern/editing/` with strategies per field type (`field-strategies.ts`, `pattern-field-input.ts`, `pattern-note-input.ts`, etc.).
- **File formats**: Import/export lives in `src/lib/services/file/` — PT3, VT2, PSG, SNDH, WAV. The VT converter (`vt-converter.ts`) is the largest/most intricate piece.

### External Dependencies

- `external/ayumi/` - AY-8910 emulator C code (git submodule, `branch = bitphase`), compiled to WASM via Emscripten by `build-wasm.sh` / `build-wasm.ps1`. Output goes to `public/ayumi.wasm`. The list of exported C functions lives in `build-wasm.sh`.
- `wasmoon` - Lua VM for user scripts. `jszip` for archive handling.

### Path Alias

`@` maps to `./src` (configured in vite and vitest).

## Conventions

- Svelte 5 syntax only (runes, `onclick` not `on:click`). Detailed Svelte 5 API rules are in `.cursor/rules/svelte5.mdc`.
- No comments in code - write self-documenting code.
- Tailwind 4 for styling.
- Follow KISS, DRY, SOLID principles. Keep good OOP practices.
- Tests go in `tests/` mirroring `src/`.

Currently bitphase supports only AY-8910/YM2149F, but the architecture must support other chips in the future, so keep code modular and easy to extend. Chip-specific code in generic parts is not allowed — when another chip is added, that code would have to be rewritten.
