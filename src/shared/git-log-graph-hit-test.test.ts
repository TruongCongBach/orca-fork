import { describe, expect, it } from 'vitest'
import { applyGitLogCollapsedFragments, findGitLogLinearFragments } from './git-log-graph-collapse'
import {
  GIT_LOG_GRAPH_ROW_HEIGHT,
  gitLogGraphHitToggle,
  gitLogGraphLaneX,
  hitTestGitLogGraphRow
} from './git-log-graph-hit-test'
import { buildGitLogGraphLayout, type GitLogGraphCommit } from './git-log-graph-layout'

const c = (id: string, ...parentIds: string[]): GitLogGraphCommit => ({ id, parentIds })
const center = GIT_LOG_GRAPH_ROW_HEIGHT / 2

const oneMerge = [
  c('m', 'b', 's4'),
  c('s4', 's3'),
  c('s3', 's2'),
  c('b', 'a'),
  c('s2', 's1'),
  c('s1', 'a'),
  c('a')
]

function setup(commits: GitLogGraphCommit[], collapsed: string[] = []) {
  const fragments = findGitLogLinearFragments(commits, buildGitLogGraphLayout(commits))
  const applied = applyGitLogCollapsedFragments(commits, fragments, new Set(collapsed))
  const layout = buildGitLogGraphLayout(applied.graphCommits)
  const context = { fragments, collapsedEdgeTargets: applied.collapsedEdgeTargets }
  const row = (id: string) => layout.rows.find((candidate) => candidate.id === id)!
  return { layout, context, row }
}

describe('hitTestGitLogGraphRow', () => {
  it('hits the dot of the row', () => {
    const { context, row } = setup(oneMerge)
    const m = row('m')
    expect(hitTestGitLogGraphRow(m, gitLogGraphLaneX(m.lane) + 2, center - 2, context)).toEqual({
      kind: 'node',
      rowId: 'm'
    })
  })

  it('hits a vertical segment inside a run and maps it to the fragment', () => {
    const { context, row } = setup(oneMerge)
    const s3 = row('s3')
    const hit = hitTestGitLogGraphRow(s3, gitLogGraphLaneX(s3.lane) + 1, 2, context)
    expect(hit).toMatchObject({ kind: 'edge', rowId: 's3', fragmentId: 's4', collapsed: false })
    expect(gitLogGraphHitToggle(hit)).toEqual({ fragmentId: 's4', collapse: true })
  })

  it('hits a pass-through segment in a row of another lane', () => {
    const { context, row } = setup(oneMerge)
    const b = row('b')
    const sideLane = row('s4').lane
    const hit = hitTestGitLogGraphRow(b, gitLogGraphLaneX(sideLane), 3, context)
    expect(hit).toMatchObject({ kind: 'edge', fragmentId: 's4' })
  })

  it('hits the merge-in diagonal, which is not part of the run', () => {
    const { context, row } = setup(oneMerge)
    const m = row('m')
    const x = (gitLogGraphLaneX(m.lane) + gitLogGraphLaneX(row('s4').lane)) / 2 + 1
    const hit = hitTestGitLogGraphRow(m, x, 19, context)
    expect(hit).toMatchObject({ kind: 'edge', rowId: 'm', fragmentId: null })
    expect(hit?.kind === 'edge' && hit.edge.target).toBe('s4')
    expect(gitLogGraphHitToggle(hit)).toBeNull()
  })

  it('misses empty space between lanes', () => {
    const { context, row } = setup(oneMerge)
    expect(hitTestGitLogGraphRow(row('a'), gitLogGraphLaneX(3), center, context)).toBeNull()
  })

  it('maps the dashed edge of a collapsed run to an expand request', () => {
    const { context, row } = setup(oneMerge, ['s4'])
    const s4 = row('s4')
    const hit = hitTestGitLogGraphRow(s4, gitLogGraphLaneX(s4.lane), 22, context)
    expect(hit).toMatchObject({ kind: 'edge', fragmentId: 's4', collapsed: true })
    expect(gitLogGraphHitToggle(hit)).toEqual({ fragmentId: 's4', collapse: false })
  })

  it('treats the run line beside the dot, outside the dot radius, as the edge', () => {
    const { context, row } = setup(oneMerge)
    const s3 = row('s3')
    const x = gitLogGraphLaneX(s3.lane)
    for (const y of [center - 7, center - 6, center + 6, center + 7]) {
      expect(hitTestGitLogGraphRow(s3, x, y, context)).toMatchObject({
        kind: 'edge',
        rowId: 's3',
        fragmentId: 's4'
      })
    }
    expect(hitTestGitLogGraphRow(s3, x, center + 5, context)).toEqual({ kind: 'node', rowId: 's3' })
  })

  it('never toggles on a node hit', () => {
    expect(gitLogGraphHitToggle({ kind: 'node', rowId: 'm' })).toBeNull()
    expect(gitLogGraphHitToggle(null)).toBeNull()
  })
})
