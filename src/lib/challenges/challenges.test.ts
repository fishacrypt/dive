import { describe, expect, it } from 'vitest'
import { evaluateSolution } from './evaluate'
import { generateChallenge } from './generate'
import { dijkstra, kruskal } from './graph'
import { createRng } from './rng'
import { chromaticNumber, knapsackOptimal, solveOptimally } from './solvers'
import { CHALLENGE_TYPES } from '../game/types'
import type { ColoringPayload, KnapsackPayload, PathPayload, TreePayload } from './types'

const SIZES = { PATH: 9, COLORING: 9, KNAPSACK: 10, SPANNING_TREE: 9 } as const

describe('rng and generation determinism', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a.next(), a.next(), a.int(1, 100)]).toEqual([b.next(), b.next(), b.int(1, 100)])
  })

  it.each(CHALLENGE_TYPES)('%s: same seed gives an identical puzzle, different seeds differ', (type) => {
    const one = generateChallenge(type, 777, SIZES[type])
    expect(generateChallenge(type, 777, SIZES[type])).toEqual(one)
    expect(generateChallenge(type, 778, SIZES[type])).not.toEqual(one)
  })
})

describe('the optimal solver always produces a valid, optimal solution', () => {
  for (const type of CHALLENGE_TYPES) {
    it(`${type} across 25 seeds`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const payload = generateChallenge(type, seed, SIZES[type])
        const result = evaluateSolution(payload, solveOptimally(payload))
        expect(result.valid, `seed ${seed}: ${result.reason ?? ''}`).toBe(true)
        expect(result.optimal, `seed ${seed}`).toBe(true)
      }
    })
  }
})

describe('PATH (shortest path)', () => {
  const p = generateChallenge('PATH', 5, 9) as PathPayload
  const best = dijkstra(p.nodes.length, p.edges, p.start, p.end)

  it('accepts the shortest route and marks it optimal', () => {
    const r = evaluateSolution(p, { type: 'PATH', path: best?.path ?? [] })
    expect(r).toMatchObject({ valid: true, optimal: true })
  })

  it('rejects routes with the wrong endpoints, repeated nodes, or missing links', () => {
    expect(evaluateSolution(p, { type: 'PATH', path: [p.start] }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'PATH', path: [p.end, p.start] }).valid).toBe(false)
    const [s, , ...rest] = best?.path ?? []
    expect(evaluateSolution(p, { type: 'PATH', path: [s, ...rest] }).reason).toMatch(/no link|finish|begin/i)
    const dup = [...(best?.path ?? []), p.start]
    expect(evaluateSolution(p, { type: 'PATH', path: dup }).valid).toBe(false)
  })

  it('rejects routes over the latency budget', () => {
    const tight: PathPayload = { ...p, budget: (best?.cost ?? 1) - 1 }
    expect(evaluateSolution(tight, { type: 'PATH', path: best?.path ?? [] }).reason).toMatch(/budget/)
  })

  it('accepts a longer route inside the budget but does not call it optimal', () => {
    const loose: PathPayload = { ...p, budget: 10_000 }
    // Find any simple path that is not the shortest by trying direct neighbours of start.
    const alt = findAlternativePath(loose, best?.cost ?? 0)
    if (alt) {
      const r = evaluateSolution(loose, { type: 'PATH', path: alt })
      expect(r.valid).toBe(true)
      expect(r.optimal).toBe(false)
    }
  })
})

function findAlternativePath(p: PathPayload, bestCost: number): number[] | null {
  const adj = new Map<number, Array<{ to: number; w: number }>>()
  for (const e of p.edges) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), { to: e.b, w: e.w }])
    adj.set(e.b, [...(adj.get(e.b) ?? []), { to: e.a, w: e.w }])
  }
  let found: number[] | null = null
  const walk = (node: number, path: number[], cost: number): void => {
    if (found) return
    if (node === p.end) {
      if (cost > bestCost) found = [...path]
      return
    }
    for (const { to, w } of adj.get(node) ?? []) {
      if (!path.includes(to)) walk(to, [...path, to], cost + w)
    }
  }
  walk(p.start, [p.start], 0)
  return found
}

describe('COLORING (constraint satisfaction)', () => {
  const p = generateChallenge('COLORING', 9, 10) as ColoringPayload
  const chi = chromaticNumber(p.nodes.length, p.edges)

  it('is at least 3-chromatic by construction and gives players one spare colour', () => {
    expect(chi.k).toBeGreaterThanOrEqual(3)
    expect(p.colors).toBe(chi.k + 1)
  })

  it('accepts a proper colouring and rejects conflicts and out-of-range channels', () => {
    expect(evaluateSolution(p, { type: 'COLORING', colors: chi.colors })).toMatchObject({ valid: true, optimal: true })
    const first = p.edges[0]
    if (!first) throw new Error('no edges')
    const bad = chi.colors.slice()
    bad[first.b] = bad[first.a]
    expect(evaluateSolution(p, { type: 'COLORING', colors: bad }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'COLORING', colors: chi.colors.map(() => 99) }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'COLORING', colors: chi.colors.slice(1) }).valid).toBe(false)
  })

  it('accepts a wasteful but valid colouring without the optimal bonus', () => {
    // Move one node out of a shared colour class onto the spare colour: still proper, one colour more.
    const colors = chi.colors.slice()
    const idx = colors.findIndex((c) => colors.filter((x) => x === c).length > 1)
    expect(idx).toBeGreaterThanOrEqual(0)
    colors[idx] = p.colors - 1
    const r = evaluateSolution(p, { type: 'COLORING', colors })
    expect(r.valid).toBe(true)
    expect(r.optimal).toBe(false)
  })
})

describe('KNAPSACK (resource allocation)', () => {
  const p = generateChallenge('KNAPSACK', 3, 12) as KnapsackPayload
  const best = knapsackOptimal(p)

  it('finds the true optimum (verified against brute force on a small instance)', () => {
    const small = generateChallenge('KNAPSACK', 11, 10) as KnapsackPayload
    let bruteBest = 0
    for (let mask = 0; mask < 1 << small.items.length; mask++) {
      let w = 0
      let v = 0
      small.items.forEach((item, i) => {
        if (mask & (1 << i)) {
          w += item.weight
          v += item.value
        }
      })
      if (w <= small.capacity) bruteBest = Math.max(bruteBest, v)
    }
    expect(knapsackOptimal(small).value).toBe(bruteBest)
  })

  it('accepts the optimum and rejects overweight, duplicate, unknown and under-target picks', () => {
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: best.selected })).toMatchObject({ valid: true, optimal: true })
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: p.items.map((i) => i.id) }).reason).toMatch(/capacity/)
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: [0, 0] }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: [9999] }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: [] }).reason).toMatch(/target/)
  })

  it('target sits below the optimum so near-optimal answers are valid but not optimal', () => {
    expect(p.target).toBeLessThan(best.value)
    // Drop the most valuable chosen item: lower value, still fits. May fall below target, so only assert when valid.
    const sorted = [...best.selected].sort((a, b) => (p.items[a]?.value ?? 0) - (p.items[b]?.value ?? 0))
    const lighter = sorted.slice(1)
    const r = evaluateSolution(p, { type: 'KNAPSACK', selected: lighter })
    if (r.valid) expect(r.optimal).toBe(false)
  })
})

describe('SPANNING_TREE (network design)', () => {
  const p = generateChallenge('SPANNING_TREE', 4, 9) as TreePayload
  const mst = kruskal(p.nodes.length, p.edges)

  it('accepts the minimum spanning tree as optimal', () => {
    expect(evaluateSolution(p, { type: 'SPANNING_TREE', edges: mst.edgeIndexes })).toMatchObject({ valid: true, optimal: true })
  })

  it('rejects wrong edge counts, loops, duplicates and unknown cables', () => {
    expect(evaluateSolution(p, { type: 'SPANNING_TREE', edges: mst.edgeIndexes.slice(1) }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'SPANNING_TREE', edges: [...mst.edgeIndexes.slice(1), mst.edgeIndexes[0], mst.edgeIndexes[0]] }).valid).toBe(false)
    expect(evaluateSolution(p, { type: 'SPANNING_TREE', edges: [...mst.edgeIndexes.slice(1), 9999] }).valid).toBe(false)
    // n-1 edges that contain a cycle (and therefore do not connect everything).
    const cyc = findCycleSelection(p)
    if (cyc) expect(evaluateSolution(p, { type: 'SPANNING_TREE', edges: cyc }).reason).toMatch(/loop/)
  })

  it('rejects trees over budget', () => {
    expect(evaluateSolution({ ...p, budget: mst.total - 1 }, { type: 'SPANNING_TREE', edges: mst.edgeIndexes }).reason).toMatch(/budget/)
  })
})

function findCycleSelection(p: TreePayload): number[] | null {
  // Triangle: find three nodes pairwise connected, then pad with other edges up to n-1.
  const idx = (a: number, b: number) => p.edges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
  for (const e1 of p.edges) {
    for (const e2 of p.edges) {
      if (e1 === e2 || e1.b !== e2.a) continue
      const closing = idx(e1.a, e2.b)
      if (closing >= 0) {
        const tri = [idx(e1.a, e1.b), idx(e2.a, e2.b), closing]
        const pad = p.edges.map((_, i) => i).filter((i) => !tri.includes(i)).slice(0, p.nodes.length - 1 - 3)
        return [...tri, ...pad]
      }
    }
  }
  return null
}

describe('type mismatch', () => {
  it('rejects a solution of the wrong type', () => {
    const p = generateChallenge('PATH', 1, 8)
    expect(evaluateSolution(p, { type: 'KNAPSACK', selected: [] }).valid).toBe(false)
  })
})
