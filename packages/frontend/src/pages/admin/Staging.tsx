import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type StagedQuestion } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, Textarea } from '@/components/ui/input'
import { Check, X, ChevronDown, ChevronUp, CheckCheck, XSquare } from 'lucide-react'
import { CATEGORIES } from '@/lib/categories'
import toast from 'react-hot-toast'

function StagedCard({ item, onApprove, onReject, onUpdateData }: {
  item: StagedQuestion
  onApprove: (id: string, notes: string) => void
  onReject: (id: string, notes: string) => void
  onUpdateData: (id: string, data: any) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState('')
  const [localData, setLocalData] = useState<any>(item.data)

  function updateField(field: string, value: string) {
    const updated = { ...localData, [field]: value }
    setLocalData(updated)
    onUpdateData(item.id, updated)
  }

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={item.source === 'ai_generated' ? 'default' : 'secondary'}>
              {item.source ?? 'manual'}
            </Badge>
            {item.questionId && <Badge variant="warning">Edit to existing</Badge>}
            <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm font-medium text-gray-900">{localData.text}</p>
          {localData.answers?.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {localData.answers.filter((a: any) => a.isCorrect).map((a: any) => a.text).join(' · ')}
            </p>
          )}
          <div className="flex gap-2 mt-2">
            <Select
              value={localData.difficulty ?? ''}
              onChange={e => updateField('difficulty', e.target.value)}
              className="w-28 text-xs py-1"
            >
              <option value="">Difficulty</option>
              {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Select
              value={localData.category ?? ''}
              onChange={e => updateField('category', e.target.value)}
              className="w-44 text-xs py-1"
            >
              <option value="">Category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-600 mt-1 shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="text-xs space-y-2 bg-gray-50 rounded p-3">
          {Object.entries(localData).map(([k, v]) =>
            k !== 'answers' && k !== 'difficulty' && k !== 'category' && v ? (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 w-24 shrink-0">{k}</span>
                <span className="text-gray-800">{String(v)}</span>
              </div>
            ) : null
          )}
          {localData.answers && (
            <div>
              <span className="text-gray-500">answers</span>
              <ul className="mt-1 ml-4 space-y-0.5">
                {localData.answers.map((a: any, i: number) => (
                  <li key={i} className={a.isCorrect ? 'text-green-700' : 'text-gray-500'}>
                    {a.isCorrect ? '✓' : '○'} {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.aiNotes && <p className="text-blue-600 italic">AI: {item.aiNotes}</p>}
        </div>
      )}

      {item.status === 'PENDING' && (
        <div className="flex items-center gap-2">
          <Textarea
            rows={1}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Review notes (optional)"
            className="flex-1 text-xs"
          />
          <Button size="sm" variant="primary" onClick={() => onApprove(item.id, notes)}>
            <Check size={13} className="mr-1" />Approve
          </Button>
          <Button size="sm" variant="danger" onClick={() => onReject(item.id, notes)}>
            <X size={13} className="mr-1" />Reject
          </Button>
        </div>
      )}
    </div>
  )
}

export default function Staging() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('PENDING')

  const { data: staged, isLoading } = useQuery({
    queryKey: ['staged', statusFilter],
    queryFn: () => api.get('/api/admin/staging', { params: { status: statusFilter || undefined } }).then(r => r.data as StagedQuestion[]),
  })

  const updateDataMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/api/admin/staging/${id}`, { data }),
    onError: () => toast.error('Failed to save changes'),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.post(`/api/admin/staging/${id}/approve`, { reviewNotes: notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staged'] }); toast.success('Approved') },
    onError: () => toast.error('Failed to approve'),
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.post(`/api/admin/staging/${id}/reject`, { reviewNotes: notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staged'] }); toast.success('Rejected') },
    onError: () => toast.error('Failed to reject'),
  })

  const approveAllMut = useMutation({
    mutationFn: () => api.post('/api/admin/staging/approve-all'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staged'] })
      toast.success(`Approved ${res.data.approved} question${res.data.approved !== 1 ? 's' : ''}${res.data.failed ? ` (${res.data.failed} failed)` : ''}`)
    },
    onError: () => toast.error('Bulk approve failed'),
  })

  const rejectAllMut = useMutation({
    mutationFn: () => api.post('/api/admin/staging/reject-all', {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['staged'] })
      toast.success(`Rejected ${res.data.rejected} question${res.data.rejected !== 1 ? 's' : ''}`)
    },
    onError: () => toast.error('Bulk reject failed'),
  })

  const pendingCount = staged?.filter(s => s.status === 'PENDING').length ?? 0
  const showBulkActions = statusFilter === 'PENDING' && pendingCount > 0

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Staging & QA</h1>
          {pendingCount > 0 && (
            <span className="text-sm text-gray-500">{pendingCount} pending</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showBulkActions && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => approveAllMut.mutate()}
                loading={approveAllMut.isPending}
              >
                <CheckCheck size={14} className="mr-1" />
                Approve All ({pendingCount})
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => rejectAllMut.mutate()}
                loading={rejectAllMut.isPending}
              >
                <XSquare size={14} className="mr-1" />
                Reject All ({pendingCount})
              </Button>
            </>
          )}
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : staged?.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No staged questions</div>
      ) : (
        <div className="space-y-3">
          {staged?.map(item => (
            <StagedCard
              key={item.id}
              item={item}
              onApprove={(id, notes) => approveMut.mutate({ id, notes })}
              onReject={(id, notes) => rejectMut.mutate({ id, notes })}
              onUpdateData={(id, data) => updateDataMut.mutate({ id, data })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
