import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCheck, IconKey } from '@tabler/icons-react'
import { useAuthStore } from '../store/auth'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { SonarBrand } from '../components/brand/SonarBrand'
import apiClient from '../api/client'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!currentPassword || !newPassword || !confirmPassword) return setError('Заполните все поля')
    if (newPassword.length < 6) return setError('Новый пароль должен содержать не менее 6 символов')
    if (newPassword !== confirmPassword) return setError('Пароли не совпадают')

    setLoading(true)
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword })
      if (user) setUser({ ...user, must_change_password: false })
      setDone(true)
    } catch (requestError: unknown) {
      setError((requestError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось сменить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="security-screen">
      <section className="security-card">
        <SonarBrand size="md" />
        {done ? (
          <div className="security-result">
            <span><IconCheck size={22} /></span>
            <h1>Пароль изменён</h1>
            <p>Новая учётная запись готова к работе в СОНАР.</p>
            <Button onClick={() => navigate('/dashboard')}>Перейти в систему</Button>
          </div>
        ) : (
          <>
            <div className="security-heading">
              <span><IconKey size={18} /></span>
              <div><h1>Смена временного пароля</h1><p>{user?.login ? `Учётная запись: ${user.login}` : 'Защитите служебную учётную запись'}</p></div>
            </div>
            <form className="security-form" onSubmit={handleSubmit}>
              <Input label="Текущий пароль" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" autoFocus />
              <Input label="Новый пароль" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
              <Input label="Повторите новый пароль" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
              {error && <div className="form-error">{error}</div>}
              <Button type="submit" loading={loading}>Сменить пароль</Button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
