import type { DeployRun, DeployStatus, GitHubConfig } from "./types";

interface RequestOptions {
  github: GitHubConfig;
  token: string;
}

async function ghFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  // 204 No Content (e.g. workflow dispatch)
  if (res.status === 204) return null;
  return res.json();
}

export async function triggerWorkflow(
  { github, token }: RequestOptions
): Promise<void> {
  const { owner, repo, workflowId, branch } = github;
  await ghFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: branch }),
    }
  );
}

export async function listRecentRuns(
  { github, token }: RequestOptions,
  limit = 10
): Promise<DeployRun[]> {
  const { owner, repo, workflowId, branch } = github;
  const data = await ghFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?branch=${branch}&per_page=${limit}&event=workflow_dispatch`,
    token
  );
  return data.workflow_runs.map((run: WorkflowRun) => mapRun(run));
}

interface WorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  head_sha: string;
  head_commit: { message: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

function mapRun(run: WorkflowRun): DeployRun {
  let status: DeployStatus = "idle";
  if (
    run.status === "queued" ||
    run.status === "waiting" ||
    run.status === "pending"
  ) {
    status = "queued";
  } else if (run.status === "in_progress") {
    status = "in_progress";
  } else if (run.status === "completed") {
    status = run.conclusion === "success" ? "completed" : "failed";
  }

  return {
    id: run.id,
    status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    headSha: run.head_sha,
    commitMessage: run.head_commit?.message?.split("\n")[0] ?? null,
    htmlUrl: run.html_url,
  };
}
