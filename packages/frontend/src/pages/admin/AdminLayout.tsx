import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout } from '@/lib/auth'
import {
  LayoutDashboard, HelpCircle, Layers, MessageSquare,
  Bot, Copy, History, FolderOpen, Upload, LogOut, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/questions', icon: HelpCircle, label: 'Questions' },
  { to: '/admin/staging', icon: Layers, label: 'Staging' },
  { to: '/admin/ingestion', icon: Upload, label: 'Import' },
  { to: '/admin/duplicates', icon: Copy, label: 'Duplicates' },
  { to: '/admin/ai', icon: Bot, label: 'AI Generate' },
  { to: '/admin/feedback', icon: MessageSquare, label: 'Feedback' },
  { to: '/admin/collections', icon: FolderOpen, label: 'Collections' },
  { to: '/admin/versions', icon: History, label: 'Versions' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <span className="font-bold text-lg text-indigo-600">TriviaManager</span>
          <span className="ml-1 text-xs text-gray-400">Admin</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t space-y-0.5">
          <a
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <ChevronRight size={16} />
            View Public Site
          </a>
          <button
            onClick={() => { logout(); navigate('/admin/login') }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
