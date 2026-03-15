import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Question, type Answer, type QuestionType, type Difficulty, type QuestionStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { typeLabel } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

interface FormAnswer { id?: string; text: string; isCorrect: boolean; order: number }

interface FormState {
  text: string; type: QuestionType; points: number
  difficulty: Difficulty; category: string; subCategory: string
  collection: string; origin: string; status: QuestionStatus; isHidden: boolean
  answers: FormAnswer[]
}

const emptyForm: FormState = {
  text: '', type: 'STANDARD', points: 1,
  difficulty: 'MEDIUM', category: '', subCategory: '',
  collection: '', origin: '', status: 'ACTIVE', isHidden: false,
  answers: [{ text: '', isCorrect: true, order: 0 }],
}

export default function QuestionEdit() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState(emptyForm)

  const { data: question } = useQuery({
    queryKey: ['question', id],
    queryFn: () => api.get(`/api/admin/questions/${id}`).then(r => r.data as Question),
    enabled: !isNew,
  })

  const { data: meta } = useQuery({
    queryKey: ['admin-q-meta'],
    queryFn: () => api.get('/api/admin/questions/meta').then(r => r.data),
  })

  useEffect(() => {
    if (question) {
      setForm({
        text: question.text,
        type: question.type,
        points: question.points,
        difficulty: question.difficulty,
        category: question.category ?? '',
        subCategory: question.subCategory ?? '',
        collection: question.collection ?? '',
        origin: question.origin ?? '',
        status: question.status,
        isHidden: question.isHidden,
        answers: question.answers.map(a => ({ id: a.id, text: a.text, isCorrect: a.isCorrect, order: a.order })),
      })
    }
  }, [question])

  const saveMut = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        category: data.category || undefined,
        subCategory: data.subCategory || undefined,
        collection: data.collection || undefined,
        origin: data.origin || undefined,
        answers: data.answers.filter(a => a.text.trim()),
      }
      return isNew
        ? api.post('/api/admin/questions', payload)
        : api.put(`/api/admin/questions/${id}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-questions'] })
      toast.success(isNew ? 'Question created' : 'Question saved')
      navigate('/admin/questions')
    },
    onError: () => toast.error('Failed to save'),
  })

  const addAnswer = () =>
    setForm(f => ({ ...f, answers: [...f.answers, { text: '', isCorrect: f.type === 'STANDARD', order: f.answers.length }] }))

  const removeAnswer = (i: number) =>
    setForm(f => ({ ...f, answers: f.answers.filter((_, idx) => idx !== i) }))

  const updateAnswer = (i: number, patch: Partial<FormAnswer>) =>
    setForm(f => ({ ...f, answers: f.answers.map((a, idx) => idx === i ? { ...a, ...patch } : a) }))

  const isMultipleChoice = form.type === 'MULTIPLE_CHOICE'
  const isStandard = form.type === 'STANDARD'

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/questions')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'New Question' : 'Edit Question'}</h1>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(form) }} className="space-y-4">
        {/* Question text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question Text *</label>
          <Textarea
            rows={3}
            value={form.text}
            onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
            placeholder="Enter the question…"
            required
          />
        </div>

        {/* Type, Difficulty, Points */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}>
              {(['STANDARD', 'MULTIPLE_CHOICE', 'MULTIPLE_ANSWER'] as const).map(t =>
                <option key={t} value={t}>{typeLabel(t)}</option>
              )}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
            <Select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}>
              {(['EASY', 'MEDIUM', 'HARD'] as const).map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
            <Input type="number" min={0} value={form.points} onChange={e => setForm(f => ({ ...f, points: Number(e.target.value) }))} />
          </div>
        </div>

        {/* Category, SubCategory */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">— None —</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-category</label>
            <Input
              value={form.subCategory}
              onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))}
              placeholder="e.g. Physics"
            />
          </div>
        </div>

        {/* Collection, Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
            <Input
              list="collections"
              value={form.collection}
              onChange={e => setForm(f => ({ ...f, collection: e.target.value }))}
              placeholder="Optional collection slug"
            />
            <datalist id="collections">
              {meta?.collections?.map((c: any) => <option key={c.slug} value={c.slug} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
              {['ACTIVE', 'STAGED', 'ARCHIVED', 'FLAGGED'].map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>

        {/* Answers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              {isStandard ? 'Answer(s)' : isMultipleChoice ? 'Options (mark correct)' : 'Correct Answers'}
            </label>
            <button type="button" onClick={addAnswer} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> Add answer
            </button>
          </div>
          <div className="space-y-2">
            {form.answers.map((answer, i) => (
              <div key={i} className="flex items-center gap-2">
                {isMultipleChoice && (
                  <input
                    type="checkbox"
                    checked={answer.isCorrect}
                    onChange={e => updateAnswer(i, { isCorrect: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    title="Correct answer"
                  />
                )}
                <Input
                  value={answer.text}
                  onChange={e => updateAnswer(i, { text: e.target.value })}
                  placeholder={isMultipleChoice ? `Option ${i + 1}` : 'Answer text'}
                  className="flex-1"
                />
                {form.answers.length > 1 && (
                  <button type="button" onClick={() => removeAnswer(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saveMut.isPending}>
            {isNew ? 'Create Question' : 'Save Changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/admin/questions')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
