# Repository Guidelines

## Project Structure & Module Organization
This repository is a Yarn workspaces monorepo. `excalidraw-app/` contains the main web app and its app-level tests. Reusable packages live in `packages/` (`common`, `element`, `excalidraw`, `math`, `utils`). Browser examples live in `examples/`, static assets in `public/`, and build/release helpers in `scripts/`. Contributor docs are maintained in `dev-docs/`.

## Build, Test, and Development Commands
Use Node 18+ and Yarn 1.

- `yarn start`: run the local app from `excalidraw-app/`.
- `yarn build`: produce the main production build.
- `yarn build:packages`: rebuild workspace packages used by examples and local package consumers.
- `yarn test`: run the Vitest suite.
- `yarn test:all`: run type-checking, linting, formatting checks, and app tests.
- `yarn test:coverage`: generate coverage reports.
- `yarn fix`: apply Prettier and ESLint fixes.
- `yarn clean-install`: remove installed modules and reinstall cleanly.

## Coding Style & Naming Conventions
Follow `.editorconfig`: UTF-8, LF endings, 2-space indentation, and final newlines. TypeScript and React are the default stack. Prettier formats `css`, `scss`, `json`, `md`, `html`, and `yml`; ESLint covers `js`, `ts`, and `tsx`. Prefer PascalCase for React components, camelCase for functions and variables, and keep test helpers close to the feature they support.

## Testing Guidelines
Tests run with Vitest in a `jsdom` environment using `setupTests.ts`. Place tests beside the affected package or app module using `*.test.ts` or `*.test.tsx`; snapshot files belong in adjacent `__snapshots__/` folders. Current coverage thresholds in `vitest.config.mts` are 60% lines, 70% branches, 63% functions, and 60% statements. Run `yarn test -- --watch=false` before opening a PR when changing shared behavior.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, often scoped, for example `feat(editor): ...`, `fix(math): ...`, or `chore(config): ...`. Keep subjects imperative and concise; add a scope when the affected area is clear. Pull requests should explain the behavior change, link the issue or discussion when available, and include screenshots or recordings for UI changes. Call out test coverage for risky edits and any follow-up work explicitly.

## Security & Configuration Tips
Do not commit secrets from `.env.development` or deployment settings. Treat `firebase-project/`, release scripts, and production config as sensitive paths and keep local-only overrides out of version control.
