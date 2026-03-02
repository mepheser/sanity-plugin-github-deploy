import {definePlugin} from 'sanity'
import {RocketIcon} from '@sanity/icons'
import {DeployTool} from './DeployTool'
import {deployRunType, deployTriggerType} from './schema'
import type {DeployToolOptions} from './types'

/** @public */
export type {DeployToolOptions, DeployRun, DeployStatus} from './types'

/** @public */
export const deployTool = definePlugin<DeployToolOptions>((options) => ({
  name: 'deploy-tool',
  schema: {
    types: [deployRunType, deployTriggerType],
  },
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
