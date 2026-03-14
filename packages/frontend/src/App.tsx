import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from './lib/auth'

// Public pages
import Browse from './pages/public/Browse'
import Download from './pages/public/Download'
import FeedbackSwipe from './pages/public/FeedbackSwipe'

// Admin pages
import Login from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import QuestionList from './pages/admin/Questions/List'
import QuestionEdit from './pages/admin/Questions/Edit'
import Staging from './pages/admin/Staging'
import AdminFeedback from './pages/admin/AdminFeedback'
import AIGenerate from './pages/admin/AIGenerate'
import Duplicates from './pages/admin/Duplicates'
import Versions from './pages/admin/Versions'
import Collections from './pages/admin/Collections'
import Ingestion from './pages/admin/Ingestion'
import Settings from './pages/admin/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Browse />} />
        <Route path="/download" element={<Download />} />
        <Route path="/feedback" element={<FeedbackSwipe />} />

        {/* Admin */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<QuestionList />} />
          <Route path="questions/new" element={<QuestionEdit />} />
          <Route path="questions/:id" element={<QuestionEdit />} />
          <Route path="staging" element={<Staging />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="ai" element={<AIGenerate />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="versions" element={<Versions />} />
          <Route path="collections" element={<Collections />} />
          <Route path="ingestion" element={<Ingestion />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
