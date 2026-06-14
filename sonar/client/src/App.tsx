import React, { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { DiscordCallbackPage } from './pages/DiscordCallbackPage'
import { Spinner } from './components/ui/Spinner'
import apiClient from './api/client'

// Страницы загружаются по требованию — меньше начальный бандл и быстрее первый рендер
const named = <T extends Record<string, unknown>, K extends keyof T>(loader: () => Promise<T>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] as React.ComponentType })))

const DashboardPage = named(() => import('./pages/DashboardPage'), 'DashboardPage')
const CitizensPage = named(() => import('./pages/CitizensPage'), 'CitizensPage')
const CitizenDetailPage = named(() => import('./pages/CitizenDetailPage'), 'CitizenDetailPage')
const PassportsPage = named(() => import('./pages/PassportsPage'), 'PassportsPage')
const LawsPage = named(() => import('./pages/LawsPage'), 'LawsPage')
const LawDetailPage = named(() => import('./pages/LawDetailPage'), 'LawDetailPage')
const CasesPage = named(() => import('./pages/CasesPage'), 'CasesPage')
const CaseDetailPage = named(() => import('./pages/CaseDetailPage'), 'CaseDetailPage')
const PunishmentsPage = named(() => import('./pages/PunishmentsPage'), 'PunishmentsPage')
const TaxesPage = named(() => import('./pages/TaxesPage'), 'TaxesPage')
const TreasuryPage = named(() => import('./pages/TreasuryPage'), 'TreasuryPage')
const BuildingsPage = named(() => import('./pages/BuildingsPage'), 'BuildingsPage')
const BuildingDetailPage = named(() => import('./pages/BuildingDetailPage'), 'BuildingDetailPage')
const ChatPage = named(() => import('./pages/ChatPage'), 'ChatPage')
const AccountsPage = named(() => import('./pages/AccountsPage'), 'AccountsPage')
const RolesPage = named(() => import('./pages/RolesPage'), 'RolesPage')
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage')
const VerificationPage = named(() => import('./pages/VerificationPage'), 'VerificationPage')
const ServiceCenterPage = named(() => import('./pages/ServiceCenterPage'), 'ServiceCenterPage')
const ServiceSessionPage = named(() => import('./pages/ServiceSessionPage'), 'ServiceSessionPage')

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}

function RouteFallback() {
  return <div className="load-state" style={{ minHeight: '60vh' }}><Spinner /></div>
}

export default function App() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    if (!user) return
    apiClient.get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => undefined)
  }, [setUser, user?.id])

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/discord-callback" element={<DiscordCallbackPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="citizens" element={<CitizensPage />} />
          <Route path="citizens/:id" element={<CitizenDetailPage />} />
          <Route path="passports" element={<PassportsPage />} />
          <Route path="laws" element={<LawsPage />} />
          <Route path="laws/:id" element={<LawDetailPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:id" element={<CaseDetailPage />} />
          <Route path="punishments" element={<PunishmentsPage />} />
          <Route path="taxes" element={<TaxesPage />} />
          <Route path="treasury" element={<TreasuryPage />} />
          <Route path="buildings" element={<BuildingsPage />} />
          <Route path="buildings/:id" element={<BuildingDetailPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="roles/*" element={<RolesPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="print-center" element={<Navigate to="/office?tab=print" replace />} />
          <Route path="verify" element={<VerificationPage />} />
          <Route path="office" element={<ServiceCenterPage />} />
          <Route path="office/sessions/:id" element={<ServiceSessionPage />} />
          <Route path="service-center" element={<Navigate to="/office" replace />} />
          <Route path="*" element={<Navigate to="/citizens" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
