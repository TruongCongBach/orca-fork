import { describe, expect, it } from 'vitest'
import {
  applyGitLogCollapsedFragments,
  findGitLogLinearFragments,
  fragmentForLaneTarget,
  fragmentHidingCommit
} from './git-log-graph-collapse'
import { buildGitLogGraphLayout, type GitLogGraphCommit } from './git-log-graph-layout'

const c = (id: string, ...parentIds: string[]): GitLogGraphCommit => ({ id, parentIds })

function fragmentsOf(commits: GitLogGraphCommit[]) {
  return findGitLogLinearFragments(commits, buildGitLogGraphLayout(commits))
}

// main: m - b - a ; side branch s4..s1 forked from a, merged by m.
const oneMerge = [
  c('m', 'b', 's4'),
  c('s4', 's3'),
  c('s3', 's2'),
  c('b', 'a'),
  c('s2', 's1'),
  c('s1', 'a'),
  c('a')
]

describe('linear fragments', () => {
  it('finds the merged side branch; merges and fork points split the main line', () => {
    expect(fragmentsOf(oneMerge)).toEqual([{ id: 's4', commitIds: ['s4', 's3', 's2', 's1'] }])
  })

  it('collapses runs on the main (first-parent) line too', () => {
    const linear = [c('d', 'c'), c('c', 'b'), c('b', 'a'), c('a')]
    expect(fragmentsOf(linear)).toEqual([{ id: 'd', commitIds: ['d', 'c', 'b', 'a'] }])
  })

  it('requires at least three commits so at least one is hidden', () => {
    const short = [c('m', 'b', 's2'), c('s2', 's1'), c('b', 'a'), c('s1', 'a'), c('a')]
    expect(fragmentsOf(short)).toEqual([])
    expect(fragmentsOf([c('b', 'a'), c('a')])).toEqual([])
  })

  it('splits nested branches at the inner fork and merge points', () => {
    // Outer side branch o5..o1 off main; inner branch i3..i1 forks from o2 and merges into o4.
    const nested = [
      c('m', 'b', 'o5'),
      c('o5', 'o4'),
      c('o4', 'o3', 'i3'),
      c('i3', 'i2'),
      c('o3', 'o2'),
      c('i2', 'i1'),
      c('i1', 'o2'),
      c('o2', 'o1'),
      c('b', 'a'),
      c('o1', 'a'),
      c('a')
    ]
    // o4 is a merge (2 parents) and o2 has two children, so neither can be an inner link.
    expect(fragmentsOf(nested)).toEqual([{ id: 'i3', commitIds: ['i3', 'i2', 'i1'] }])
  })

  it('keeps the fragment id (its top commit) when the next page extends the run', () => {
    const all = [c('f', 'e'), c('e', 'd'), c('d', 'c'), c('c', 'b'), c('b', 'a'), c('a')]
    const firstPage = fragmentsOf(all.slice(0, 4))
    expect(firstPage).toEqual([{ id: 'f', commitIds: ['f', 'e', 'd', 'c'] }])
    expect(fragmentsOf(all)).toEqual([{ id: 'f', commitIds: ['f', 'e', 'd', 'c', 'b', 'a'] }])
  })
})

describe('collapse / expand', () => {
  it('drops hidden commits without synthetic rows and links top -> bottom directly', () => {
    const fragments = fragmentsOf(oneMerge)
    const { rows, graphCommits, collapsedEdgeTargets } = applyGitLogCollapsedFragments(
      oneMerge,
      fragments,
      new Set(['s4'])
    )
    expect(rows.map((row) => row.id)).toEqual(['m', 's4', 'b', 's1', 'a'])
    expect(graphCommits.find((commit) => commit.id === 's4')!.parentIds).toEqual(['s1'])
    expect(collapsedEdgeTargets).toEqual(new Map([['s1', 's4']]))
    // The bottom stays on the fragment's lane and the only edge into it is the collapsed one.
    const layout = buildGitLogGraphLayout(graphCommits)
    const lane = (id: string) => layout.rows.find((row) => row.id === id)!.lane
    expect(lane('s1')).toBe(lane('s4'))
    const intoBottom = layout.rows.flatMap((row) =>
      row.incoming.filter((edge) => edge.target === 's1')
    )
    expect(intoBottom.every((edge) => edge.from === lane('s4') && edge.to === lane('s4'))).toBe(
      true
    )
  })

  it('hides exactly one commit of a three-commit run', () => {
    const run = [c('c', 'b'), c('b', 'a'), c('a')]
    const { rows, graphCommits } = applyGitLogCollapsedFragments(
      run,
      fragmentsOf(run),
      new Set(['c'])
    )
    expect(rows.map((row) => row.id)).toEqual(['c', 'a'])
    expect(graphCommits).toEqual([c('c', 'a'), c('a')])
  })

  it('restores exactly the original layout when expanded again', () => {
    const original = buildGitLogGraphLayout(oneMerge)
    const expanded = applyGitLogCollapsedFragments(oneMerge, fragmentsOf(oneMerge), new Set())
    expect(buildGitLogGraphLayout(expanded.graphCommits)).toEqual(original)
    expect(expanded.rows).toEqual(oneMerge)
    expect(expanded.collapsedEdgeTargets.size).toBe(0)
  })

  it('maps lane segments inside the run and a hidden selection back to the fragment', () => {
    const fragments = fragmentsOf(oneMerge)
    // Segment into the first hidden commit and into the bottom belong to the run.
    expect(fragmentForLaneTarget(fragments, 's3')).toBe('s4')
    expect(fragmentForLaneTarget(fragments, 's1')).toBe('s4')
    // The merge-in diagonal above the run's top belongs to the merge, not to the run.
    expect(fragmentForLaneTarget(fragments, 's4')).toBeNull()
    expect(fragmentHidingCommit(fragments, new Set(['s4']), 's3')).toBe('s4')
    expect(fragmentHidingCommit(fragments, new Set(['s4']), 's1')).toBeNull()
    expect(fragmentHidingCommit(fragments, new Set(), 's3')).toBeNull()
  })
})
