import {definePlugin} from 'sanity'
import {RocketIcon} from '@sanity/icons'
import {DeployTool} from './DeployTool'
import type {DeployToolOptions} from './types'

/** @public */
export type {DeployToolOptions, GitHubConfig, DeployRun, DeployStatus} from './types'

/** @public */
export const deployTool = definePlugin<DeployToolOptions>(options => ({
  name: 'deploy-tool',
  tools: [
    {
      name: 'deploy',
      title: 'Deploy',
      icon: RocketIcon,
      component: DeployTool,
      options,
    },
  ],
}))
