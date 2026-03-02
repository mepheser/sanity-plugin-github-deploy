import {defineType, defineField} from 'sanity'

/** @internal */
export const deployRunType = defineType({
  name: 'deploy.run',
  title: 'Deploy Run',
  type: 'document',
  liveEdit: true,
  fields: [
    defineField({name: 'runId', title: 'Run ID', type: 'number'}),
    defineField({name: 'status', title: 'Status', type: 'string'}),
    defineField({name: 'conclusion', title: 'Conclusion', type: 'string'}),
    defineField({name: 'createdAt', title: 'Created At', type: 'datetime'}),
    defineField({name: 'updatedAt', title: 'Updated At', type: 'datetime'}),
    defineField({name: 'headSha', title: 'Head SHA', type: 'string'}),
    defineField({name: 'commitMessage', title: 'Commit Message', type: 'string'}),
    defineField({name: 'htmlUrl', title: 'HTML URL', type: 'url'}),
  ],
})

/** @internal */
export const deployTriggerType = defineType({
  name: 'deploy.trigger',
  title: 'Deploy Trigger',
  type: 'document',
  fields: [
    defineField({name: 'triggeredAt', title: 'Triggered At', type: 'datetime'}),
  ],
})
