import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Bot, CheckCircle, XCircle, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AIGenerate() {
  const hasKey = !!import.meta.env.VITE_HAS_OPENROUTER // just a hint; backend validates
  const [form, setForm] = useState({
    model: 'openai/gpt-4o-mini',
    count: 5,
    category: '',
    difficulty: '' as '' | 'EASY' | 'MEDIUM' | 'HARD',
    type: 'STANDARD' as 'STANDARD' | 'MULTIPLE_CHOICE' | 'MULTIPLE_ANSWER',
    instructions: '',
  })

  const { data: models } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.get('/api/admin/ai/models').then(r => r.data as string[]),
  })

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['ai-tasks'],
    queryFn: () => api.get('/api/admin/ai/tasks').then(r => r.data),
    refetchInterval: 3000,
  })

  const generateMut = useMutation({
    mutationFn: () => api.post('/api/admin/ai/generate', {
      ...form,
      difficulty: form.difficulty || undefined,
      category: form.category || undefined,
      instructions: form.instructions || undefined,
    }),
    onSuccess: () => { toast.success('Generation started — check tasks below'); refetchTasks() },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Failed'),
  })

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Bot size={20} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">AI Generate</h1>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Generate Questions</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <Select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
              {(models ?? [form.model]).map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <Input type="number" min={1} max={20} value={form.count} onChange={e => setForm(f => ({ ...f, count: Number(e.target.value) }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              <option value="STANDARD">Standard</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="MULTIPLE_ANSWER">Multiple Answer</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <Select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}>
              <option value="">Any</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
          <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Science, History, Pop Culture" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions (optional)</label>
          <Textarea rows={2} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="e.g. Focus on events before 1900, avoid obscure trivia" />
        </div>

        <Button onClick={() => generateMut.mutate()} loading={generateMut.isPending}>
          <Bot size={14} className="mr-2" />Generate {form.count} Questions
        </Button>

        <p className="text-xs text-gray-400">Generated questions go to Staging for review before being published.</p>
      </div>

      {/* Task history */}
      <div className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Recent Tasks</h2>
        {!tasks?.length ? (
          <p className="text-sm text-gray-400">No tasks yet</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task: any) => (
              <div key={task.id} className="flex items-start gap-3 text-sm">
                {task.status === 'done' ? <CheckCircle size={16} className="text-green-500 mt-0.5" /> :
                  task.status === 'failed' ? <XCircle size={16} className="text-red-500 mt-0.5" /> :
                  <Clock size={16} className="text-yellow-500 mt-0.5 animate-spin" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{task.type}</Badge>
                    <span className="text-gray-500 text-xs">{task.model}</span>
                    <span className="text-gray-400 text-xs">{new Date(task.createdAt).toLocaleTimeString()}</span>
                  </div>
                  {task.error && <p className="text-red-600 text-xs mt-0.5">{task.error}</p>}
                  {task.status === 'done' && task.type === 'generate' && (
                    <p className="text-green-700 text-xs mt-0.5">
                      {Array.isArray(task.result) ? task.result.length : '?'} questions staged
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
