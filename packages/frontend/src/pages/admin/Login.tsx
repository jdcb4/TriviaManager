import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

export default function Login() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(password)
      navigate('/admin')
    } catch {
      toast.error('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">TriviaManager</h1>
        <p className="text-sm text-gray-500 mb-6">Admin Access</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              autoFocus
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}
