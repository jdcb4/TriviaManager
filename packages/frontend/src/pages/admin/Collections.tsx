import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Collection } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Collections() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', slug: '', description: '', isActive: true })
  const [showForm, setShowForm] = useState(false)

  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: () => api.get('/api/admin/collections').then(r => r.data as Collection[]),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/api/admin/collections', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      toast.success('Collection created')
      setForm({ name: '', slug: '', description: '', isActive: true })
      setShowForm(false)
    },
    onError: () => toast.error('Failed to create'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/collections/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collections'] }); toast.success('Deleted') },
  })

  const autoSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <div className="p-6 space-y-6 max-w-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Collections</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm(s => !s)}>
          <Plus size={14} className="mr-1" />New Collection
        </Button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">New Collection</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
              placeholder="Christmas Special"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <Input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="christmas-special"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} loading={createMut.isPending}>Create</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        {!collections?.length ? (
          <p className="p-5 text-sm text-gray-400">No collections yet</p>
        ) : (
          <div className="divide-y">
            {collections.map(col => (
              <div key={col.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{col.name}</p>
                    <Badge variant="secondary" className="font-mono">{col.slug}</Badge>
                    {!col.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {col.description && <p className="text-xs text-gray-500 mt-0.5">{col.description}</p>}
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="text-red-400 hover:bg-red-50 p-1.5"
                  onClick={() => { if (confirm('Delete collection?')) deleteMut.mutate(col.id) }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
