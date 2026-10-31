'use client'
import * as React from 'react'
import { cn } from '@/lib/utils'
import type { ChallengePayload, GraphEdge, GraphNode, Solution } from '@/lib/challenges/types'

export const CHANNEL_COLORS = ['#22d3ee', '#a78bfa', '#4ade80', '#fbbf24', '#fb7185']

/** Empty starting solution for a payload. */
export function initialSolution(payload: ChallengePayload): Solution {
  switch (payload.type) {
    case 'PATH':
      return { type: 'PATH', path: [payload.start] }
    case 'COLORING':
      return { type: 'COLORING', colors: payload.nodes.map(() => -1) }
    case 'KNAPSACK':
      return { type: 'KNAPSACK', selected: [] }
    case 'SPANNING_TREE':
      return { type: 'SPANNING_TREE', edges: [] }
  }
}

interface GraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  showWeights: boolean
  nodeFill: (n: GraphNode) => string
  nodeRing?: (n: GraphNode) => boolean
  nodeLabel?: (n: GraphNode) => string
  edgeActive: (e: GraphEdge, index: number) => boolean
  onNode?: (n: GraphNode) => void
  onEdge?: (e: GraphEdge, index: number) => void
}

function GraphSvg({ nodes, edges, showWeights, nodeFill, nodeRing, nodeLabel, edgeActive, onNode, onEdge }: GraphProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return (
    <svg viewBox="0 0 100 100" className="aspect-square w-full max-w-[520px] rounded-xl border border-ink-600 bg-ink-900" role="group" aria-label="Puzzle graph">
      {edges.map((e, i) => {
        const a = byId.get(e.a)
        const b = byId.get(e.b)
        if (!a || !b) return null
        const active = edgeActive(e, i)
        return (
          <g key={`${e.a}-${e.b}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? '#22d3ee' : '#363e4c'} strokeWidth={active ? 1.4 : 0.7} />
            {onEdge ? (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={5}
                className="cursor-pointer"
                onClick={() => onEdge(e, i)}
                role="button"
                aria-label={`Cable ${e.a} to ${e.b}, cost ${e.w}${active ? ', selected' : ''}`}
                data-testid={`edge-${i}`}
              />
            ) : null}
            {showWeights ? (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1} fontSize="3.2" textAnchor="middle" fill={active ? '#22d3ee' : '#6f7a8d'} className="pointer-events-none select-none">
                {e.w}
              </text>
            ) : null}
          </g>
        )
      })}
      {nodes.map((n) => (
        <g
          key={n.id}
          onClick={() => onNode?.(n)}
          className={onNode ? 'cursor-pointer' : undefined}
          role={onNode ? 'button' : undefined}
          aria-label={`Node ${n.id}`}
          data-testid={`node-${n.id}`}
        >
          {nodeRing?.(n) ? <circle cx={n.x} cy={n.y} r={5.4} fill="none" stroke="#e8ecf2" strokeWidth={0.6} strokeDasharray="1.5 1" /> : null}
          <circle cx={n.x} cy={n.y} r={4} fill={nodeFill(n)} stroke="#0b0d10" strokeWidth={0.8} />
          <text x={n.x} y={n.y + 1.2} fontSize="3.4" textAnchor="middle" fill="#0b0d10" fontWeight="700" className="pointer-events-none select-none">
            {nodeLabel ? nodeLabel(n) : n.id}
          </text>
        </g>
      ))}
    </svg>
  )
}

interface BoardProps {
  payload: ChallengePayload
  solution: Solution
  onChange: (s: Solution) => void
  disabled?: boolean
}

export function PuzzleBoard({ payload, solution, onChange, disabled }: BoardProps) {
  if (payload.type === 'PATH' && solution.type === 'PATH') {
    const path = solution.path
    const last = path[path.length - 1]
    const inPath = new Set(path)
    const adjacent = (a: number, b: number) => payload.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))
    const cost = path.slice(1).reduce((sum, id, i) => {
      const prev = path[i]
      const edge = payload.edges.find((e) => (e.a === prev && e.b === id) || (e.a === id && e.b === prev))
      return sum + (edge?.w ?? 0)
    }, 0)
    const click = (n: GraphNode) => {
      if (disabled) return
      if (n.id === last && path.length > 1) onChange({ type: 'PATH', path: path.slice(0, -1) })
      else if (last !== undefined && !inPath.has(n.id) && adjacent(last, n.id)) onChange({ type: 'PATH', path: [...path, n.id] })
    }
    const onPathEdge = (e: GraphEdge) => {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]
        const b = path[i + 1]
        if ((a === e.a && b === e.b) || (a === e.b && b === e.a)) return true
      }
      return false
    }
    return (
      <div className="space-y-2">
        <GraphSvg
          nodes={payload.nodes}
          edges={payload.edges}
          showWeights
          nodeFill={(n) => (n.id === payload.start ? '#4ade80' : n.id === payload.end ? '#fb7185' : inPath.has(n.id) ? '#22d3ee' : '#aab3c2')}
          nodeRing={(n) => n.id === last}
          edgeActive={(e) => onPathEdge(e)}
          onNode={click}
        />
        <p className="text-sm text-fog-300">
          Click neighbouring nodes to extend the route from the <span className="text-mint-dive">green start</span> to the <span className="text-rose-dive">red destination</span>. Click the end of your route to undo.
        </p>
        <p className="text-sm tabular-nums text-fog-100" data-testid="board-score">
          Latency {cost} / budget {payload.budget}
        </p>
      </div>
    )
  }

  if (payload.type === 'COLORING' && solution.type === 'COLORING') {
    const colors = solution.colors
    const conflicts = new Set<number>()
    for (const e of payload.edges) {
      if (colors[e.a] !== -1 && colors[e.a] === colors[e.b]) {
        conflicts.add(e.a)
        conflicts.add(e.b)
      }
    }
    const click = (n: GraphNode) => {
      if (disabled) return
      const next = colors.slice()
      const cur = next[n.id] ?? -1
      next[n.id] = cur + 1 >= payload.colors ? -1 : cur + 1
      onChange({ type: 'COLORING', colors: next })
    }
    return (
      <div className="space-y-2">
        <GraphSvg
          nodes={payload.nodes}
          edges={payload.edges}
          showWeights={false}
          nodeFill={(n) => ((colors[n.id] ?? -1) === -1 ? '#363e4c' : (CHANNEL_COLORS[colors[n.id]] ?? '#fff'))}
          nodeRing={(n) => conflicts.has(n.id)}
          nodeLabel={(n) => ((colors[n.id] ?? -1) === -1 ? '' : String(colors[n.id]))}
          edgeActive={(e) => colors[e.a] !== -1 && colors[e.a] === colors[e.b]}
          onNode={click}
        />
        <p className="text-sm text-fog-300">
          Click a relay to cycle its channel (0 to {payload.colors - 1}). Linked relays must differ. Fewer channels earns a bonus. Dashed rings mark conflicts.
        </p>
        <div className="flex gap-2">
          {Array.from({ length: payload.colors }, (_, c) => (
            <span key={c} className="flex items-center gap-1 text-xs text-fog-300">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: CHANNEL_COLORS[c] }} /> {c}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (payload.type === 'SPANNING_TREE' && solution.type === 'SPANNING_TREE') {
    const chosen = new Set(solution.edges)
    const total = solution.edges.reduce((sum, i) => sum + (payload.edges[i]?.w ?? 0), 0)
    const toggle = (_e: GraphEdge, i: number) => {
      if (disabled) return
      const next = new Set(chosen)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      onChange({ type: 'SPANNING_TREE', edges: [...next].sort((a, b) => a - b) })
    }
    return (
      <div className="space-y-2">
        <GraphSvg nodes={payload.nodes} edges={payload.edges} showWeights nodeFill={() => '#aab3c2'} edgeActive={(_e, i) => chosen.has(i)} onEdge={toggle} />
        <p className="text-sm text-fog-300">Click cables to select them. Connect all {payload.nodes.length} nodes with exactly {payload.nodes.length - 1} cables and no loops.</p>
        <p className="text-sm tabular-nums text-fog-100" data-testid="board-score">
          {chosen.size}/{payload.nodes.length - 1} cables · cost {total} / budget {payload.budget}
        </p>
      </div>
    )
  }

  if (payload.type === 'KNAPSACK' && solution.type === 'KNAPSACK') {
    const chosen = new Set(solution.selected)
    const weight = payload.items.filter((i) => chosen.has(i.id)).reduce((s, i) => s + i.weight, 0)
    const value = payload.items.filter((i) => chosen.has(i.id)).reduce((s, i) => s + i.value, 0)
    const toggle = (id: number) => {
      if (disabled) return
      const next = new Set(chosen)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onChange({ type: 'KNAPSACK', selected: [...next].sort((a, b) => a - b) })
    }
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {payload.items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={chosen.has(item.id)}
              onClick={() => toggle(item.id)}
              data-testid={`item-${item.id}`}
              className={cn(
                'min-h-[56px] rounded-lg border p-2 text-left text-sm transition-colors',
                chosen.has(item.id) ? 'border-cyan-dive/70 bg-cyan-dive/10' : 'border-ink-500 bg-ink-900 hover:bg-ink-700',
              )}
            >
              <span className="block font-medium text-fog-100">{item.name}</span>
              <span className="text-xs tabular-nums text-fog-300">
                weight {item.weight} · value {item.value}
              </span>
            </button>
          ))}
        </div>
        <p className={cn('text-sm tabular-nums', weight > payload.capacity ? 'text-rose-dive' : 'text-fog-100')} data-testid="board-score">
          Weight {weight} / {payload.capacity} · Value {value} (target {payload.target})
        </p>
      </div>
    )
  }
  return null
}
