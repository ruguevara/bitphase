# Bitphase

<div align="center">
  <img src="public/logo.svg" alt="Logo" width="200"/>
</div>

<img width="3020" height="1972" alt="bitphase app_" src="https://github.com/user-attachments/assets/e64270d0-891a-46e3-829f-c264b8e74d36" />

[Bitphase](https://bitphase.app/)

A modern web-based chiptune tracker designed for creating music on retro sound chips. Currently supports the AY-3-8910 / YM2149F chip (used in ZX Spectrum and other 8-bit computers), with plans to support additional chips in the future.

## Prerequisites

- **Node.js** (v18 or higher)
- **pnpm** (v10.11.0 or higher) - Package manager
- **Emscripten SDK** - Required for building WebAssembly modules

### Installing Emscripten

1. Download and install Emscripten from [emscripten.org](https://emscripten.org/docs/getting_started/downloads.html)
2. Set the `EMSDK` environment variable to point to your Emscripten installation
3. Ensure `emcc` is available in your PATH

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd bitphase
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Build WebAssembly modules**

   ```bash
   pnpm build:wasm
   ```

   This compiles the Ayumi chip emulator to WebAssembly. You only need to run this once, or when the WASM code changes.

4. **Start the development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` (or the port shown in the terminal)

## Available Scripts

- `pnpm dev` - Build WASM and start development server with hot module replacement
- `pnpm build` - Build WASM and create production build
- `pnpm build:wasm` - Build only the WebAssembly modules
- `pnpm preview` - Preview the production build locally
- `pnpm check` - Run TypeScript and Svelte type checking
- `pnpm test` - Run tests in watch mode
- `pnpm test:run` - Run tests once

## Project Structure

```
bitphase/
├── external/            # Ayumi chip emulator C source by Peter Sovietov
├── public/              # Static assets and compiled WASM (ayumi.wasm, fonts, etc.)
├── src/
│   ├── app.css          # Global styles
│   ├── main.ts          # App entry point
│   ├── App.svelte       # Root component
│   └── lib/
│       ├── chips/       # Chip implementations (AY, future chips)
│       │   ├── ay/      # AY-3-8910 implementation
│       │   └── base/    # Base interfaces and utilities
│       ├── components/  # Svelte UI components
│       │   ├── AppLayout/
│       │   ├── Menu/    # Menu bar and navigation
│       │   ├── Song/    # Pattern editor and song view
│       │   ├── Instruments/
│       │   ├── Modal/
│       │   ├── Settings/
│       │   ├── Tables/
│       │   ├── Theme/
│       │   └── ...
│       ├── config/      # App configuration (menu, settings, themes)
│       ├── models/      # Domain models (Project, Song, etc.)
│       │   ├── pt3/     # PT3 tuning tables
│       │   └── song/    # Song model utilities
│       ├── services/    # Business logic services
│       │   ├── app/     # Menu actions and app context
│       │   ├── audio/   # Audio service and chip processors
│       │   ├── backup/  # Autobackup
│       │   ├── file/    # Import/export functionality
│       │   ├── modal/   # Modal service
│       │   ├── pattern/ # Pattern editing (incl. editing/ subdir)
│       │   ├── project/ # Project service and migration
│       │   ├── theme/   # Theme service
│       │   └── user-scripts/  # User scripts (Lua) execution
│       ├── stores/      # Reactive state (Svelte 5 runes, .svelte.ts)
│       ├── types/       # Shared TypeScript types
│       ├── ui-rendering/# Canvas-based pattern and order list rendering
│       └── utils/       # Utility functions
└── tests/               # Tests mirroring src structure
```
