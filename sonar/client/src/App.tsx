import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { CitizensPage } from './pages/CitizensPage'
import { CitizenDetailPage } from './pages/CitizenDetailPage'
import { PassportsPage } from './pages/PassportsPage'
import { LawsPage } from './pages/LawsPage'
import { LawDetailPage } from './pages/LawDetailPage'
import { CasesPage } from './pages/CasesPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { PunishmentsPage } from './pages/PunishmentsPage'
import { TaxesPage } from './pages/TaxesPage'
import { TreasuryPage } from './pages/TreasuryPage'
import { BuildingsPage } from './pages/BuildingsPage'
import { BuildingDetailPage } from './pages/BuildingDetailPage'
import { ChatPage } from './pages/ChatPage'
import { AccountsPage } from './pages/AccountsPage'
import { RolesPage } from './pages/RolesPage'
import { ProfilePage } from './pages/ProfilePage'
import { DiscordCallbackPage } from './pages/DiscordCallbackPage'
import { DashboardPage } from './pages/DashboardPage'
import { VerificationPage } from './pages/VerificationPage'
import { ServiceCenterPage } from './pages/ServiceCenterPage'
import { ServiceSessionPage } from './pages/ServiceSessionPage'
import apiClient from './api/client'

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
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    if (!user) return
    apiClient.get('/auth/me')
      .then((response) => setUser(response.data))
      .catch(() => undefined)
  }, [setUser, user?.id])

  return (
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
        <Route path="print-center" element={<Navigate to="/office?tab=forms" replace />} />
        <Route path="verify" element={<VerificationPage />} />
        <Route path="office" element={<ServiceCenterPage />} />
        <Route path="office/sessions/:id" element={<ServiceSessionPage />} />
        <Route path="service-center" element={<Navigate to="/office" replace />} />
        <Route path="*" element={<Navigate to="/citizens" replace />} />
      </Route>
    </Routes>
  )
}
