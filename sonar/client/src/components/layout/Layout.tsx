import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { Sidebar } from './Sidebar'
import { Breadcrumbs } from './Breadcrumbs'

export function Layout() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Topbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          className="page-enter"
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#F1F5F9',
            padding: '24px',
          }}
        >
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
