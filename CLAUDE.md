# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Платформа для прототипирования интерактивных новелл. Основа построена на библиотеке xyflow — сейчас реализовано рисование карточек сцен на канвасе. Генератор картинок находится в `./image_gen/`, сервер изображений — в `./image_server/`, фронтенд — в `./client/`. Контент персистится между сессиями через персистентный стор в localStorage. В интерфейсе есть панель с инструментами.

## Commands

### Client (React frontend) — run from `client/`

- `pnpm dev` — Start Vite dev server (main React app)
- `pnpm prod` — Production build
- `pnpm test` — Run tests with Vitest
- `pnpm coverage` — Run tests with coverage
- `pnpm lint` — Lint via lint-staged config: `eslint --fix` on `*.{js,jsx,ts,tsx}`

### Game engine (novel player) — run from `game/`

- `pnpm dev` — Start Vite dev server (port 5174)
- `pnpm build` — Production build

### Auxiliary services

- `image_server/` — Express image upload/serving API (port 3007). Run with `node image_server/index.js`
- `image_gen/` — Google GenAI image generation service. Run with `cd image_gen && pnpm dev` (uses tsx)

## Architecture

**Client app (`client/`)** — React 18 + TypeScript + Vite SPA. A visual node-based editor for building scene graphs using `@xyflow/react` (React Flow).

- `client/src/index.tsx` — Entry point. Sets up BrowserRouter and renders App.
- `client/src/App.tsx` — Uses `useRoutes` with route config from `src/routes/index.tsx`.
- `client/src/routes/index.tsx` — Route definitions. Layout wraps child routes via `<Outlet />`.
- `client/src/pages/main/index.tsx` — Core page. Contains the React Flow canvas where users create scene nodes, connect them via edges, and export to JSON. This is the primary feature of the app.

**Scene node model:** Each node has `SceneNodeData` (label, image URL, outputs array). Outputs are connection points on the right side of a node. State is managed via `FlowContext` (React context providing `updateNodeData`, `addOutput`, `removeOutput`, `updateOutput`).

**Game engine (`game/`)** — Vanilla TypeScript + Vite. Standalone player for interactive novels. Loads a scene-graph JSON file exported from the client editor and renders a playable game: sequential scenes with background images, text labels, and branching dialogue choices. Core logic in `game/src/engine.ts` (GameEngine class), UI rendering in `game/src/main.ts`.

**image_server/** — Standalone Express + Sharp service for image upload, listing (with base64 thumbnails), retrieval, deletion, and renaming. Stores files in `image_server/images/`.

**image_gen/** — Standalone Express + Google GenAI service that generates images and uploads them to the image-server via OpenAPI-generated client.

## Key Conventions

- Path alias: `@/` maps to `client/src/` (configured in both tsconfig.json and vite.config.js inside `client/`)
- CSS Modules with camelCase convention (`styles.sceneCard`), PostCSS with nested/import/autoprefixer
- UI text is in Russian
- ESLint + Prettier enforced; unused vars prefixed with `_` are allowed
- Commit messages follow conventional commits (commitlint configured)
- TypeScript strict mode enabled
