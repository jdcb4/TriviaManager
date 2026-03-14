import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type Question } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { difficultyColor, statusColor, typeLabel } from '@/lib/utils'
import { Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function QuestionList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [diffFilter, setDiffFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const params = {
    page, limit: 50,
    ...(search && { search }),
    ...(statusFilter && { status: statusFilter }),
    ...(diffFilter && { difficulty: diffFilter }),
    ...(typeFilter && { type: typeFilter }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-questions', params],
    queryFn: () => api.get('/api/admin/questions', { params }).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/questions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-questions'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const questions: Question[] = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
        <Link to="/admin/questions/new">
          <Button size="sm"><Plus size={14} className="mr-1" />New Question</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Search questions…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="w-36">
          <option value="">All Statuses</option>
          {['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={diffFilter} onChange={e => { setDiffFilter(e.target.value); setPage(1) }} className="w-36">
          <option value="">All Difficulties</option>
          {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
        </Select>
        <Select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className="w-44">
          <option value="">All Types</option>
          {['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'].map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No questions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left w-28">Type</th>
                <th className="px-4 py-3 text-left w-24">Difficulty</th>
                <th className="px-4 py-3 text-left w-24">Status</th>
                <th className="px-4 py-3 text-left w-32">Category</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {questions.map(q => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 text-gray-900">{q.text}</p>
                    {q.answers.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {q.answers.filter(a => a.isCorrect).map(a => a.text).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{typeLabel(q.type)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${difficultyColor(q.difficulty)}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColor(q.status)}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{q.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Link to={`/admin/questions/${q.id}`}>
                        <Button size="sm" variant="ghost" className="p-1.5"><Edit2 size={13} /></Button>
                      </Link>
                      <Button
                        size="sm" variant="ghost"
                        className="p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => { if (confirm('Delete this question?')) deleteMut.mutate(q.id) }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{meta.total} questions · page {meta.page}/{meta.pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
              <ChevronLeft size={14} />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages}>
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
