import { FormEvent, useState } from 'react'
import { PelgariaMark } from '../components/brand/PelgariaMark'
import { PelgradMark } from '../components/brand/PelgradMark'

type Verification = { valid: boolean; number: string; status: 'ACTIVE' | 'REVOKED'; holder: string; issuedAt: string }

export function VerifyPage({ onExit }: { onExit: () => void }) {
  const [value, setValue] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('code') ?? '')
  const [result, setResult] = useState<Verification | null>(null)
  const [message, setMessage] = useState('')
  const [isChecking, setChecking] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = value.trim()
    const number = code.startsWith('PGP1.') ? code.split('.')[1] : code.toUpperCase()
    if (!number) return
    setChecking(true); setResult(null); setMessage('')
    try {
      const response = await fetch(`/api/public/passports/${encodeURIComponent(number)}${code.startsWith('PGP1.') ? `?code=${encodeURIComponent(code)}` : ''}`)
      const body = await response.json().catch(() => ({})) as Verification
      if (!response.ok || !body.number) { setMessage('Документ с такими реквизитами не найден или его QR-код недействителен.'); return }
      setResult(body)
    } catch { setMessage('Не удалось связаться с контуром проверки.') } finally { setChecking(false) }
  }

  return <main className="verify-page"><header><button type="button" onClick={onExit}><PelgariaMark /> Пельгария</button><span>Проверка подлинности</span></header><section><div className="verify-mark"><PelgradMark /></div><p>Пельград · СОНАР</p><h1>Проверить<br />документ.</h1><span>Введите номер паспорта или вставьте код из QR. Проверка не требует служебной учётной записи.</span><form onSubmit={submit}><label>Номер или QR-код<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="PG-ABCDE-12345" autoCapitalize="characters" /></label><button type="submit" disabled={!value.trim() || isChecking}>{isChecking ? 'Проверяем...' : 'Проверить'}</button></form>{message && <p className="verify-error">{message}</p>}{result && <article className={result.valid ? 'is-valid' : 'is-invalid'}><strong>{result.valid ? 'Документ действителен' : 'Документ отозван'}</strong><dl><div><dt>Номер</dt><dd>{result.number}</dd></div><div><dt>Игрок</dt><dd>{result.holder}</dd></div><div><dt>Выдан</dt><dd>{new Date(result.issuedAt).toLocaleDateString('ru-RU')}</dd></div></dl></article>}</section><footer>Пельгария · Minecraft Role Play · Вымышленный игровой мир</footer></main>
}
