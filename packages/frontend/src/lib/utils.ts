import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function difficultyColor(d: string) {
  if (d === 'EASY') return 'text-green-600 bg-green-50'
  if (d === 'HARD') return 'text-red-600 bg-red-50'
  return 'text-yellow-600 bg-yellow-50'
}

export function statusColor(s: string) {
  if (s === 'ACTIVE') return 'text-green-700 bg-green-50'
  if (s === 'FLAGGED') return 'text-red-700 bg-red-50'
  if (s === 'ARCHIVED') return 'text-gray-600 bg-gray-100'
  return 'text-blue-700 bg-blue-50'
}

export function typeLabel(t: string) {
  if (t === 'MULTIPLE_CHOICE') return 'Multiple Choice'
  if (t === 'MULTIPLE_ANSWER') return 'Multiple Answer'
  return 'Standard'
}
