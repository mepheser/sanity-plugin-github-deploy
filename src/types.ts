/** @public */
export type DeployStatus = 'idle' | 'queued' | 'in_progress' | 'completed' | 'failed'

/** @public */
export interface DeployRun {
  id: number
  status: DeployStatus
  conclusion: string | null
  createdAt: string
  updatedAt: string
  headSha: string
  commitMessage: string | null
  htmlUrl: string
}

/** @public */
export interface GitHubConfig {
  owner: string
  repo: string
  workflowId: string
  branch: string
}

/** @public */
export interface DeployToolOptions {
  githubToken: string
  github: GitHubConfig
  /** Which document types to track for undeployed changes. Omit to disable. */
  documentTypes?: string[]
  /** GROQ expression for the title projection. Defaults to `coalesce(title, name, _type)`. */
  titleField?: string
}
