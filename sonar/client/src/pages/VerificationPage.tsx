import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconShieldCheck,
  IconShieldX,
  IconSearch,
  IconCertificate,
  IconExternalLink,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { formatDate } from '../utils/formatters'

interface VerifyResult {
  found: boolean
  kind?: string
  kind_label?: string
  number?: string
  registry_code?: string | null
  title?: string
  subject?: string | null
  status?: string | null
  status_label?: string | null
  issued_at?: string | null
  link?: string | null
  fields?: { label: string; value: string }[]
}

export function VerificationPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const verify = async () => {
    const value = code.trim()
    if (value.length < 3) {
      setError('Введите номер или ШК документа')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiClient.get<VerifyResult>(`/verify/${encodeURIComponent(value)}`)
      setResult(res.data)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ошибка проверки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="verify-shell">
      <div className="page-heading">
        <div>
          <span className="page-kicker">СОНАР · Контроль подлинности</span>
          <h1>Проверка документа</h1>
          <p>Введите номер или контрольный ШК с бумаги, чтобы убедиться, что документ зарегистрирован в системе.</p>
        </div>
      </div>

      <div className="verify-search">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') verify() }}
          placeholder="Например: X7F3-A9K2-M4P8 или ШК-ЗАК-..."
          autoFocus
        />
        <Button variant="primary" onClick={verify} loading={loading}>
          <IconSearch size={16} />
          Проверить
        </Button>
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading && (
        <div className="load-state"><Spinner /><span>Сверяем с реестром СОНАР…</span></div>
      )}

      {!loading && result && !result.found && (
        <div className="verify-result is-invalid">
          <span className="verify-badge"><IconShieldX size={16} />Документ не найден</span>
          <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#8d302b', lineHeight: 1.6 }}>
            В государственном реестре нет документа с таким номером или ШК. Возможно, бумага поддельная,
            отозвана или номер введён с ошибкой.
          </p>
        </div>
      )}

      {!loading && result && result.found && (
        <div className="verify-result is-valid">
          <span className="verify-badge"><IconShieldCheck size={16} />Подлинный документ</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '18px' }}>
            <span className="attach-icon"><IconCertificate size={20} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#15734f', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                {result.kind_label}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#18211D', marginTop: '4px' }}>{result.title}</div>
            </div>
            {result.link && (
              <Link to={result.link} style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="sm"><IconExternalLink size={14} />Открыть</Button>
              </Link>
            )}
          </div>

          <div className="verify-fields">
            <div className="verify-field"><span>Номер</span><strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.number}</strong></div>
            {result.registry_code && <div className="verify-field"><span>Контрольный ШК</span><strong style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.registry_code}</strong></div>}
            {result.status_label && <div className="verify-field"><span>Статус</span><strong>{result.status_label}</strong></div>}
            {result.issued_at && <div className="verify-field"><span>Дата</span><strong>{formatDate(result.issued_at)}</strong></div>}
            {result.fields?.map((f) => (
              <div className="verify-field" key={f.label}><span>{f.label}</span><strong>{f.value}</strong></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
