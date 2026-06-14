import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { Breadcrumbs } from './Breadcrumbs'
import { CommandPalette } from './CommandPalette'
import { ReconstructionPanel } from './ReconstructionPanel'
import { useLayoutStore } from '../../store/layout'

export function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}>
      <Topbar onMenuClick={() => setSidebarOpen((open) => !open)} />
      <CommandPalette />
      <ReconstructionPanel />
      <div className="app-workspace">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className="app-main"
        >
          <Breadcrumbs />
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
