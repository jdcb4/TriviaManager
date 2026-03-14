import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Ingestion() {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/api/admin/ingestion/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
    },
    onSuccess: (data) => {
      toast.success(data.message)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Upload failed'),
  })

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(csv|json)$/i)) {
      toast.error('Only CSV and JSON files are supported')
      return
    }
    uploadMut.mutate(file)
  }

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div className="flex items-center gap-2">
        <Upload size={20} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Import Questions</h1>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        <FileText size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-700">Drop CSV or JSON file here</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse</p>
      </div>

      {/* Status */}
      {uploadMut.isPending && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Processing…
        </div>
      )}
      {uploadMut.isSuccess && uploadMut.data && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
            <CheckCircle size={16} />{uploadMut.data.message}
          </div>
          {uploadMut.data.errors?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">Errors ({uploadMut.data.errors.length}):</p>
              <ul className="text-xs text-red-500 space-y-0.5 max-h-32 overflow-y-auto">
                {uploadMut.data.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Format guide */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
        <h2 className="font-semibold text-gray-800">File Formats</h2>
        <div>
          <p className="font-medium text-gray-700 mb-1">CSV columns:</p>
          <p className="font-mono text-xs text-gray-600">text, type, points, difficulty, category, subCategory, collection, answer, allOptions</p>
          <p className="text-xs text-gray-400 mt-0.5">• <code>answer</code>: correct answer(s), pipe-separated for multiple<br />• <code>allOptions</code>: all options for multiple choice, pipe-separated</p>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-1">JSON format:</p>
          <pre className="text-xs bg-white border rounded p-2 text-gray-600 overflow-x-auto">{`[{
  "text": "Question text",
  "type": "STANDARD",
  "difficulty": "MEDIUM",
  "category": "Science",
  "answers": [
    {"text": "Answer", "isCorrect": true, "order": 0}
  ]
}]`}</pre>
        </div>
      </div>
    </div>
  )
}
