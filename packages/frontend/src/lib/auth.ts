import { api } from './api'

export async function login(password: string): Promise<string> {
  const res = await api.post('/api/admin/auth/login', { password })
  const token = res.data.token as string
  localStorage.setItem('admin_token', token)
  return token
}

export function logout() {
  localStorage.removeItem('admin_token')
  window.location.href = '/admin/login'
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('admin_token')
}
