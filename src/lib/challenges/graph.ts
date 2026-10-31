import type { Rng } from './rng'
import type { GraphEdge, GraphNode } from './types'

export function dist(a: GraphNode, b: GraphNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Scatter `n` nodes in a 100x100 box, keeping them at least `minDist` apart. */
export function scatterNodes(rng: Rng, n: number, minDist = 15): GraphNode[] {
  const nodes: GraphNode[] = []
  let attempts = 0
  let gap = minDist
  while (nodes.length < n) {
    const candidate: GraphNode = { id: nodes.length, x: rng.int(8, 92), y: rng.int(8, 92) }
    if (nodes.every((other) => dist(candidate, other) >= gap)) nodes.push(candidate)
    attempts++
    if (attempts % 200 === 0) gap = Math.max(6, gap - 1)
  }
  return nodes
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/**
 * Build a connected geometric graph: a Euclidean spanning tree (guarantees
 * connectivity) plus each node's `nearest` closest neighbours.
 */
export function buildGeometricEdges(rng: Rng, nodes: GraphNode[], nearest: number): GraphEdge[] {
  const n = nodes.length
  const seen = new Set<string>()
  const pairs: Array<[number, number]> = []
  const add = (a: number, b: number): void => {
    if (a === b) return
    const key = edgeKey(a, b)
    if (seen.has(key)) return
    seen.add(key)
    pairs.push(a < b ? [a, b] : [b, a])
  }

  // Prim's algorithm over Euclidean distance.
  const inTree = new Set<number>([0])
  while (inTree.size < n) {
    let best: [number, number] | null = null
    let bestD = Infinity
    for (const a of inTree) {
      for (let b = 0; b < n; b++) {
        if (inTree.has(b)) continue
        const d = dist(nodes[a], nodes[b])
        if (d < bestD) {
          bestD = d
          best = [a, b]
        }
      }
    }
    if (!best) break
    add(best[0], best[1])
    inTree.add(best[1])
  }

  for (const node of nodes) {
    const sorted = nodes
      .filter((other) => other.id !== node.id)
      .sort((p, q) => dist(node, p) - dist(node, q) || p.id - q.id)
    for (const other of sorted.slice(0, nearest)) add(node.id, other.id)
  }

  return pairs.map(([a, b]) => {
    const d = dist(nodes[a], nodes[b])
    return { a, b, w: Math.max(1, Math.round(d / 6) + rng.int(0, 3)) }
  })
}

export function adjacency(n: number, edges: GraphEdge[]): Array<Array<{ to: number; w: number }>> {
  const adj: Array<Array<{ to: number; w: number }>> = Array.from({ length: n }, () => [])
  for (const e of edges) {
    adj[e.a]?.push({ to: e.b, w: e.w })
    adj[e.b]?.push({ to: e.a, w: e.w })
  }
  return adj
}

/** Dijkstra shortest path (O(n^2), plenty for puzzle sizes). */
export function dijkstra(n: number, edges: GraphEdge[], start: number, end: number): { cost: number; path: number[] } | null {
  const adj = adjacency(n, edges)
  const best = new Array<number>(n).fill(Infinity)
  const prev = new Array<number>(n).fill(-1)
  const done = new Array<boolean>(n).fill(false)
  best[start] = 0
  for (let i = 0; i < n; i++) {
    let u = -1
    for (let v = 0; v < n; v++) {
      if (!done[v] && (u === -1 || (best[v]) < (best[u]))) u = v
    }
    if (u === -1 || best[u] === Infinity) break
    done[u] = true
    for (const { to, w } of adj[u] ?? []) {
      const alt = (best[u]) + w
      if (alt < (best[to])) {
        best[to] = alt
        prev[to] = u
      }
    }
  }
  if (best[end] === Infinity) return null
  const path: number[] = []
  for (let at = end; at !== -1; at = prev[at]) path.push(at)
  path.reverse()
  return { cost: best[end], path }
}

export class UnionFind {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(x: number): number {
    let root = x
    while (this.parent[root] !== root) root = this.parent[root]
    let cur = x
    while (this.parent[cur] !== root) {
      const next = this.parent[cur]
      this.parent[cur] = root
      cur = next
    }
    return root
  }
  /** Returns false when a and b were already connected. */
  union(a: number, b: number): boolean {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    this.parent[ra] = rb
    return true
  }
}

/** Kruskal minimum spanning tree. Returns chosen edge indices and total weight. */
export function kruskal(n: number, edges: GraphEdge[]): { total: number; edgeIndexes: number[] } {
  const order = edges.map((_, i) => i).sort((i, j) => (edges[i]).w - (edges[j]).w || i - j)
  const uf = new UnionFind(n)
  const chosen: number[] = []
  let total = 0
  for (const i of order) {
    const e = edges[i]
    if (uf.union(e.a, e.b)) {
      chosen.push(i)
      total += e.w
    }
  }
  return { total, edgeIndexes: chosen }
}
