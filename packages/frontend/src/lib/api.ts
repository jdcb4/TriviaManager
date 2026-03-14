import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL ?? ''

export const api = axios.create({ baseURL: BASE })

// Attach JWT token to admin requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token && config.url?.startsWith('/api/admin')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

// Types
export type QuestionType = 'STANDARD' | 'MULTIPLE_CHOICE' | 'MULTIPLE_ANSWER'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type QuestionStatus = 'ACTIVE' | 'STAGED' | 'ARCHIVED' | 'FLAGGED'

export interface Answer {
  id: string
  text: string
  isCorrect: boolean
  order: number
}

export interface Question {
  id: string
  text: string
  type: QuestionType
  points: number
  difficulty: Difficulty
  category: string | null
  subCategory: string | null
  collection: string | null
  origin: string | null
  status: QuestionStatus
  isHidden: boolean
  createdAt: string
  updatedAt: string
  answers: Answer[]
}

export interface Collection {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
}

export interface StagedQuestion {
  id: string
  questionId: string | null
  data: any
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  source: string | null
  aiNotes: string | null
  reviewNotes: string | null
  duplicateOf: string | null
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; pages: number }
}
