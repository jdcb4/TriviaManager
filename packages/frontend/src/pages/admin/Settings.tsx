import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Upload, Database, CheckCircle, AlertCircle, Loader } from 'lucide-react'

type SeedStatus = 'idle' | 'loading' | 'success' | 'error'

interface SeedResult {
  success: boolean
  questions: number
  answers: number
  seeded: number
  message: string
}

export default function Settings() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<SeedStatus>('idle')
  const [result, setResult] = useState<SeedResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    setConfirmed(false)
  }

  const handleSeed = async () => {
    if (!file) return
    setStatus('loading')
    setResult(null)
    setErrorMsg('')

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/api/admin/settings/seed', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      setStatus('success')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error ?? 'An error occurred')
      setStatus('error')
    }
  }

  const reset = () => {
    setFile(null)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    setConfirmed(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Server administration</p>
      </div>

      {/* Seed from SQLite */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Seed from SQLite</h2>
        </div>
        <p className="text-sm text-gray-500">
          Upload your local <code className="bg-gray-100 px-1 rounded text-xs">db/trivia.db</code> file
          to import its questions into the remote database. Existing questions are skipped (upsert by ID).
        </p>

        {/* File picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SQLite database file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-sm file:text-gray-700 hover:file:bg-gray-100 cursor-pointer"
          />
          {file && (
            <p className="text-xs text-gray-400 mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>
          )}
        </div>

        {/* Confirmation checkbox */}
        {file && status !== 'success' && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-600">
              I understand this will import all questions from the uploaded file into the live database.
            </span>
          </label>
        )}

        {/* Action button */}
        {status !== 'success' && (
          <div className="flex gap-2">
            <button
              onClick={handleSeed}
              disabled={!file || !confirmed || status === 'loading'}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <><Loader size={14} className="animate-spin" />Seeding…</>
              ) : (
                <><Upload size={14} />Run Seed</>
              )}
            </button>
          </div>
        )}

        {/* Success */}
        {status === 'success' && result && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle size={16} />
              Seed complete
            </div>
            <div className="text-sm text-green-700 space-y-0.5">
              <p>{result.questions} questions · {result.answers} answers in source file</p>
              <p>{result.seeded} records written to database</p>
            </div>
            <button onClick={reset} className="text-xs text-green-600 hover:underline">
              Upload another file
            </button>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-700">{errorMsg}</div>
          </div>
        )}
      </div>
    </div>
  )
}
