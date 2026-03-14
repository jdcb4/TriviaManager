import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Copy, Search, RefreshCw, CheckCircle, Archive, ChevronDown, ChevronUp, AlertTriangle, ChevronsUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

interface DuplicatePair {
  aId: string
  aText: string
  bId: string
  bText: string
  score: number
  layer: 'exact' | 'normalized' | 'jaccard' | 'levenshtein'
  resolution: string | null
}

interface ScanResult {
  id: string
  status: 'running' | 'done' | 'failed' | 'cancelled'
  totalQuestions: number
  scannedCount: number
  results: { pairs: DuplicatePair[] } | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

const layerVariant: Record<string, string> = {
  exact: 'danger',
  normalized: 'danger',
  jaccard: 'warning',
  levenshtein: 'secondary',
}

const layerLabel: Record<string, string> = {
  exact: 'Exact',
  normalized: 'Near-exact',
  jaccard: 'High overlap',
  levenshtein: 'Similar text',
}

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label ?? 'Scanning questions…'}</span>
        <span>{value.toLocaleString()} / {max.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PairCard({
  pair,
  scanId,
  onResolved,
  forceExpanded,
}: {
  pair: DuplicatePair
  scanId: string
  onResolved: () => void
  forceExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(forceExpanded ?? false)

  const resolveMut = useMutation({
    mutationFn: (resolution: string) =>
      api.post('/api/admin/duplicates/resolve', {
        scanId,
        aId: pair.aId,
        bId: pair.bId,
        resolution,
      }),
    onSuccess: () => { onResolved(); toast.success('Pair resolved') },
    onError: () => toast.error('Failed to resolve pair'),
  })

  const resolved = pair.resolution !== null

  return (
    <div className={`border rounded-xl overflow-hidden transition-opacity ${resolved ? 'opacity-50' : ''}`}>
      {/* Summary row */}
      <div
        className="flex items-center gap-3 p-3 bg-white cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => !resolved && setExpanded(e => !e)}
      >
        <Badge variant={layerVariant[pair.layer] as any} className="shrink-0">
          {layerLabel[pair.layer]}
        </Badge>
        <span className="text-xs font-mono text-gray-400 shrink-0 w-12">
          {(pair.score * 100).toFixed(0)}%
        </span>
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
          <p className="text-xs text-gray-700 truncate" title={pair.aText}>{pair.aText}</p>
          <p className="text-xs text-gray-700 truncate" title={pair.bText}>{pair.bText}</p>
        </div>
        {resolved ? (
          <span className="text-xs text-gray-400 italic shrink-0">
            {pair.resolution === 'not_duplicate' ? 'Dismissed' : 'Archived'}
          </span>
        ) : (
          <button className="text-gray-400 hover:text-gray-600 shrink-0">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>

      {/* Expanded side-by-side comparison */}
      {expanded && !resolved && (
        <div className="border-t bg-gray-50">
          <div className="grid grid-cols-2 divide-x">
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question A</span>
                <Link to={`/admin/questions/${pair.aId}`} className="text-xs text-indigo-600 hover:underline">
                  Edit ↗
                </Link>
              </div>
              <p className="text-sm text-gray-900 leading-relaxed">{pair.aText}</p>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question B</span>
                <Link to={`/admin/questions/${pair.bId}`} className="text-xs text-indigo-600 hover:underline">
                  Edit ↗
                </Link>
              </div>
              <p className="text-sm text-gray-900 leading-relaxed">{pair.bText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3 border-t bg-white">
            <span className="text-xs text-gray-500 mr-1">Action:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveMut.mutate('not_duplicate')}
              loading={resolveMut.isPending}
            >
              <CheckCircle size={13} className="mr-1 text-green-600" />
              Not a Duplicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveMut.mutate('archive_b')}
              loading={resolveMut.isPending}
            >
              <Archive size={13} className="mr-1 text-orange-500" />
              Keep A, Archive B
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolveMut.mutate('archive_a')}
              loading={resolveMut.isPending}
            >
              <Archive size={13} className="mr-1 text-orange-500" />
              Keep B, Archive A
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Duplicates() {
  const qc = useQueryClient()
  const [showResolved, setShowResolved] = useState(false)
  const [expandAll, setExpandAll] = useState(false)

  // Fetch latest scan — keep cached indefinitely so navigation away and back
  // shows previous results immediately without losing work
  const { data: scan } = useQuery<ScanResult | null>({
    queryKey: ['duplicate-scan'],
    queryFn: () => api.get('/api/admin/duplicates/scan/latest').then(r => r.data),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 2000 : false,
  })

  const startMut = useMutation({
    mutationFn: () => api.post('/api/admin/duplicates/scan'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicate-scan'] })
      toast.success('Scan started')
    },
    onError: () => toast.error('Failed to start scan'),
  })

  const pairs = (scan?.results?.pairs ?? []) as DuplicatePair[]
  const unresolved = pairs.filter(p => p.resolution === null)
  const resolved = pairs.filter(p => p.resolution !== null)
  const displayed = showResolved ? pairs : unresolved

  const isRunning = scan?.status === 'running'

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-2">
        <Copy size={20} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Duplicate Detection</h1>
      </div>

      {/* Control panel */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-gray-600">
            {scan ? (
              scan.status === 'running' ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={14} className="animate-spin text-indigo-500" />
                  Scanning…
                </span>
              ) : scan.status === 'done' ? (
                <span>
                  Last scan: <strong>{pairs.length}</strong> pair{pairs.length !== 1 ? 's' : ''} found
                  {' · '}{new Date(scan.completedAt!).toLocaleString()}
                  {' · '}<span className="text-gray-400 text-xs">results saved</span>
                </span>
              ) : scan.status === 'failed' ? (
                <span className="text-red-600">Last scan failed: {scan.error}</span>
              ) : (
                <span className="text-gray-400">No scan results yet</span>
              )
            ) : (
              <span className="text-gray-400">No scans run yet</span>
            )}
          </div>
          <Button
            onClick={() => startMut.mutate()}
            loading={startMut.isPending || isRunning}
            disabled={isRunning}
          >
            <Search size={14} className="mr-1.5" />
            {isRunning ? 'Scanning…' : scan ? 'Rescan All' : 'Scan All Questions'}
          </Button>
        </div>

        {/* Scan progress bar (visible while running) */}
        {isRunning && scan && (
          <ProgressBar value={scan.scannedCount} max={scan.totalQuestions} />
        )}

        {/* Resolution progress (visible when done and there are pairs) */}
        {scan?.status === 'done' && pairs.length > 0 && (
          <ProgressBar
            value={resolved.length}
            max={pairs.length}
            label="Pairs reviewed"
          />
        )}

        {/* Algorithm info */}
        <div className="text-xs text-gray-400 border-t pt-3 space-y-0.5">
          <p>Detection runs 4 layers in order: exact hash → normalized match → Jaccard token overlap (≥70%) → Levenshtein edit distance (≥80%, only when Jaccard ≥40% and text &lt;200 chars).</p>
          <p>Each unique pair is checked exactly once — Levenshtein only runs on "suspicious" pairs, keeping bulk scans fast.</p>
        </div>
      </div>

      {/* Results */}
      {scan?.status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-800">
                {unresolved.length} unresolved pair{unresolved.length !== 1 ? 's' : ''}
              </h2>
              {resolved.length > 0 && (
                <button
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => setShowResolved(s => !s)}
                >
                  {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
                </button>
              )}
            </div>
            {unresolved.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-500" />
                  Click a row to compare side-by-side
                </span>
                <button
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  onClick={() => setExpandAll(e => !e)}
                >
                  <ChevronsUpDown size={12} />
                  {expandAll ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
            )}
          </div>

          {displayed.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bg-white border rounded-xl">
              <CheckCircle size={28} className="mx-auto mb-2 text-green-400" />
              {pairs.length === 0 ? 'No duplicate pairs found' : 'All pairs resolved'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map((pair, i) => (
                <PairCard
                  key={`${pair.aId}-${pair.bId}-${i}`}
                  pair={pair}
                  scanId={scan.id}
                  forceExpanded={expandAll && pair.resolution === null}
                  onResolved={() => qc.invalidateQueries({ queryKey: ['duplicate-scan'] })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single-question check */}
      <SingleCheck />
    </div>
  )
}

function SingleCheck() {
  const [questionId, setQuestionId] = useState('')

  const scanMut = useMutation({
    mutationFn: (id: string) =>
      api.get(`/api/admin/questions/${id}/duplicates`).then(r => r.data),
    onError: () => toast.error('Scan failed — check the question ID'),
  })

  const layerVariantLocal: Record<string, string> = {
    exact: 'danger', normalized: 'danger', jaccard: 'warning', levenshtein: 'secondary',
  }

  return (
    <div className="bg-white border rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Check a Single Question</h2>
      <div className="flex gap-2">
        <Input
          value={questionId}
          onChange={e => setQuestionId(e.target.value)}
          placeholder="Paste a question ID…"
          className="flex-1"
        />
        <Button
          onClick={() => scanMut.mutate(questionId)}
          loading={scanMut.isPending}
          disabled={!questionId.trim()}
        >
          <Search size={14} className="mr-1" />Scan
        </Button>
      </div>
      {scanMut.data && (
        scanMut.data.length === 0 ? (
          <p className="text-sm text-green-600">✓ No duplicates found</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">{scanMut.data.length} potential duplicate(s):</p>
            {scanMut.data.map((m: any) => (
              <div key={m.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                <Badge variant={layerVariantLocal[m.layer] as any}>{m.layer}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 line-clamp-2">{m.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Score: {(m.score * 100).toFixed(0)}%</p>
                </div>
                <Link to={`/admin/questions/${m.id}`} className="text-xs text-indigo-600 hover:underline shrink-0">
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
