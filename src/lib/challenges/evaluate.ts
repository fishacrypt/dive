import { dijkstra, kruskal, UnionFind } from './graph'
import { chromaticNumberOf, knapsackOptimal } from './solvers'
import type {
  ChallengePayload,
  ColoringPayload,
  EvaluationResult,
  KnapsackPayload,
  PathPayload,
  Solution,
  TreePayload,
} from './types'

const reject = (reason: string): EvaluationResult => ({ valid: false, optimal: false, summary: 'Rejected', reason })

function evaluatePath(p: PathPayload, path: number[]): EvaluationResult {
  if (path.length < 2) return reject('A route needs at least two nodes.')
  if (path[0] !== p.start) return reject('The route must begin at the start node.')
  if (path[path.length - 1] !== p.end) return reject('The route must finish at the destination node.')
  if (new Set(path).size !== path.length) return reject('The route visits a node more than once.')
  let cost = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const edge = p.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
    if (!edge) return reject(`There is no link between node ${a} and node ${b}.`)
    cost += edge.w
  }
  if (cost > p.budget) return reject(`Route latency ${cost} exceeds the budget of ${p.budget}.`)
  const best = dijkstra(p.nodes.length, p.edges, p.start, p.end)
  return { valid: true, optimal: best !== null && cost === best.cost, summary: `Latency ${cost} / budget ${p.budget}` }
}

function evaluateColoring(p: ColoringPayload, colors: number[]): EvaluationResult {
  if (colors.length !== p.nodes.length) return reject('Every relay needs a channel.')
  if (colors.some((c) => c < 0 || c >= p.colors)) return reject(`Channels must be between 0 and ${p.colors - 1}.`)
  for (const e of p.edges) {
    if (colors[e.a] === colors[e.b]) return reject(`Relays ${e.a} and ${e.b} are linked but share channel ${colors[e.a]}.`)
  }
  const used = new Set(colors).size
  return { valid: true, optimal: used === chromaticNumberOf(p), summary: `${used} channels used` }
}

function evaluateKnapsack(p: KnapsackPayload, selected: number[]): EvaluationResult {
  if (new Set(selected).size !== selected.length) return reject('A batch was selected twice.')
  let weight = 0
  let value = 0
  for (const id of selected) {
    const item = p.items.find((i) => i.id === id)
    if (!item) return reject(`Unknown batch ${id}.`)
    weight += item.weight
    value += item.value
  }
  if (weight > p.capacity) return reject(`Weight ${weight} exceeds capacity ${p.capacity}.`)
  if (value < p.target) return reject(`Value ${value} is below the target of ${p.target}.`)
  return { valid: true, optimal: value === knapsackOptimal(p).value, summary: `Value ${value} (target ${p.target}), weight ${weight}/${p.capacity}` }
}

function evaluateTree(p: TreePayload, edgeIndexes: number[]): EvaluationResult {
  if (new Set(edgeIndexes).size !== edgeIndexes.length) return reject('A cable was selected twice.')
  if (edgeIndexes.length !== p.nodes.length - 1) return reject(`A spanning tree needs exactly ${p.nodes.length - 1} cables.`)
  const uf = new UnionFind(p.nodes.length)
  let total = 0
  for (const i of edgeIndexes) {
    const e = p.edges[i]
    if (!e) return reject(`Unknown cable ${i}.`)
    if (!uf.union(e.a, e.b)) return reject('The cables contain a loop.')
    total += e.w
  }
  if (total > p.budget) return reject(`Cable cost ${total} exceeds the budget of ${p.budget}.`)
  return { valid: true, optimal: total === kruskal(p.nodes.length, p.edges).total, summary: `Cost ${total} / budget ${p.budget}` }
}

/** Validate a submitted solution against a server-generated payload. Never trusts the client. */
export function evaluateSolution(payload: ChallengePayload, solution: Solution): EvaluationResult {
  if (payload.type !== solution.type) return reject('Solution type does not match the challenge.')
  switch (payload.type) {
    case 'PATH':
      return solution.type === 'PATH' ? evaluatePath(payload, solution.path) : reject('Wrong solution type.')
    case 'COLORING':
      return solution.type === 'COLORING' ? evaluateColoring(payload, solution.colors) : reject('Wrong solution type.')
    case 'KNAPSACK':
      return solution.type === 'KNAPSACK' ? evaluateKnapsack(payload, solution.selected) : reject('Wrong solution type.')
    case 'SPANNING_TREE':
      return solution.type === 'SPANNING_TREE' ? evaluateTree(payload, solution.edges) : reject('Wrong solution type.')
  }
}
