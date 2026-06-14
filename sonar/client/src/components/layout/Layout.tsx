import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Breadcrumbs } from './Breadcrumbs'
import { NavigationHub } from './NavigationHub'
import { ReconstructionPanel } from './ReconstructionPanel'

export function Layout() {
  const location = useLocation()
  const [navigationOpen, setNavigationOpen] = useState(false)

  useEffect(() => {
    setNavigationOpen(false)
  }, [location.pathname])

  return (
    <div className="app-shell app-shell-v3">
      <Topbar onNavigationClick={() => setNavigationOpen((open) => !open)} navigationOpen={navigationOpen} />
      <NavigationHub open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <ReconstructionPanel />
      <div className="app-workspace">
        <main className="app-main">
          <Breadcrumbs />
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
