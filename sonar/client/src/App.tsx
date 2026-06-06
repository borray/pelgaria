import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { CitizensPage } from './pages/CitizensPage'
import { CitizenDetailPage } from './pages/CitizenDetailPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

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
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/citizens" replace />} />
        <Route path="citizens" element={<CitizensPage />} />
        <Route path="citizens/:id" element={<CitizenDetailPage />} />
        <Route
          path="passports"
          element={<PlaceholderPage title="Паспорта" description="Управление паспортами граждан." />}
        />
        <Route
          path="laws"
          element={<PlaceholderPage title="Законодательство" description="Реестр законов и указов государства." />}
        />
        <Route
          path="cases"
          element={<PlaceholderPage title="Судебные дела" description="Реестр судебных дел." />}
        />
        <Route
          path="punishments"
          element={<PlaceholderPage title="Наказания" description="Реестр наказаний." />}
        />
        <Route
          path="taxes"
          element={<PlaceholderPage title="Налоги" description="Налоговые начисления и периоды." />}
        />
        <Route
          path="treasury"
          element={<PlaceholderPage title="Казна" description="Государственная казна и транзакции." />}
        />
        <Route
          path="buildings"
          element={<PlaceholderPage title="РЕЛИКТ" description="Реестр строений и объектов." />}
        />
        <Route
          path="territories"
          element={<PlaceholderPage title="Территории" description="Управление территориями государства." />}
        />
        <Route
          path="diplomacy"
          element={<PlaceholderPage title="Дипломатия" description="Дипломатические отношения и договоры." />}
        />
        <Route
          path="chat"
          element={<PlaceholderPage title="Чат" description="Внутренняя система обмена сообщениями." />}
        />
        <Route
          path="accounts"
          element={<PlaceholderPage title="Аккаунты" description="Управление аккаунтами системы." />}
        />
        <Route
          path="roles"
          element={<PlaceholderPage title="Роли" description="Управление ролями и правами доступа." />}
        />
        <Route path="*" element={<Navigate to="/citizens" replace />} />
      </Route>
    </Routes>
  )
}
