import { describe, expect, it } from 'vitest'
import { applyGitLogCollapsedFragments, findGitLogLinearFragments } from './git-log-graph-collapse'
import { gitLogGraphLaneX, hitTestGitLogGraphRow } from './git-log-graph-hit-test'
import { buildGitLogGraphLayout, type GitLogGraphCommit } from './git-log-graph-layout'
import { gitLogGraphHighlight } from './git-log-graph-path-highlight'

const c = (id: string, ...parentIds: string[]): GitLogGraphCommit => ({ id, parentIds })

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
  return { layout, fragments, context, row }
}

describe('gitLogGraphHighlight', () => {
  it('highlights the whole run: every commit and every lane segment between them', () => {
    const { layout, fragments, context, row } = setup(oneMerge)
    const s3 = row('s3')
    const hit = hitTestGitLogGraphRow(s3, gitLogGraphLaneX(s3.lane), 2, context)
    const highlight = gitLogGraphHighlight(hit, layout, fragments)
    expect([...highlight.commitIds]).toEqual(['s4', 's3', 's2', 's1'])
    const sideLane = s3.lane
    // s4->s3, s3->s2 across b's row (2 halves), s2->s1.
    expect(highlight.edges.size).toBe(4)
    for (const edge of highlight.edges) {
      expect([edge.from, edge.to]).toEqual([sideLane, sideLane])
      expect(['s3', 's2', 's1']).toContain(edge.target)
    }
    // The merge-in diagonal is not part of the run highlight.
    expect([...highlight.edges].some((edge) => edge.target === 's4')).toBe(false)
  })

  it('highlights a collapsed run: its endpoints and the dashed edge', () => {
    const { layout, fragments, context, row } = setup(oneMerge, ['s4'])
    const s4 = row('s4')
    const hit = hitTestGitLogGraphRow(s4, gitLogGraphLaneX(s4.lane), 22, context)
    const highlight = gitLogGraphHighlight(hit, layout, fragments)
    expect([...highlight.commitIds]).toEqual(['s4', 's1'])
    expect([...highlight.edges].every((edge) => edge.target === 's1')).toBe(true)
    expect(highlight.edges.size).toBe(2)
  })

  it('highlights the merge-in edge path from the merge dot to the merged parent', () => {
    // m merges far-away x; the merged lane passes rows b and c before reaching x.
    const commits = [c('m', 'b', 'x'), c('b', 'c'), c('c', 'x2'), c('x', 'x2'), c('x2')]
    const { layout, fragments, context, row } = setup(commits)
    const m = row('m')
    const xLane = row('x').lane
    const x = (gitLogGraphLaneX(m.lane) + gitLogGraphLaneX(xLane)) / 2 + 1
    const hit = hitTestGitLogGraphRow(m, x, 19, context)
    expect(hit).toMatchObject({ kind: 'edge', fragmentId: null })
    const highlight = gitLogGraphHighlight(hit, layout, fragments)
    expect([...highlight.commitIds]).toEqual(['m', 'x'])
    // Diagonal m->lane, then the lane through rows b and c into x.
    expect(highlight.edges.size).toBe(3)
    expect([...highlight.edges].every((edge) => edge.target === 'x')).toBe(true)

    // Hovering the same path lower down highlights the same edges.
    const lower = hitTestGitLogGraphRow(row('c'), gitLogGraphLaneX(xLane), 3, context)
    expect(gitLogGraphHighlight(lower, layout, fragments).edges).toEqual(highlight.edges)
  })

  it('highlights nothing for a first-parent edge outside any run or for a node', () => {
    const { layout, fragments, context, row } = setup(oneMerge)
    const m = row('m')
    const firstParent = hitTestGitLogGraphRow(m, gitLogGraphLaneX(m.lane), 22, context)
    expect(firstParent).toMatchObject({ kind: 'edge', fragmentId: null })
    expect(gitLogGraphHighlight(firstParent, layout, fragments).edges.size).toBe(0)
    expect(gitLogGraphHighlight({ kind: 'node', rowId: 'm' }, layout, fragments).edges.size).toBe(0)
  })
})
