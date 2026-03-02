# sanity-plugin-github-deploy

[![npm version](https://img.shields.io/npm/v/sanity-plugin-github-deploy)](https://www.npmjs.com/package/sanity-plugin-github-deploy)

A Sanity Studio plugin for triggering and monitoring GitHub Actions deployments directly from the studio.

## Motivation

Sanity offers powerful live content features and cache invalidation for frameworks like Next.js and Astro in SSR mode. But sometimes you just want a fully static site served from a CDN — zero runtime, zero maintenance, maximum performance.

In that setup, content changes don't go live until you rebuild and redeploy the site. This plugin gives editors a "Deploy" tab right inside Sanity Studio so they can trigger a full rebuild, deploy, and cache purge with a single click — no need to open GitHub or understand CI/CD.

## Preparation

Before using this plugin, you need a GitHub Actions workflow in your repository that handles the full deploy pipeline:

1. **Build** the static site with content from Sanity (e.g. `astro build` or `next build && next export`)
2. **Upload** the generated files to your CDN or static hosting provider
3. **Purge** the CDN or server cache so the new version goes live immediately

The plugin triggers this workflow via GitHub's [workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event). Your workflow file needs a `workflow_dispatch` trigger, and the GitHub token you provide must have the `actions` scope.

## Features

- Display of current live deployment
- List of changed content (documents) since last live deployment
- Button to trigger a new deployment with progress indicator

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

## License

[MIT](LICENSE)
