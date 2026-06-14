import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import apiClient from './api/client'

const lazyPage = (loader: () => Promise<Record<string, React.ComponentType>>, name: string) =>
  React.lazy(() => loader().then((module) => ({ default: module[name] })))

const Layout = lazyPage(() => import('./components/layout/Layout'), 'Layout')
const BridgePage = lazyPage(() => import('./pages/BridgePage'), 'BridgePage')
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage')
const ChangePasswordPage = lazyPage(() => import('./pages/ChangePasswordPage'), 'ChangePasswordPage')
const CitizensPage = lazyPage(() => import('./pages/CitizensPage'), 'CitizensPage')
const CitizenDetailPage = lazyPage(() => import('./pages/CitizenDetailPage'), 'CitizenDetailPage')
const PassportsPage = lazyPage(() => import('./pages/PassportsPage'), 'PassportsPage')
const LawsPage = lazyPage(() => import('./pages/LawsPage'), 'LawsPage')
const LawDetailPage = lazyPage(() => import('./pages/LawDetailPage'), 'LawDetailPage')
const CasesPage = lazyPage(() => import('./pages/CasesPage'), 'CasesPage')
const CaseDetailPage = lazyPage(() => import('./pages/CaseDetailPage'), 'CaseDetailPage')
const PunishmentsPage = lazyPage(() => import('./pages/PunishmentsPage'), 'PunishmentsPage')
const TaxesPage = lazyPage(() => import('./pages/TaxesPage'), 'TaxesPage')
const TreasuryPage = lazyPage(() => import('./pages/TreasuryPage'), 'TreasuryPage')
const BuildingsPage = lazyPage(() => import('./pages/BuildingsPage'), 'BuildingsPage')
const BuildingDetailPage = lazyPage(() => import('./pages/BuildingDetailPage'), 'BuildingDetailPage')
const ChatPage = lazyPage(() => import('./pages/ChatPage'), 'ChatPage')
const AccountsPage = lazyPage(() => import('./pages/AccountsPage'), 'AccountsPage')
const RolesPage = lazyPage(() => import('./pages/RolesPage'), 'RolesPage')
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage')
const DiscordCallbackPage = lazyPage(() => import('./pages/DiscordCallbackPage'), 'DiscordCallbackPage')
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage')
const VerificationPage = lazyPage(() => import('./pages/VerificationPage'), 'VerificationPage')
const ServiceCenterPage = lazyPage(() => import('./pages/ServiceCenterPage'), 'ServiceCenterPage')
const ServiceSessionPage = lazyPage(() => import('./pages/ServiceSessionPage'), 'ServiceSessionPage')

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

export default function App() {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    if (!user) return
    apiClient.get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => undefined)
  }, [setUser, user?.id])

  useEffect(() => {
    document.title = location.pathname === '/'
      ? 'Мост Пельгарии — Minecraft Java RP'
      : location.pathname === '/login'
        ? 'СОНАР — служебный вход'
        : 'СОНАР — государственная система Пельгарии'
  }, [location.pathname])

  return <Suspense fallback={<div className="route-loading"><span /></div>}>
    <Routes>
      <Route path="/" element={<BridgePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/discord-callback" element={<DiscordCallbackPage />} />
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
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
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  </Suspense>
}
