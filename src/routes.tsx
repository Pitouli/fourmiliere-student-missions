import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { StudentLoginPage } from '@/pages/student/StudentLoginPage'
import { StudentDashboardPage } from '@/pages/student/StudentDashboardPage'
import { ValidationPage } from '@/pages/student/ValidationPage'
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminTrackingPage } from '@/pages/admin/AdminTrackingPage'
import { AdminOrganizationsPage } from '@/pages/admin/AdminOrganizationsPage'
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage'

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { adminInfo, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    )
  }
  if (!adminInfo) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

export function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<StudentLoginPage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/validate/:id" element={<ValidationPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout /></ProtectedAdminRoute>}>
          <Route index element={<Navigate to="/admin/tracking" replace />} />
          <Route path="tracking" element={<AdminTrackingPage />} />
          <Route path="organizations" element={<AdminOrganizationsPage />} />
          <Route path="audit" element={<AdminAuditLogsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
