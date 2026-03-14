import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { History, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Versions() {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')

  const { data: versions } = useQuery({
    queryKey: ['versions'],
    queryFn: () => api.get('/api/admin/versions').then(r => r.data),
  })

  const publishMut = useMutation({
    mutationFn: () => api.post('/api/admin/versions/publish', { notes: notes || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['versions'] })
      if (res.data.message?.includes('No changes')) {
        toast('No changes since last publish', { icon: 'ℹ️' })
      } else {
        toast.success(`Published v${res.data.version}`)
        setNotes('')
      }
    },
    onError: () => toast.error('Publish failed'),
  })

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <History size={20} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Dataset Versions</h1>
      </div>

      {/* Publish */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Publish New Version</h2>
        <p className="text-sm text-gray-500">
          Creates a new versioned snapshot of all active questions, computes a checksum, and regenerates the download files (CSV, JSON, SQLite).
        </p>
        <Textarea
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Release notes (optional)…"
        />
        <Button onClick={() => publishMut.mutate()} loading={publishMut.isPending}>
          <Upload size={14} className="mr-2" />Publish Dataset
        </Button>
      </div>

      {/* Version history */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800 text-sm">Version History</h2>
        </div>
        {!versions?.length ? (
          <p className="p-5 text-sm text-gray-400">No versions published yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase border-b bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Version</th>
                <th className="px-4 py-2 text-left">Questions</th>
                <th className="px-4 py-2 text-left">Checksum</th>
                <th className="px-4 py-2 text-left">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versions.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700">v{v.version}</td>
                  <td className="px-4 py-3">{v.questionCount}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{v.checksum?.slice(0, 12)}…</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {v.publishedAt ? new Date(v.publishedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
