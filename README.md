# sanity-plugin-github-deploy

A Sanity Studio plugin for triggering and monitoring GitHub Actions deployments directly from the studio.

## Installation

```sh
npm install sanity-plugin-github-deploy
```

## Usage

Add the plugin to your `sanity.config.ts`:

```ts
import {defineConfig} from 'sanity'
import {deployTool} from 'sanity-plugin-github-deploy'

export default defineConfig({
  // ...
  plugins: [
    deployTool({
      githubToken: process.env.SANITY_STUDIO_GITHUB_TOKEN!,
      github: {
        owner: 'your-org',
        repo: 'your-repo',
        workflowId: 'deploy.yml',
        branch: 'main',
      },
      // Optional: track undeployed changes for specific document types
      documentTypes: ['page', 'post', 'settings'],
      // Optional: GROQ expression for display title
      titleField: 'coalesce(title, name, _type)',
    }),
  ],
})
```

## Configuration

### `DeployToolOptions`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `githubToken` | `string` | Yes | GitHub personal access token with `actions` scope |
| `github` | `GitHubConfig` | Yes | GitHub repository configuration |
| `documentTypes` | `string[]` | No | Document types to track for undeployed changes. Omit to disable. |
| `titleField` | `string` | No | GROQ expression for the title projection. Default: `coalesce(title, name, _type)` |

### `GitHubConfig`

| Option | Type | Description |
|--------|------|-------------|
| `owner` | `string` | Repository owner or organization |
| `repo` | `string` | Repository name |
| `workflowId` | `string` | Workflow filename (e.g. `deploy.yml`) or numeric ID |
| `branch` | `string` | Branch to trigger deployments on |

## Features

- Trigger GitHub Actions deployments from within Sanity Studio
- View deployment history with status and commit details
- Live status updates while deployments are in progress
- Track undeployed content changes since the last successful deploy

## License

MIT
