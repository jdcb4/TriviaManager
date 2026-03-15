import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { CATEGORIES } from '@/lib/categories'
import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { typeLabel } from '@/lib/utils'
import { Download, FileJson, FileText, Settings, Book, FileDown, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Export() {
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [type, setType] = useState('')
  const [limit, setLimit] = useState(100)
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [isExporting, setIsExporting] = useState(false)

  // Preview count
  const previewParams = {
    page: 1, limit: 1,
    ...(category && { category }),
    ...(difficulty && { difficulty }),
    ...(type && { type }),
  }
  const { data: previewData } = useQuery({
    queryKey: ['export-preview', previewParams],
    queryFn: () => api.get('/api/questions', { params: previewParams }).then(r => r.data),
  })
  const totalAvailable: number = previewData?.meta?.total ?? 0
  const exportCount = Math.min(limit, totalAvailable)

  async function handleExport() {
    setIsExporting(true)
    try {
      const params: Record<string, any> = {
        page: 1,
        limit,
        ...(category && { category }),
        ...(difficulty && { difficulty }),
        ...(type && { type }),
      }

      // Collect all pages if limit > 100 (API max per page)
      const allQuestions: any[] = []
      let currentPage = 1
      const pageSize = Math.min(limit, 100)
      while (allQuestions.length < limit) {
        const res = await api.get('/api/questions', {
          params: { ...params, page: currentPage, limit: pageSize },
        })
        const batch = res.data.data ?? []
        allQuestions.push(...batch)
        if (batch.length < pageSize || allQuestions.length >= res.data.meta.total) break
        currentPage++
      }
      const questions = allQuestions.slice(0, limit)

      let content: string
      let mimeType: string
      let filename: string

      if (format === 'json') {
        content = JSON.stringify(questions, null, 2)
        mimeType = 'application/json'
        filename = 'questions.json'
      } else {
        // Build CSV manually
        const headers = ['id', 'text', 'type', 'points', 'difficulty', 'category', 'subCategory', 'collection', 'answers', 'allOptions']
        const rows = questions.map((q: any) => [
          q.id,
          `"${(q.text ?? '').replace(/"/g, '""')}"`,
          q.type,
          q.points,
          q.difficulty,
          `"${(q.category ?? '').replace(/"/g, '""')}"`,
          `"${(q.subCategory ?? '').replace(/"/g, '""')}"`,
          `"${(q.collection ?? '').replace(/"/g, '""')}"`,
          `"${q.answers.filter((a: any) => a.isCorrect).map((a: any) => a.text).join(' | ').replace(/"/g, '""')}"`,
          `"${q.answers.map((a: any) => a.text).join(' | ').replace(/"/g, '""')}"`,
        ])
        content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        mimeType = 'text/csv'
        filename = 'questions.csv'
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-indigo-700 text-lg">TriviaManager</h1>
          <div className="flex gap-3 text-sm">
            <Link to="/" className="text-gray-600 hover:text-indigo-600 flex items-center gap-1">
              <Search size={14} />Browse
            </Link>
            <Link to="/download" className="text-gray-600 hover:text-indigo-600 flex items-center gap-1">
              <Download size={14} />Downloads
            </Link>
            <Link to="/docs" className="text-gray-600 hover:text-indigo-600 flex items-center gap-1">
              <Book size={14} />API Docs
            </Link>
            <Link to="/feedback" className="text-gray-600 hover:text-indigo-600">Feedback</Link>
            <Link to="/admin" className="text-gray-600 hover:text-indigo-600 flex items-center gap-1">
              <Settings size={14} />Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Export Questions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select filters and a format, then download a custom subset of the question library.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-6 space-y-5">
          {/* Filters */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters <span className="text-gray-400 font-normal">(optional)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <Select value={category} onChange={e => setCategory(e.target.value)} className="w-full">
                  <option value="">All categories</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Difficulty</label>
                <Select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full">
                  <option value="">All difficulties</option>
                  {['EASY', 'MEDIUM', 'HARD'].map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <Select value={type} onChange={e => setType(e.target.value)} className="w-full">
                  <option value="">All types</option>
                  {['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'].map(t => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Count */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Number of questions</label>
            <div className="flex items-center gap-3">
              <Select value={String(limit)} onChange={e => setLimit(Number(e.target.value))} className="w-32">
                {[10, 25, 50, 100, 250, 500, 1000].map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
              {totalAvailable > 0 && (
                <p className="text-xs text-gray-400">
                  {totalAvailable.toLocaleString()} available
                  {limit > totalAvailable ? ` — will export all ${totalAvailable.toLocaleString()}` : ` — will export ${exportCount.toLocaleString()}`}
                </p>
              )}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Format</label>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat('json')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  format === 'json'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileJson size={16} />JSON
              </button>
              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  format === 'csv'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText size={16} />CSV
              </button>
            </div>
          </div>

          {/* Export button */}
          <div className="pt-1">
            <Button
              onClick={handleExport}
              loading={isExporting}
              disabled={totalAvailable === 0}
              className="w-full sm:w-auto"
            >
              <FileDown size={15} className="mr-1.5" />
              {isExporting
                ? 'Exporting…'
                : `Export ${exportCount > 0 ? exportCount.toLocaleString() : ''} questions as ${format.toUpperCase()}`}
            </Button>
            {totalAvailable === 0 && (
              <p className="text-xs text-gray-400 mt-2">No questions match the current filters.</p>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-600 space-y-2">
          <p className="font-medium text-gray-700">About this export</p>
          <ul className="space-y-1 text-xs text-gray-500 list-disc list-inside">
            <li>Only active, publicly visible questions are included.</li>
            <li>JSON includes full question objects with answers array.</li>
            <li>CSV includes one row per question with pipe-separated answers.</li>
            <li>For the full dataset or automated sync, use the <Link to="/download" className="text-indigo-600 hover:underline">Downloads</Link> or <Link to="/docs" className="text-indigo-600 hover:underline">API</Link>.</li>
          </ul>
        </div>
      </main>
    </div>
  )
}
