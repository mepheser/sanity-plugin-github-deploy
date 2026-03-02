import {useState, useCallback, useEffect, useMemo, useRef} from 'react'
import {Card, Stack, Flex, Badge, Button, Text} from '@sanity/ui'
import {useClient} from 'sanity'
import useSWR from 'swr'
import type {DeployRun} from '../types'

const statusTones: Record<string, 'caution' | 'default' | 'positive' | 'critical'> = {
  queued: 'caution',
  in_progress: 'default',
  completed: 'positive',
  failed: 'critical',
}

function formatDate(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const time = date.toLocaleTimeString()
  if (day.getTime() === today.getTime()) return `Today, ${time}`
  if (day.getTime() === yesterday.getTime()) return `Yesterday, ${time}`
  return date.toLocaleDateString(undefined, {day: 'numeric', month: 'short'}) + `, ${time}`
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

function LiveDuration({since}: {since: string}) {
  const [, setTick] = useState(0)
  const ref = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    ref.current = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(ref.current)
  }, [])

  return <Text size={1}>{formatDuration(Date.now() - new Date(since).getTime())}</Text>
}

interface ChangedDocument {
  _id: string
  _type: string
  _updatedAt: string
  title: string
}

interface DeployHistoryProps {
  documentTypes?: string[]
  titleField?: string
}

const DEFAULT_TITLE_FIELD = 'coalesce(title, name, _type)'

export function DeployHistory({documentTypes, titleField}: DeployHistoryProps) {
  const [isTriggering, setIsTriggering] = useState(false)
  const [pendingTrigger, setPendingTrigger] = useState(false)
  const sanityClient = useClient({apiVersion: '2024-01-01'})

  const trackChanges = documentTypes && documentTypes.length > 0
  const resolvedTitleField = titleField ?? DEFAULT_TITLE_FIELD

  const {data, isLoading, error} = useSWR<DeployRun[]>(
    ['deploy-runs'],
    () =>
      sanityClient.fetch(
        `*[_type == "deploy.run"] | order(createdAt desc) [0...10] {
          "id": runId, status, conclusion, createdAt, updatedAt,
          headSha, commitMessage, htmlUrl
        }`,
      ),
    {
      refreshInterval: (latestData) => {
        if (pendingTrigger) return 3000
        const hasActive = latestData?.some((r) => r.status === 'queued' || r.status === 'in_progress')
        return hasActive ? 3000 : 30000
      },
      dedupingInterval: 0,
      revalidateOnFocus: true,
    },
  )

  // True when the API itself reports an active run
  const apiHasActiveRun = data?.some((r) => r.status === 'queued' || r.status === 'in_progress')

  // Clear pendingTrigger once the API confirms an active run, or after 30s timeout
  useEffect(() => {
    if (!pendingTrigger) return
    if (apiHasActiveRun) {
      setPendingTrigger(false)
      return
    }
    const timeout = setTimeout(() => setPendingTrigger(false), 30000)
    return () => clearTimeout(timeout)
  }, [pendingTrigger, apiHasActiveRun])

  const hasActiveRun = pendingTrigger || apiHasActiveRun

  const lastCompletedRun = useMemo(() => data?.find((r) => r.status === 'completed'), [data])

  const lastDeployedAt = lastCompletedRun?.createdAt ?? null

  // Query Sanity for documents changed since last deployment
  const {data: changedDocs} = useSWR<ChangedDocument[]>(
    trackChanges && lastDeployedAt ? ['undeployed-changes', lastDeployedAt, documentTypes] : null,
    () =>
      sanityClient.fetch(
        `*[_type in $documentTypes && _updatedAt > $lastDeployedAt]
          | order(_updatedAt desc) {
          _id, _type, _updatedAt,
          "title": ${resolvedTitleField}
        }`,
        {lastDeployedAt, documentTypes},
      ),
    {refreshInterval: 30000, revalidateOnFocus: true},
  )

  // Prepend a placeholder row while waiting for the run to appear
  const displayData = useMemo(() => {
    if (!pendingTrigger) return data ?? []
    const placeholder: DeployRun = {
      id: -1,
      status: 'queued',
      conclusion: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      headSha: '---',
      commitMessage: 'Triggering deployment...',
      htmlUrl: '',
    }
    return [placeholder, ...(data ?? [])]
  }, [data, pendingTrigger])

  const trigger = useCallback(async () => {
    setIsTriggering(true)
    try {
      await sanityClient.createOrReplace({
        _type: 'deploy.trigger',
        _id: 'deploy.trigger',
        triggeredAt: new Date().toISOString(),
      })
      setPendingTrigger(true)
    } catch (err) {
      console.error('Deploy trigger failed:', err)
    } finally {
      setIsTriggering(false)
    }
  }, [sanityClient])

  if (error) console.error('DeployHistory fetch error:', error)

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={4}>
        <Flex justify="space-between" align="center">
          <Text size={2} weight="semibold">
            Deployments
          </Text>
          <Button text={isTriggering ? 'Triggering...' : 'New Deployment'} tone="primary" onClick={trigger} disabled={isTriggering || hasActiveRun} />
        </Flex>

        {/* Current live deployment & undeployed changes */}
        {lastCompletedRun && (
          <Card padding={3} radius={2} border tone="transparent">
            <Stack space={3}>
              <Flex gap={2} align="center">
                <Badge tone="positive" fontSize={1}>
                  Live
                </Badge>
                <Text size={1}>
                  {formatDate(new Date(lastCompletedRun.createdAt))}
                  {' — '}
                  {lastCompletedRun.commitMessage ?? lastCompletedRun.headSha.slice(0, 7)} <span style={{opacity: 0.5}}>({lastCompletedRun.headSha.slice(0, 7)})</span>
                </Text>
              </Flex>

              {trackChanges && changedDocs && changedDocs.length > 0 ? (
                <Stack space={2}>
                  <Text size={1} weight="semibold">
                    Undeployed changes ({changedDocs.length})
                  </Text>
                  {changedDocs.map((doc) => (
                    <Flex key={doc._id} gap={2} align="center">
                      <Badge fontSize={0}>{doc._type}</Badge>
                      <Text size={1}>{doc.title}</Text>
                      <Text size={0} muted>
                        {formatRelative(new Date(doc._updatedAt))}
                      </Text>
                    </Flex>
                  ))}
                </Stack>
              ) : trackChanges && changedDocs ? (
                <Text size={1} muted>
                  All content is up to date.
                </Text>
              ) : null}
            </Stack>
          </Card>
        )}

        {isLoading ? (
          <Text size={1} muted>
            Loading...
          </Text>
        ) : !displayData.length ? (
          <Text size={1} muted>
            No deployments yet.
          </Text>
        ) : (
          <Stack space={3}>
            {displayData.map((run) => {
              const started = formatDate(new Date(run.createdAt))
              const isFinished = run.status === 'completed' || run.status === 'failed'

              return (
                <Card key={run.id} padding={3} radius={2} border>
                  <Flex gap={4} align="center">
                    <Stack space={1} style={{width: 160, flexShrink: 0}}>
                      <Text size={0} muted>
                        Started
                      </Text>
                      <Text size={1}>{started}</Text>
                    </Stack>
                    <Stack space={1} style={{width: 80, flexShrink: 0}}>
                      <Text size={0} muted>
                        Duration
                      </Text>
                      {isFinished ? <Text size={1}>{formatDuration(new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime())}</Text> : <LiveDuration since={run.createdAt} />}
                    </Stack>
                    <Stack space={1} flex={1} style={{minWidth: 0}}>
                      <Text size={1} weight="medium">
                        {run.commitMessage ?? run.headSha.slice(0, 7)}
                      </Text>
                      <Text size={0} muted>
                        {run.headSha.slice(0, 7)}
                      </Text>
                    </Stack>
                    <Flex gap={2} align="center">
                      {run.id === lastCompletedRun?.id && (
                        <Badge tone="positive" fontSize={1}>
                          Live
                        </Badge>
                      )}
                      <Badge tone={statusTones[run.status] ?? 'default'} fontSize={1}>
                        {run.status}
                      </Badge>
                    </Flex>
                  </Flex>
                </Card>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
