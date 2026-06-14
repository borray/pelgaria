import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCertificate,
  IconDatabase,
  IconExternalLink,
  IconFingerprint,
  IconFlame,
  IconHistory,
  IconQrcode,
  IconSearch,
  IconShieldCheck,
  IconShieldX,
} from '@tabler/icons-react'
import apiClient from '../api/client'
import { Button } from '../components/ui/Button'
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
  destroy_warning?: boolean
}

interface VerifyHistoryItem {
  code: string
  found: boolean
  title: string
  checkedAt: string
}

const historyKey = 'sonar-verification-history'

export function VerificationPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<VerifyHistoryItem[]>([])

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(historyKey) ?? '[]'))
    } catch {
      setHistory([])
    }
  }, [])

  const saveHistory = (value: string, verification: VerifyResult) => {
    const next = [
      {
        code: value,
        found: verification.found,
        title: verification.title || verification.kind_label || 'Документ не найден',
        checkedAt: new Date().toISOString(),
      },
      ...history.filter((item) => item.code !== value),
    ].slice(0, 5)
    setHistory(next)
    localStorage.setItem(historyKey, JSON.stringify(next))
  }

  const verify = async (rawValue = code) => {
    const value = rawValue.trim().replace(/\s+/g, '')
    if (value.length < 3) {
      setError('Введите номер документа или контрольный ШК')
      return
    }
    setCode(value)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await apiClient.get<VerifyResult>(`/verify/${encodeURIComponent(value)}`)
      setResult(response.data)
      saveHistory(value, response.data)
    } catch (requestError: unknown) {
      setError((requestError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Не удалось выполнить проверку')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="verification-center">
      <header className="verification-hero">
        <div>
          <span>Государственный реестр СОНАР</span>
          <h1>Контроль подлинности</h1>
          <p>Сверка печатного документа с электронной записью по номеру, ШК или данным из QR-кода.</p>
        </div>
        <div className="verification-hero-mark">
          <IconFingerprint size={36} />
          <i /><i />
        </div>
      </header>

      <div className="verification-layout">
        <main className="verification-console">
          <div className="verification-steps">
            <span className="is-active"><b>01</b> Ввод реквизитов</span>
            <i />
            <span className={loading || result ? 'is-active' : ''}><b>02</b> Сверка реестра</span>
            <i />
            <span className={result ? 'is-active' : ''}><b>03</b> Заключение</span>
          </div>

          <section className="verification-query">
            <div className="verification-query-heading">
              <span><IconQrcode size={20} /></span>
              <div><strong>Введите идентификатор</strong><small>Пробелы будут удалены автоматически</small></div>
            </div>
            <div className="verification-input">
              <IconSearch size={19} />
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') verify() }}
                placeholder="ШК-ЗАК-2026-0001"
                autoFocus
              />
              <Button variant="primary" onClick={() => verify()} loading={loading}>Проверить</Button>
            </div>
            {error && <div className="verification-error"><IconAlertTriangle size={17} />{error}</div>}
          </section>

          {loading && (
            <section className="verification-scanning">
              <div className="verification-scanner">
                <IconFingerprint size={55} />
                <i />
                <span />
              </div>
              <small>Запрос к защищённому контуру</small>
              <h2>Сверяем запись с реестром</h2>
              <p>Проверяем номер, контрольный код, статус и связь с исходной записью.</p>
              <div><span className="is-done">Формат номера</span><span className="is-current">Электронная запись</span><span>Статус документа</span></div>
            </section>
          )}

          {!loading && !result && (
            <section className="verification-idle">
              <div><IconDatabase size={28} /></div>
              <h2>Система готова к проверке</h2>
              <p>Используйте напечатанный номер под штрихкодом или строку ШК. Регистр символов не важен.</p>
              <div><span><IconShieldCheck size={16} /> Реестр доступен</span><span><IconCertificate size={16} /> Проверка без изменения данных</span></div>
            </section>
          )}

          {!loading && result && !result.found && (
            <section className="verification-verdict is-invalid">
              <header><span><IconShieldX size={27} /></span><div><small>Результат проверки</small><h2>Запись не обнаружена</h2></div></header>
              <p>В реестре СОНАР нет документа с такими реквизитами. Проверьте каждый символ. Если номер введён верно, бумагу нельзя считать подтверждённой системой.</p>
              <div className="verification-code-line"><span>Проверенный код</span><strong>{code}</strong></div>
              <Button variant="secondary" onClick={() => { setResult(null); setCode('') }}>Проверить другой документ</Button>
            </section>
          )}

          {!loading && result?.found && result.destroy_warning && (
            <section className="verification-verdict is-warning">
              <header><span><IconAlertTriangle size={27} /></span><div><small>Технологический образец</small><h2>Пробный лист подлежит уничтожению</h2></div></header>
              <p>Этот лист использовался для проверки печатной станции и не имеет юридической силы. Уничтожьте бумажный экземпляр и удалите запись пробного листа.</p>
              <VerificationFields result={result} />
              {result.link && <Link to={result.link}><Button variant="danger"><IconFlame size={16} />Перейти к уничтожению</Button></Link>}
            </section>
          )}

          {!loading && result?.found && !result.destroy_warning && (
            <section className="verification-verdict is-valid">
              <header>
                <span><IconShieldCheck size={27} /></span>
                <div><small>Электронное заключение</small><h2>Документ подтверждён</h2></div>
                <b>Подлинный</b>
              </header>
              <div className="verification-document-title"><IconCertificate size={22} /><div><span>{result.kind_label}</span><strong>{result.title}</strong></div></div>
              <VerificationFields result={result} />
              <footer>
                <span><IconFingerprint size={16} /> Сверка выполнена в СОНАР</span>
                {result.link && <Link to={result.link}><Button variant="secondary"><IconExternalLink size={15} />Открыть запись</Button></Link>}
              </footer>
            </section>
          )}
        </main>

        <aside className="verification-sidebar">
          <section>
            <header><IconHistory size={18} /><div><strong>Последние проверки</strong><small>На этом устройстве</small></div></header>
            <div className="verification-history">
              {history.length === 0 && <p>История появится после первой проверки.</p>}
              {history.map((item) => (
                <button type="button" key={`${item.code}-${item.checkedAt}`} onClick={() => verify(item.code)}>
                  <span className={item.found ? 'is-found' : ''}>{item.found ? <IconShieldCheck size={16} /> : <IconShieldX size={16} />}</span>
                  <div><strong>{item.code}</strong><small>{item.title}</small></div>
                  <IconArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>
          <section className="verification-help">
            <span>Как проверить бумагу</span>
            <ol><li>Найдите номер под крупным штрихкодом.</li><li>Введите его без пробелов.</li><li>Сверьте название, статус и дату.</li></ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

function VerificationFields({ result }: { result: VerifyResult }) {
  return (
    <div className="verification-fields">
      <div><span>Номер</span><strong>{result.number}</strong></div>
      {result.registry_code && <div><span>Контрольный ШК</span><strong>{result.registry_code}</strong></div>}
      {result.status_label && <div><span>Статус</span><strong>{result.status_label}</strong></div>}
      {result.issued_at && <div><span>Дата регистрации</span><strong>{formatDate(result.issued_at)}</strong></div>}
      {result.fields?.map((field) => <div key={field.label}><span>{field.label}</span><strong>{field.value}</strong></div>)}
    </div>
  )
}
