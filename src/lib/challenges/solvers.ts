import { dijkstra, kruskal } from './graph'
import type { ChallengePayload, ColoringPayload, GraphEdge, KnapsackPayload, Solution } from './types'

/** Exact 0/1 knapsack by dynamic programming. */
export function knapsackOptimal(payload: KnapsackPayload): { value: number; selected: number[] } {
  const { items, capacity } = payload
  const n = items.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(capacity + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    const item = items[i - 1]
    if (!item) continue
    for (let c = 0; c <= capacity; c++) {
      const skip = (table[i - 1])[c]
      const take = item.weight <= c ? ((table[i - 1])[c - item.weight]) + item.value : -1
      ;(table[i])[c] = Math.max(skip, take)
    }
  }
  const selected: number[] = []
  let c = capacity
  for (let i = n; i >= 1; i--) {
    const item = items[i - 1]
    if (item && (table[i])[c] !== (table[i - 1])[c]) {
      selected.push(item.id)
      c -= item.weight
    }
  }
  return { value: (table[n])[capacity], selected: selected.sort((a, b) => a - b) }
}

function buildNeighbours(n: number, edges: GraphEdge[]): number[][] {
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const e of edges) {
    adj[e.a]?.push(e.b)
    adj[e.b]?.push(e.a)
  }
  return adj
}

/** Backtracking k-colouring. Returns an assignment or null when none exists. */
export function colorWith(n: number, edges: GraphEdge[], k: number): number[] | null {
  const adj = buildNeighbours(n, edges)
  // Colour high-degree vertices first: prunes the search dramatically.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (adj[b]).length - (adj[a]).length || a - b)
  const colors = new Array<number>(n).fill(-1)
  const place = (idx: number, used: number): boolean => {
    if (idx === n) return true
    const v = order[idx]
    // Symmetry breaking: never open more than one new colour at a time.
    const limit = Math.min(k, used + 1)
    for (let c = 0; c < limit; c++) {
      if ((adj[v]).some((u) => colors[u] === c)) continue
      colors[v] = c
      if (place(idx + 1, Math.max(used, c + 1))) return true
      colors[v] = -1
    }
    return false
  }
  return place(0, 0) ? colors : null
}

/** Chromatic number (smallest k with a valid colouring) plus one witness colouring. */
export function chromaticNumber(n: number, edges: GraphEdge[]): { k: number; colors: number[] } {
  for (let k = 1; k <= n; k++) {
    const colors = colorWith(n, edges, k)
    if (colors) return { k, colors }
  }
  return { k: n, colors: Array.from({ length: n }, (_, i) => i) }
}

export function chromaticNumberOf(payload: ColoringPayload): number {
  return chromaticNumber(payload.nodes.length, payload.edges).k
}

/** Produce a provably optimal solution for any payload (used by tests and tooling). */
export function solveOptimally(payload: ChallengePayload): Solution {
  switch (payload.type) {
    case 'PATH': {
      const result = dijkstra(payload.nodes.length, payload.edges, payload.start, payload.end)
      return { type: 'PATH', path: result?.path ?? [] }
    }
    case 'COLORING':
      return { type: 'COLORING', colors: chromaticNumber(payload.nodes.length, payload.edges).colors }
    case 'KNAPSACK':
      return { type: 'KNAPSACK', selected: knapsackOptimal(payload).selected }
    case 'SPANNING_TREE':
      return { type: 'SPANNING_TREE', edges: kruskal(payload.nodes.length, payload.edges).edgeIndexes }
  }
}
