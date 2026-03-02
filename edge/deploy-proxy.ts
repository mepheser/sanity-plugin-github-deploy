/**
 * Bunny CDN Edge Script — Deploy Proxy (Webhook Architecture)
 *
 * Two webhook endpoints:
 *   POST /sanity-webhook  — receives Sanity webhook when deploy.trigger is written
 *   POST /github-webhook  — receives GitHub workflow_run events, writes deploy.run docs to Sanity
 *
 * Environment variables:
 *   GITHUB_TOKEN          — GitHub PAT with `actions` scope
 *   GITHUB_WEBHOOK_SECRET — for validating GitHub webhook signatures
 *   SANITY_WEBHOOK_SECRET — for validating Sanity webhook calls
 *   SANITY_TOKEN          — Sanity API token with write access
 *   PROJECTS — JSON string mapping repo full names to config:
 *   {
 *     "org/website": {
 *       "workflowId": "deploy.yml",
 *       "branch": "main",
 *       "sanityProjectId": "abc123",
 *       "dataset": "production"
 *     }
 *   }
 */

import * as BunnySDK from "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProjectConfig {
  workflowId: string
  branch: string
  sanityProjectId: string
  dataset: string
}

interface WorkflowRun {
  id: number
  status: string | null
  conclusion: string | null
  head_sha: string
  head_commit: {message: string} | null
  html_url: string
  created_at: string
  updated_at: string
}

// ─── Config ─────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN env var is required')

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET
if (!GITHUB_WEBHOOK_SECRET) throw new Error('GITHUB_WEBHOOK_SECRET env var is required')

const SANITY_WEBHOOK_SECRET = process.env.SANITY_WEBHOOK_SECRET
if (!SANITY_WEBHOOK_SECRET) throw new Error('SANITY_WEBHOOK_SECRET env var is required')

const SANITY_TOKEN = process.env.SANITY_TOKEN
if (!SANITY_TOKEN) throw new Error('SANITY_TOKEN env var is required')

const PROJECTS: Record<string, ProjectConfig> = JSON.parse(
  process.env.PROJECTS ?? '{}',
)

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Content-Type': 'application/json'},
  })
}

function error(message: string, status: number): Response {
  return json({error: message}, status)
}

async function verifyHmacSha256(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expected = 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return expected === signature
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sanity-deploy-proxy',
      ...init?.headers,
    },
  })
}

function mapStatus(run: WorkflowRun): {status: string; conclusion: string | null} {
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') {
    return {status: 'queued', conclusion: null}
  }
  if (run.status === 'in_progress') {
    return {status: 'in_progress', conclusion: null}
  }
  if (run.status === 'completed') {
    return {
      status: run.conclusion === 'success' ? 'completed' : 'failed',
      conclusion: run.conclusion,
    }
  }
  return {status: 'idle', conclusion: null}
}

async function writeSanityRunDoc(config: ProjectConfig, run: WorkflowRun): Promise<void> {
  const {status, conclusion} = mapStatus(run)
  const doc = {
    _type: 'deploy.run',
    _id: `deploy.run-${run.id}`,
    runId: run.id,
    status,
    conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    headSha: run.head_sha,
    commitMessage: run.head_commit?.message?.split('\n')[0] ?? null,
    htmlUrl: run.html_url,
  }

  const res = await fetch(
    `https://${config.sanityProjectId}.api.sanity.io/v2024-01-01/data/mutate/${config.dataset}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SANITY_TOKEN}`,
      },
      body: JSON.stringify({mutations: [{createOrReplace: doc}]}),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`Sanity mutate failed ${res.status}: ${body}`)
  }
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

async function handleSanityWebhook(request: Request): Promise<Response> {
  const body = await request.text()

  // Validate Sanity webhook signature
  const signature = request.headers.get('sanity-webhook-signature')
  if (!signature) {
    return error('Missing webhook signature', 401)
  }

  const valid = await verifyHmacSha256(SANITY_WEBHOOK_SECRET!, body, signature)
  if (!valid) {
    return error('Invalid webhook signature', 403)
  }

  const payload = JSON.parse(body)
  const projectId = payload?.projectId ?? payload?.sanityProjectId

  // Find project config by Sanity project ID
  const entry = Object.entries(PROJECTS).find(([, cfg]) => cfg.sanityProjectId === projectId)
  if (!entry) {
    return error('Unknown project', 404)
  }

  const [repoFullName, config] = entry
  const [owner, repo] = repoFullName.split('/')

  // Dispatch GitHub workflow
  const res = await ghFetch(
    `/repos/${owner}/${repo}/actions/workflows/${config.workflowId}/dispatches`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ref: config.branch}),
    },
  )

  if (!res.ok) {
    const ghBody = await res.text()
    return error(`GitHub API ${res.status}: ${ghBody}`, 502)
  }

  return json({ok: true}, 200)
}

async function handleGitHubWebhook(request: Request): Promise<Response> {
  const body = await request.text()

  // Validate GitHub webhook signature
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) {
    return error('Missing webhook signature', 401)
  }

  const valid = await verifyHmacSha256(GITHUB_WEBHOOK_SECRET!, body, signature)
  if (!valid) {
    return error('Invalid webhook signature', 403)
  }

  const event = request.headers.get('x-github-event')
  if (event !== 'workflow_run') {
    return json({ignored: true, reason: `event type: ${event}`}, 200)
  }

  const payload = JSON.parse(body)
  const repoFullName = payload.repository?.full_name
  const config = repoFullName ? PROJECTS[repoFullName] : null

  if (!config) {
    return json({ignored: true, reason: 'unknown repo'}, 200)
  }

  const run: WorkflowRun = payload.workflow_run
  if (!run) {
    return error('Missing workflow_run in payload', 400)
  }

  await writeSanityRunDoc(config, run)
  return json({ok: true, runId: run.id}, 200)
}

// ─── Main Handler ───────────────────────────────────────────────────────────

BunnySDK.net.http.serve(async (request: Request): Promise<Response> => {
  const url = new URL(request.url)

  if (url.pathname === '/sanity-webhook' && request.method === 'POST') {
    return handleSanityWebhook(request)
  }

  if (url.pathname === '/github-webhook' && request.method === 'POST') {
    return handleGitHubWebhook(request)
  }

  return error('Not found', 404)
})
