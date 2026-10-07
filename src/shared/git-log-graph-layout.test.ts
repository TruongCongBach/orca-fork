import { describe, expect, it } from 'vitest'
import { GIT_HISTORY_REF_COLOR } from './git-history-types'
import { buildGitLogGraphLayout, type GitLogGraphCommit } from './git-log-graph-layout'

const c = (id: string, ...parentIds: string[]): GitLogGraphCommit => ({ id, parentIds })
const lanes = (commits: GitLogGraphCommit[]): number[] =>
  buildGitLogGraphLayout(commits).rows.map((row) => row.lane)
const edges = (list: { from: number; to: number }[]): string[] =>
  list.map((edge) => `${edge.from}>${edge.to}`)

describe('buildGitLogGraphLayout', () => {
  it('keeps a linear history on one lane with vertical edges and one color', () => {
    const layout = buildGitLogGraphLayout([c('c', 'b'), c('b', 'a'), c('a')])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 0, 0])
    expect(layout.laneCount).toBe(1)
    expect(edges(layout.rows[0]!.incoming)).toEqual([])
    expect(edges(layout.rows[1]!.incoming)).toEqual(['0>0'])
    expect(edges(layout.rows[2]!.outgoing)).toEqual([])
    expect(new Set(layout.rows.map((row) => row.color)).size).toBe(1)
  })

  it('branches a merged side line to the right and joins it back with diagonals', () => {
    // m merges side branch s2-s1 into main line b-a.
    const layout = buildGitLogGraphLayout([
      c('m', 'b', 's2'),
      c('s2', 's1'),
      c('b', 'a'),
      c('s1', 'a'),
      c('a')
    ])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 1, 0, 1, 0])
    // Fork edge from the merge dot to the side lane, main lane continues straight.
    expect(edges(layout.rows[0]!.outgoing).sort()).toEqual(['0>0', '0>1'])
    // Side lane closes into the shared parent with a diagonal.
    expect(edges(layout.rows[4]!.incoming).sort()).toEqual(['0>0', '1>0'])
    expect(layout.rows[4]!.outgoing).toEqual([])
    // The side lane keeps one stable color distinct from the main lane.
    expect(layout.rows[1]!.color).toBe(layout.rows[3]!.color)
    expect(layout.rows[1]!.color).not.toBe(layout.rows[0]!.color)
    expect(layout.laneCount).toBe(2)
  })

  it('reuses a freed lane instead of widening the graph', () => {
    const layout = buildGitLogGraphLayout([
      c('m2', 'm1', 'y1'),
      c('y1', 'm1'),
      c('m1', 'base', 'x1'),
      c('x1', 'base'),
      c('base')
    ])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 1, 0, 1, 0])
    expect(layout.laneCount).toBe(2)
  })

  it('lays out two parallel branches merged crosswise without lanes shifting', () => {
    // Branches A (a2-a1) and B (b2-b1) both start at root; M1 merges B into A, then B continues.
    const layout = buildGitLogGraphLayout([
      c('b3', 'b2'),
      c('m1', 'a2', 'b2'),
      c('b2', 'b1'),
      c('a2', 'a1'),
      c('b1', 'root'),
      c('a1', 'root'),
      c('root')
    ])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 1, 0, 1, 0, 1, 0])
    // m1's second parent joins B's existing lane: diagonal 1 -> 0 plus B's own vertical.
    expect(edges(layout.rows[1]!.outgoing).sort()).toEqual(['0>0', '1>0', '1>1'])
    // Only edges touching a dot change lanes; every pass-through line stays vertical.
    layout.rows.forEach((row, index) => {
      for (const edge of row.incoming) {
        const touchesDot = edge.to === row.lane || edge.from === layout.rows[index - 1]?.lane
        expect(edge.from === edge.to || touchesDot).toBe(true)
      }
    })
    expect(layout.laneCount).toBe(2)
  })

  it('opens a nearby lane instead of sweeping across lanes to join a far-away one', () => {
    // main (lane 0) waits for base; two feature heads take lanes 1 and 2; f2 merges main's base.
    const layout = buildGitLogGraphLayout([
      c('main', 'base'),
      c('f1', 'f1base'),
      c('f2', 'f2a', 'base'),
      c('f2a', 'f1base'),
      c('f1base', 'base'),
      c('base')
    ])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 1, 2, 2, 1, 0])
    // f2 (lane 2) merges base, which lane 0 waits for two lanes away: it gets lane 3 instead.
    expect(edges(layout.rows[2]!.outgoing).sort()).toEqual(['0>0', '1>1', '2>2', '2>3'])
    expect(edges(layout.rows[5]!.incoming).sort()).toEqual(['0>0', '1>0', '3>0'])
  })

  it('fans an octopus merge out to one new lane per extra parent', () => {
    const layout = buildGitLogGraphLayout([
      c('o', 'p1', 'p2', 'p3'),
      c('p3', 'r'),
      c('p2', 'r'),
      c('p1', 'r'),
      c('r')
    ])
    expect(edges(layout.rows[0]!.outgoing)).toEqual(['0>0', '0>1', '0>2'])
    expect(layout.rows.map((row) => row.lane)).toEqual([0, 2, 1, 0, 0])
    expect(edges(layout.rows[4]!.incoming).sort()).toEqual(['0>0', '1>0', '2>0'])
    expect(layout.laneCount).toBe(3)
  })

  it('gives the checked-out commit the current-branch color', () => {
    const layout = buildGitLogGraphLayout([c('h', 'a'), c('a')], { headId: 'h' })
    expect(layout.rows[0]!.color).toBe(GIT_HISTORY_REF_COLOR)
    expect(layout.rows[1]!.color).toBe(GIT_HISTORY_REF_COLOR)
  })

  it('keeps open lanes continuous across pages: a longer page never changes earlier rows', () => {
    const all = [c('m', 'b', 's'), c('s', 'a'), c('b', 'a'), c('a', 'z'), c('z')]
    const firstPage = buildGitLogGraphLayout(all.slice(0, 2))
    const full = buildGitLogGraphLayout(all)
    // Open lanes are drawn down to the page edge.
    expect(edges(firstPage.rows[1]!.outgoing).sort()).toEqual(['0>0', '1>1'])
    expect(full.rows.slice(0, 2).map((row) => [row.lane, row.color, edges(row.incoming)])).toEqual(
      firstPage.rows.map((row) => [row.lane, row.color, edges(row.incoming)])
    )
    expect(lanes(all)).toEqual([0, 1, 0, 0, 0])
  })

  it('starts unrelated branch heads on the first free lane', () => {
    expect(lanes([c('x', 'xr'), c('y', 'yr'), c('xr'), c('yr')])).toEqual([0, 1, 0, 1])
  })
})
