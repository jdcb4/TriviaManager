import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { HelpCircle, Layers, MessageSquare, History } from 'lucide-react'

export default function Dashboard() {
  const { data: qMeta } = useQuery({
    queryKey: ['admin-q-meta'],
    queryFn: () => api.get('/api/admin/questions/meta').then(r => r.data),
  })
  const { data: staged } = useQuery({
    queryKey: ['staged-count'],
    queryFn: () => api.get('/api/admin/staging?status=PENDING').then(r => r.data),
  })
  const { data: flagged } = useQuery({
    queryKey: ['flagged-count'],
    queryFn: () => api.get('/api/admin/questions?status=FLAGGED&limit=1').then(r => r.data),
  })
  const { data: versions } = useQuery({
    queryKey: ['versions'],
    queryFn: () => api.get('/api/admin/versions').then(r => r.data),
  })

  const latestVersion = versions?.[0]

  const stats = [
    { label: 'Pending Staged', value: staged?.length ?? '—', icon: Layers, to: '/admin/staging', color: 'text-blue-600' },
    { label: 'Flagged Questions', value: flagged?.meta?.total ?? '—', icon: MessageSquare, to: '/admin/feedback', color: 'text-red-600' },
    { label: 'Dataset Version', value: latestVersion?.version ?? '—', icon: History, to: '/admin/versions', color: 'text-indigo-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {latestVersion
            ? `Dataset v${latestVersion.version} · ${latestVersion.questionCount} questions`
            : 'No dataset published yet'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, to, color }) => (
          <Link
            key={label}
            to={to}
            className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <Icon size={20} className={color} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Type breakdown */}
      {qMeta?.typeCounts && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Questions by Type</h2>
          <div className="flex gap-3 flex-wrap">
            {qMeta.typeCounts.map((t: any) => (
              <div key={t.type} className="flex items-center gap-2">
                <Badge variant="secondary">{t.type.replace('_', ' ')}</Badge>
                <span className="text-sm text-gray-600">{t._count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          <Link to="/admin/questions/new" className="text-sm text-indigo-600 hover:underline">+ New Question</Link>
          <Link to="/admin/ai" className="text-sm text-indigo-600 hover:underline">AI Generate</Link>
          <Link to="/admin/ingestion" className="text-sm text-indigo-600 hover:underline">Import CSV/JSON</Link>
          <Link to="/admin/versions" className="text-sm text-indigo-600 hover:underline">Publish Dataset</Link>
          <Link to="/feedback" target="_blank" className="text-sm text-indigo-600 hover:underline">Open Feedback Tool ↗</Link>
        </div>
      </div>
    </div>
  )
}
