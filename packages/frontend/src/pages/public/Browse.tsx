import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Question } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { difficultyColor, typeLabel } from '@/lib/utils'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function QuestionRow({ q }: { q: Question }) {
  const [open, setOpen] = useState(false)
  const correct = q.answers.filter(a => a.isCorrect)

  return (
    <div className="border-b last:border-0 px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(o => !o)}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm text-gray-900">{q.text}</p>
          {open && (
            <div className="mt-2 space-y-1">
              {q.type === 'MULTIPLE_CHOICE' ? (
                q.answers.map((a, i) => (
                  <p key={i} className={`text-xs ${a.isCorrect ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {a.isCorrect ? '✓' : '○'} {a.text}
                  </p>
                ))
              ) : (
                <p className="text-xs text-green-700 font-medium">{correct.map(a => a.text).join(', ')}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyColor(q.difficulty)}`}>{q.difficulty}</span>
          {q.category && <Badge variant="secondary">{q.category}</Badge>}
        </div>
      </div>
    </div>
  )
}

export default function Browse() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [type, setType] = useState('')

  const params = { page, limit: 25, ...(search && { search }), ...(category && { category }), ...(difficulty && { difficulty }), ...(type && { type }) }

  const { data, isLoading } = useQuery({
    queryKey: ['public-questions', params],
    queryFn: () => api.get('/api/questions', { params }).then(r => r.data),
  })

  const questions: Question[] = data?.data ?? []
  const meta = data?.meta

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-indigo-700 text-lg">TriviaManager</h1>
          <div className="flex gap-3 text-sm">
            <Link to="/download" className="text-gray-600 hover:text-indigo-600 flex items-center gap-1">
              <Download size={14} />Downloads
            </Link>
            <Link to="/feedback" className="text-gray-600 hover:text-indigo-600">Feedback</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Question Library</h2>
          {meta && <p className="text-sm text-gray-500 mt-1">{meta.total.toLocaleString()} questions</p>}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <Input className="pl-8" placeholder="Search…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={difficulty} onChange={e => { setDifficulty(e.target.value); setPage(1) }} className="w-32">
            <option value="">Difficulty</option>
            {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select value={type} onChange={e => { setType(e.target.value); setPage(1) }} className="w-40">
            <option value="">Type</option>
            {['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'].map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </Select>
        </div>

        {/* Results */}
        <div className="bg-white border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No questions found</div>
          ) : (
            questions.map(q => <QuestionRow key={q.id} q={q} />)
          )}
        </div>

        {/* Pagination */}
        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Page {meta.page} of {meta.pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                className="px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-gray-50">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.pages}
                className="px-3 py-1.5 rounded border disabled:opacity-40 hover:bg-gray-50">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
