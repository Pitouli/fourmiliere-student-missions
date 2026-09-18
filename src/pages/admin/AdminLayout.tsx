import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { BrandLogo } from '@/components/BrandLogo'

export function AdminLayout() {
  const { adminInfo, signOut } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/admin/tracking', label: 'Suivi des étudiants', icon: 'M9 17v-2m3 2v-4m3 4v-6m-6 6v-2M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { path: '/admin/organizations', label: 'Codes organizations', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-6 6M9 7a2 2 0 00-2 2m-4 0a6 6 0 006 6m6-6V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4a6 6 0 0012 0z' },
    { path: '/admin/audit', label: 'Journal d\'audit', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  ]

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <header className="bg-base-100 shadow-sm safe-top sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo className="w-9 h-9 rounded-lg bg-base-100 ring-1 ring-base-300" />
            <span className="font-bold text-lg text-base-content">Brindille Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-base-content/60 hidden sm:inline">{adminInfo?.email}</span>
            <button onClick={() => signOut()} className="btn btn-ghost btn-sm gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="border-t border-base-300">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-base-content/60 hover:text-base-content'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 safe-bottom">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
