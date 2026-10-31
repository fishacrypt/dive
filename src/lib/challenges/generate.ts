import { buildGeometricEdges, dijkstra, kruskal, scatterNodes } from './graph'
import { createRng } from './rng'
import { chromaticNumber, knapsackOptimal } from './solvers'
import type { ChallengePayload, ColoringPayload, GraphEdge, KnapsackPayload, PathPayload, TreePayload } from './types'
import type { ChallengeType } from '../game/types'

/** Latency / cable budgets are this much looser than the optimum. */
const PATH_SLACK = 1.3
const TREE_SLACK = 1.15
/** Knapsack target is this fraction of the optimum. */
const KNAPSACK_TARGET = 0.85

function generatePath(seed: number, size: number): PathPayload {
  const rng = createRng(seed)
  const nodes = scatterNodes(rng, size)
  const edges = buildGeometricEdges(rng, nodes, 2)
  const sorted = [...nodes].sort((a, b) => a.x - b.x || a.id - b.id)
  const start = (sorted[0] ?? nodes[0]).id
  const end = (sorted[sorted.length - 1] ?? nodes[nodes.length - 1]).id
  const best = dijkstra(nodes.length, edges, start, end)
  const optimum = best?.cost ?? 1
  return { type: 'PATH', nodes, edges, start, end, budget: Math.ceil(optimum * PATH_SLACK) }
}

function generateColoring(seed: number, size: number): ColoringPayload {
  const rng = createRng(seed)
  const nodes = scatterNodes(rng, size, 13)
  const planted = Math.min(4, Math.max(3, Math.floor(size / 3)))
  const classes = nodes.map((_, i) => (i < planted ? i : rng.int(0, planted - 1)))
  const candidates = buildGeometricEdges(rng, nodes, 3)
  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  const addEdge = (a: number, b: number): void => {
    if (a === b || classes[a] === classes[b]) return
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ a: Math.min(a, b), b: Math.max(a, b), w: 1 })
  }
  for (const e of candidates) addEdge(e.a, e.b)
  // Random cross-class chords make the mesh denser (and the puzzle harder).
  for (let i = 0; i < size; i++) addEdge(rng.int(0, size - 1), rng.int(0, size - 1))
  // A guaranteed triangle forces at least 3 colours so puzzles are never trivial.
  addEdge(0, 1)
  addEdge(1, 2)
  addEdge(0, 2)
  const chi = chromaticNumber(nodes.length, edges).k
  return { type: 'COLORING', nodes, edges, colors: chi + 1 }
}

function generateKnapsack(seed: number, size: number): KnapsackPayload {
  const rng = createRng(seed)
  const items = Array.from({ length: size }, (_, id) => ({
    id,
    name: `Batch ${String.fromCharCode(65 + (id % 26))}${Math.floor(id / 26) + 1}`,
    weight: rng.int(3, 22),
    value: rng.int(8, 64),
  }))
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  const capacity = Math.max(10, Math.floor(totalWeight * 0.4))
  const draft: KnapsackPayload = { type: 'KNAPSACK', items, capacity, target: 0 }
  const optimum = knapsackOptimal(draft).value
  return { ...draft, target: Math.floor(optimum * KNAPSACK_TARGET) }
}

function generateTree(seed: number, size: number): TreePayload {
  const rng = createRng(seed)
  const nodes = scatterNodes(rng, size)
  const edges = buildGeometricEdges(rng, nodes, 3)
  const mst = kruskal(nodes.length, edges).total
  return { type: 'SPANNING_TREE', nodes, edges, budget: Math.ceil(mst * TREE_SLACK) }
}

/** Deterministically generate the public puzzle for (type, seed, size). */
export function generateChallenge(type: ChallengeType, seed: number, size: number): ChallengePayload {
  switch (type) {
    case 'PATH':
      return generatePath(seed, size)
    case 'COLORING':
      return generateColoring(seed, size)
    case 'KNAPSACK':
      return generateKnapsack(seed, size)
    case 'SPANNING_TREE':
      return generateTree(seed, size)
  }
}
