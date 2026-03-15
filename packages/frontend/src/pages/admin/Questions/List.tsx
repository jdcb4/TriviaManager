import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type Question } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { difficultyColor, statusColor, typeLabel } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'
import {
  Plus, Search, Trash2, Edit2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, X, EyeOff, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

type SortField = 'createdAt' | 'updatedAt' | 'text' | 'category' | 'difficulty' | 'status'

// ---- Multi-select dropdown ----
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  className,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (vals: string[]) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])
  }

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
    ? options.find(o => o.value === selected[0])?.label ?? selected[0]
    : `${selected.length} selected`

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none"
      >
        <span className={selected.length > 0 ? 'font-medium text-indigo-700' : ''}>{displayLabel}</span>
        <ArrowUpDown size={12} className="text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 min-w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1">
            {selected.length > 0 && (
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 border-b border-gray-100"
                onClick={() => { onChange([]); setOpen(false) }}
              >
                Clear selection
              </button>
            )}
            {options.map(opt => (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- Sort header cell ----
function SortTh({
  field, label, sortBy, sortDir, onSort, className,
}: {
  field: SortField
  label: string
  sortBy: SortField
  sortDir: 'asc' | 'desc'
  onSort: (f: SortField) => void
  className?: string
}) {
  const active = sortBy === field
  return (
    <th
      className={`px-4 py-3 text-left cursor-pointer select-none hover:bg-gray-100 group ${className ?? ''}`}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === 'asc' ? <ArrowUp size={12} className="text-indigo-500" /> : <ArrowDown size={12} className="text-indigo-500" />
          : <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-400" />
        }
      </span>
    </th>
  )
}

export default function QuestionList() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [search, setSearch] = useState('')
  // Default to showing only ACTIVE; "Show inactive" toggle clears this
  const [showInactive, setShowInactive] = useState(false)
  const [statusFilters, setStatusFilters] = useState<string[]>(['ACTIVE'])
  const [diffFilters, setDiffFilters] = useState<string[]>([])
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Bulk select
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkEdit, setBulkEdit] = useState<{
    difficulty?: string; status?: string; category?: string; collection?: string
  }>({})
  const [showBulkPanel, setShowBulkPanel] = useState(false)

  function handleSort(field: SortField) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
    setPage(1)
  }

  // When showInactive is off, always restrict to ACTIVE regardless of statusFilters
  const effectiveStatuses = showInactive ? statusFilters : ['ACTIVE']

  const params: Record<string, any> = {
    page, limit, sortBy, sortDir,
    ...(search && { search }),
    ...(effectiveStatuses.length > 0 && { statuses: effectiveStatuses.join(',') }),
    ...(diffFilters.length > 0 && { difficulties: diffFilters.join(',') }),
    ...(typeFilters.length > 0 && { types: typeFilters.join(',') }),
    ...(categoryFilters.length > 0 && { categories: categoryFilters.join(',') }),
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

  const bulkUpdateMut = useMutation({
    mutationFn: () => {
      const updates: any = {}
      if (bulkEdit.difficulty) updates.difficulty = bulkEdit.difficulty
      if (bulkEdit.status) updates.status = bulkEdit.status
      if (bulkEdit.category !== undefined) updates.category = bulkEdit.category || null
      if (bulkEdit.collection !== undefined) updates.collection = bulkEdit.collection || null
      return api.post('/api/admin/questions/bulk-update', { ids: Array.from(selected), updates })
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-questions'] })
      setSelected(new Set())
      setBulkEdit({})
      setShowBulkPanel(false)
      toast.success(`Updated ${res.data.updated} question${res.data.updated !== 1 ? 's' : ''}`)
    },
    onError: () => toast.error('Bulk update failed'),
  })

  const questions: Question[] = data?.data ?? []
  const meta = data?.meta

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    if (selected.size === questions.length && questions.length > 0) setSelected(new Set())
    else setSelected(new Set(questions.map(q => q.id)))
  }

  const allSelected = questions.length > 0 && selected.size === questions.length
  // statusFilters=['ACTIVE'] is the default — only count it as a user filter when showInactive is on
  const hasActiveFilters = (showInactive && statusFilters.length > 0) || diffFilters.length > 0 || typeFilters.length > 0 || categoryFilters.length > 0

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
        <MultiSelect
          label="All Statuses"
          className="w-36"
          options={['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED'].map(s => ({ value: s, label: s }))}
          selected={statusFilters}
          onChange={v => { setStatusFilters(v); setPage(1) }}
        />
        <MultiSelect
          label="All Difficulties"
          className="w-36"
          options={['EASY', 'MEDIUM', 'HARD'].map(d => ({ value: d, label: d }))}
          selected={diffFilters}
          onChange={v => { setDiffFilters(v); setPage(1) }}
        />
        <MultiSelect
          label="All Types"
          className="w-44"
          options={['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'].map(t => ({ value: t, label: typeLabel(t) }))}
          selected={typeFilters}
          onChange={v => { setTypeFilters(v); setPage(1) }}
        />
        <MultiSelect
          label="All Categories"
          className="w-44"
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
          selected={categoryFilters}
          onChange={v => { setCategoryFilters(v); setPage(1) }}
        />
        <button
          onClick={() => {
            const next = !showInactive
            setShowInactive(next)
            // When toggling inactive on, clear the ACTIVE-only default so multiselect is free
            if (next) setStatusFilters([])
            else setStatusFilters(['ACTIVE'])
            setPage(1)
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
            showInactive
              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
          {showInactive ? 'Hiding active only' : 'Active only'}
        </button>
        {(hasActiveFilters || showInactive) && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2"
            onClick={() => {
              setStatusFilters(['ACTIVE']); setDiffFilters([]); setTypeFilters([])
              setCategoryFilters([]); setShowInactive(false); setPage(1)
            }}
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* Bulk select toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex-wrap">
          <span className="text-sm font-medium text-indigo-800">{selected.size} selected</span>
          <Button size="sm" onClick={() => setShowBulkPanel(p => !p)}>
            <CheckSquare size={13} className="mr-1" />
            {showBulkPanel ? 'Hide bulk edit' : 'Bulk edit'}
          </Button>
          <button className="text-xs text-gray-500 hover:text-gray-700" onClick={() => { setSelected(new Set()); setShowBulkPanel(false) }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk edit panel */}
      {showBulkPanel && selected.size > 0 && (
        <div className="border rounded-xl p-4 bg-white space-y-3">
          <p className="text-sm font-medium text-gray-700">Bulk edit {selected.size} question{selected.size !== 1 ? 's' : ''} — only filled fields will be updated</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
              <Select value={bulkEdit.difficulty ?? ''} onChange={e => setBulkEdit(b => ({ ...b, difficulty: e.target.value || undefined }))}>
                <option value="">— no change —</option>
                {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <Select value={bulkEdit.status ?? ''} onChange={e => setBulkEdit(b => ({ ...b, status: e.target.value || undefined }))}>
                <option value="">— no change —</option>
                {['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED'].map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <Select value={bulkEdit.category ?? ''} onChange={e => setBulkEdit(b => ({ ...b, category: e.target.value }))}>
                <option value="">— no change —</option>
                <option value=" ">Clear (set to none)</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Collection</label>
              <Input
                placeholder="slug or blank"
                value={bulkEdit.collection ?? ''}
                onChange={e => setBulkEdit(b => ({ ...b, collection: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => bulkUpdateMut.mutate()}
              loading={bulkUpdateMut.isPending}
              disabled={Object.values(bulkEdit).every(v => !v)}
            >
              Apply changes
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setBulkEdit({}); setShowBulkPanel(false) }}>Cancel</Button>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                </th>
                <SortTh field="text" label="Question" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortTh field="text" label="Type" sortBy={sortBy} sortDir={sortDir} onSort={() => {}} className="w-28" />
                <SortTh field="difficulty" label="Difficulty" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortTh field="status" label="Status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-24" />
                <SortTh field="category" label="Category" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-36" />
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {questions.map(q => (
                <tr key={q.id} className={`hover:bg-gray-50 ${selected.has(q.id) ? 'bg-indigo-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </td>
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
      {meta && (
        <div className="flex items-center justify-between text-sm text-gray-500 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span>{meta.total.toLocaleString()} questions · page {meta.page}/{meta.pages}</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-400">Per page:</label>
              <Select
                value={String(limit)}
                onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
                className="w-20 py-1 text-xs"
              >
                {[25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
          </div>
          {meta.pages > 1 && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page === 1} title="First page">
                <ChevronsLeft size={14} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 1} title="Previous page">
                <ChevronLeft size={14} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages} title="Next page">
                <ChevronRight size={14} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage(meta.pages)} disabled={page >= meta.pages} title="Last page">
                <ChevronsRight size={14} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
