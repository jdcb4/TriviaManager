import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSwipeable } from 'react-swipeable'
import { api, type Question } from '@/lib/api'
import { ThumbsUp, ThumbsDown, SkipForward } from 'lucide-react'
import toast from 'react-hot-toast'
import { difficultyColor } from '@/lib/utils'

function QuestionCard({ question, onSwipe }: {
  question: Question
  onSwipe: (direction: 'left' | 'right' | 'up') => void
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  const handlers = useSwipeable({
    onSwiping: ({ deltaX, deltaY }) => {
      setDragging(true)
      setOffset({ x: deltaX * 0.4, y: deltaY * 0.1 })
    },
    onSwipedLeft: () => { setOffset({ x: 0, y: 0 }); setDragging(false); onSwipe('left') },
    onSwipedRight: () => { setOffset({ x: 0, y: 0 }); setDragging(false); onSwipe('right') },
    onSwipedUp: () => { setOffset({ x: 0, y: 0 }); setDragging(false); onSwipe('up') },
    onTouchEndOrOnMouseUp: () => { setOffset({ x: 0, y: 0 }); setDragging(false) },
    trackMouse: true,
    preventScrollOnSwipe: true,
  })

  const rotation = offset.x * 0.05
  const goodOpacity = Math.max(0, offset.x / 100)
  const badOpacity = Math.max(0, -offset.x / 100)

  const correctAnswers = question.answers.filter(a => a.isCorrect)

  return (
    <div className="absolute inset-0 flex items-center justify-center px-4">
      <div
        {...handlers}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
          touchAction: 'none',
        }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Swipe indicators */}
        <div className="flex justify-between mb-4">
          <div className="flex items-center gap-1 text-green-500 font-bold text-sm" style={{ opacity: goodOpacity }}>
            <ThumbsUp size={18} /> GOOD
          </div>
          <div className="flex items-center gap-1 text-red-500 font-bold text-sm" style={{ opacity: badOpacity }}>
            BAD <ThumbsDown size={18} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {question.category && (
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{question.category}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${difficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </span>
          </div>

          <p className="text-lg font-semibold text-gray-900 leading-snug">{question.text}</p>

          {question.type === 'MULTIPLE_CHOICE' && question.answers.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {question.answers.map((a, i) => (
                <div
                  key={i}
                  className={`text-sm px-3 py-2 rounded-lg border ${a.isCorrect ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}
                >
                  {a.text}
                </div>
              ))}
            </div>
          )}

          {question.type !== 'MULTIPLE_CHOICE' && correctAnswers.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-400 mb-1">Answer</p>
              <p className="text-sm text-gray-700">{correctAnswers.map(a => a.text).join(', ')}</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-6">Swipe right = good · left = bad · up = skip</p>
      </div>
    </div>
  )
}

export default function FeedbackSwipe() {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)
  const reviewed = useRef(new Set<string>())

  const { data: questions, isLoading } = useQuery({
    queryKey: ['feedback-queue'],
    queryFn: () => api.get('/api/admin/feedback/queue').then(r => r.data as Question[]),
  })

  const submitMut = useMutation({
    mutationFn: ({ questionId, rating }: { questionId: string; rating: 'GOOD' | 'BAD' }) =>
      api.post(`/api/feedback/${questionId}`, { rating }),
  })

  const handleSwipe = (direction: 'left' | 'right' | 'up') => {
    const q = questions?.[index]
    if (!q) return

    if (direction === 'right') {
      submitMut.mutate({ questionId: q.id, rating: 'GOOD' })
      toast.success('👍 Good', { duration: 800 })
    } else if (direction === 'left') {
      submitMut.mutate({ questionId: q.id, rating: 'BAD' })
      toast.error('👎 Flagged', { duration: 800 })
    }

    reviewed.current.add(q.id)
    const next = index + 1
    if (questions && next >= questions.length) setDone(true)
    else setIndex(next)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading questions…</p>
      </div>
    )
  }

  if (done || !questions?.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-gray-900">All done!</h2>
        <p className="text-gray-500 text-sm">You reviewed {reviewed.current.size} questions.</p>
        <button onClick={() => { setIndex(0); setDone(false); reviewed.current.clear() }} className="text-indigo-600 text-sm hover:underline">
          Review again
        </button>
      </div>
    )
  }

  const current = questions[index]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
        <a href="/" className="text-sm font-semibold text-indigo-700">TriviaManager</a>
        <span className="text-xs text-gray-500">{index + 1} / {questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="absolute top-10 left-4 right-4 h-1 bg-gray-200 rounded-full z-10">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${((index) / questions.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="absolute inset-0 top-16">
        <QuestionCard key={current.id} question={current} onSwipe={handleSwipe} />
      </div>

      {/* Button controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-10">
        <button
          onClick={() => handleSwipe('left')}
          className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
        >
          <ThumbsDown size={22} />
        </button>
        <button
          onClick={() => handleSwipe('up')}
          className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors"
        >
          <SkipForward size={18} />
        </button>
        <button
          onClick={() => handleSwipe('right')}
          className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-green-500 hover:bg-green-50 transition-colors"
        >
          <ThumbsUp size={22} />
        </button>
      </div>
    </div>
  )
}
