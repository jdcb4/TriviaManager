import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Link } from 'react-router-dom'
import { FileJson, FileSpreadsheet, Database, ArrowLeft, Book } from 'lucide-react'

export default function Download() {
  const { data: version } = useQuery({
    queryKey: ['dataset-version'],
    queryFn: () => api.get('/api/dataset-version').then(r => r.data),
  })

  const files = [
    {
      label: 'JSON',
      description: 'Full dataset as JSON array. Includes all questions, answers, and metadata.',
      href: '/api/downloads/json',
      icon: FileJson,
      ext: '.json',
    },
    {
      label: 'CSV',
      description: 'Spreadsheet-friendly format. One row per question with pipe-separated answers.',
      href: '/api/downloads/csv',
      icon: FileSpreadsheet,
      ext: '.csv',
    },
    {
      label: 'SQLite',
      description: 'Portable SQLite database with questions and answers tables. Great for apps.',
      href: '/api/downloads/sqlite',
      icon: Database,
      ext: '.db',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></Link>
            <h1 className="font-bold text-indigo-700">TriviaManager</h1>
          </div>
          <Link to="/docs" className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1">
            <Book size={14} />API Docs
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Downloads</h2>
          {version?.version ? (
            <p className="text-sm text-gray-500 mt-1">
              Dataset v{version.version} · {version.questionCount} questions ·{' '}
              <span className="font-mono text-xs">{version.checksum?.slice(0, 12)}…</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Dataset not yet published</p>
          )}
        </div>

        <div className="space-y-3">
          {files.map(({ label, description, href, icon: Icon, ext }) => (
            <a
              key={label}
              href={href}
              className="flex items-start gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <Icon size={24} className="text-indigo-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-gray-900 group-hover:text-indigo-700">{label} <span className="font-normal text-gray-400 text-sm">{ext}</span></p>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          <p className="font-medium mb-1">API Access</p>
          <p className="text-xs text-gray-500 mb-2">Check for updates programmatically:</p>
          <code className="block bg-white border rounded px-3 py-2 text-xs font-mono text-gray-800">
            GET /api/dataset-version
          </code>
          <p className="text-xs text-gray-400 mt-2">Returns version number and SHA-256 checksum. Cache locally and re-download when checksum changes.</p>
        </div>
      </main>
    </div>
  )
}
