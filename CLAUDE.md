# CLAUDE.md

## What This Is

`sanity-plugin-github-deploy` is a Sanity Studio v3 plugin that adds a "Deploy" tool tab for triggering and monitoring GitHub Actions workflow dispatches. It was extracted from the `website-venedigerau` monorepo (`apps/studio/plugins/deploy-tool/`) into a standalone, publishable npm package.

## Architecture

```
src/
  index.ts          — Plugin entry: exports `deployTool` (definePlugin), re-exports types
  types.ts          — DeployToolOptions, GitHubConfig, DeployRun, DeployStatus
  DeployTool.tsx    — Tool component wrapper, passes options to DeployHistory
  github.ts         — GitHub REST API layer: triggerWorkflow(), listRecentRuns()
  components/
    DeployHistory.tsx — Main UI: deploy button, run history list, undeployed changes
```

- **Plugin registration**: `deployTool(options)` returns a Sanity tool with a RocketIcon
- **GitHub API**: Direct `fetch` calls to `api.github.com` (no SDK), uses Bearer token auth
- **Data fetching**: SWR for polling — 3s during active runs, 30s when idle
- **Undeployed changes**: Optional feature — queries Sanity for documents of configured `documentTypes` updated after the last successful deploy. Uses `$documentTypes` as a GROQ parameter (not hardcoded).
- **Pending trigger UX**: After dispatching, a placeholder "queued" row is shown until the API confirms the run (or 30s timeout)

## Key Types

- `DeployToolOptions` — plugin config: `githubToken`, `github` (GitHubConfig), optional `documentTypes`, optional `titleField`
- `GitHubConfig` — `owner`, `repo`, `workflowId`, `branch`
- `DeployRun` — normalized run data from GitHub API
- `DeployStatus` — `'idle' | 'queued' | 'in_progress' | 'completed' | 'failed'`

## Dependencies

- **Runtime**: `swr` (data fetching), `@sanity/incompatible-plugin` (v2 guard)
- **Peer**: `react`, `react-dom`, `sanity`, `styled-components`
- **Dev/Build**: `@sanity/pkg-utils`, `@sanity/plugin-kit`, `@sanity/ui`, `@sanity/icons`, `typescript`

## Build & Dev

- Package manager: **npm**
- Build: `npm run build` (runs `plugin-kit verify-package` then `pkg-utils build --strict --check --clean`)
- Watch: `npm run watch`
- Clean: `npm run clean`
- Output dir: `dist/` (not `lib/`)
- Node >= 18 required

## Code Style

- Prettier config in `.prettierrc`: no semicolons, single quotes, no bracket spacing, print width 200
- TypeScript: strict, `jsx: "preserve"`, `module: "preserve"`, `noEmit: true`
- UI uses `@sanity/ui` components (Card, Stack, Flex, Badge, Button, Text)

## Plugin Packaging

- Each entry in `exports` requires a `"source"` field for `@sanity/pkg-utils` to detect the dist path
- Top-level `"source"` field in package.json must NOT duplicate `exports["."].source` — pkg-utils errors
- `package.config.ts`: `ae-missing-release-tag` rule set to `"warn"`
- Plugin verification config lives under the `"sanityPlugin"` key in `package.json` (not `"sanity"`)
- `sanity.json` must implement `part:@sanity/base/sanity-root` — required for plugin-kit compatibility
