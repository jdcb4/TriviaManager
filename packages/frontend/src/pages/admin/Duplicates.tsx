import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Copy, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function Duplicates() {
  const [questionId, setQuestionId] = useState('')

  const scanMut = useMutation({
    mutationFn: (id: string) => api.get(`/api/admin/questions/${id}/duplicates`).then(r => r.data),
    onError: () => toast.error('Scan failed'),
  })

  const bulkMut = useMutation({
    mutationFn: () => api.post('/api/admin/questions/scan-duplicates').then(r => r.data),
    onSuccess: (data) => toast.success(`Found ${data.length} questions with potential duplicates`),
    onError: () => toast.error('Bulk scan failed'),
  })

  const layerColor: Record<string, string> = {
    exact: 'danger',
    normalized: 'danger',
    jaccard: 'warning',
    levenshtein: 'secondary',
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Copy size={20} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Duplicate Detection</h1>
      </div>

      {/* Single question scan */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Check a Question</h2>
        <div className="flex gap-2">
          <Input
            value={questionId}
            onChange={e => setQuestionId(e.target.value)}
            placeholder="Paste question ID…"
            className="flex-1"
          />
          <Button onClick={() => scanMut.mutate(questionId)} loading={scanMut.isPending} disabled={!questionId}>
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
                  <Badge variant={layerColor[m.layer] as any}>{m.layer}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2">{m.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Score: {(m.score * 100).toFixed(0)}%</p>
                  </div>
                  <Link to={`/admin/questions/${m.id}`} className="text-xs text-indigo-600 hover:underline shrink-0">Edit</Link>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Bulk scan */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Bulk Scan</h2>
        <p className="text-sm text-gray-500">Scan all active questions for potential duplicates. This may take a moment.</p>
        <Button variant="outline" onClick={() => bulkMut.mutate()} loading={bulkMut.isPending}>
          Scan All Questions
        </Button>

        {bulkMut.data && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {bulkMut.data.length === 0 ? (
              <p className="text-sm text-green-600">✓ No duplicates found across the dataset</p>
            ) : (
              bulkMut.data.map((item: any) => (
                <div key={item.questionId} className="p-3 bg-gray-50 rounded-lg">
                  <Link to={`/admin/questions/${item.questionId}`} className="text-sm text-indigo-600 hover:underline">
                    View question
                  </Link>
                  <span className="text-xs text-gray-400 ml-2">({item.matches.length} match{item.matches.length > 1 ? 'es' : ''})</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
