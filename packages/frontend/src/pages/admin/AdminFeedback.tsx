import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Trash2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function AdminFeedback() {
  const qc = useQueryClient()

  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: () => api.get('/api/admin/feedback').then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/feedback/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-feedback'] }); toast.success('Deleted') },
  })

  const good = feedback?.filter((f: any) => f.rating === 'GOOD').length ?? 0
  const bad = feedback?.filter((f: any) => f.rating === 'BAD').length ?? 0

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        </div>
        <a href="/feedback" target="_blank" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
          Open Swipe Tool <ExternalLink size={12} />
        </a>
      </div>

      <div className="flex gap-4">
        <div className="bg-green-50 text-green-700 rounded-lg px-4 py-2 text-sm font-medium">👍 {good} Good</div>
        <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm font-medium">👎 {bad} Bad</div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {!feedback?.length ? (
          <p className="p-5 text-sm text-gray-400">No feedback yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Question</th>
                <th className="px-4 py-2 text-left w-20">Rating</th>
                <th className="px-4 py-2 text-left w-32">Date</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {feedback.map((f: any) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="line-clamp-1 text-gray-800">{f.question?.text ?? f.questionId}</p>
                    {f.notes && <p className="text-xs text-gray-400 mt-0.5">"{f.notes}"</p>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={f.rating === 'GOOD' ? 'success' : 'danger'}>
                      {f.rating === 'GOOD' ? '👍' : '👎'} {f.rating}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    <Link to={`/admin/questions/${f.questionId}`}>
                      <Button size="sm" variant="ghost" className="p-1"><ExternalLink size={12} /></Button>
                    </Link>
                    <Button
                      size="sm" variant="ghost"
                      className="p-1 text-red-400 hover:bg-red-50"
                      onClick={() => deleteMut.mutate(f.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
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
