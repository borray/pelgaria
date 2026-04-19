"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function suggestCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

const STATUS_OPTIONS = [
  { value: "active",    label: "Активная"    },
  { value: "completed", label: "Завершённая" },
  { value: "legendary", label: "Легендарная" },
];

export default function NewUniversePage() {
  const router = useRouter();
  const [name,        setName]        = useState("");
  const [code,        setCode]        = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [status,      setStatus]      = useState("active");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  function handleNameChange(v: string) {
    setName(v);
    if (!codeTouched) setCode(suggestCode(v));
  }

  function handleCodeChange(v: string) {
    setCodeTouched(true);
    setCode(v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 2) { setError("Код должен содержать 2–3 буквы"); return; }
    setError("");
    setLoading(true);
    const res = await fetch("/api/universes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, description, status }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    router.push("/admin/universes");
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Новая вселенная</h1>
          <p className="page-subtitle">Код вселенной станет префиксом всех УИН её объектов</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label className="field-label" htmlFor="name">Название</label>
            <input id="name" className="input" value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Pelgaria" required />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="code">
              Код вселенной
              <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--fg-3)" }}>
                (2–3 латинские буквы)
              </span>
            </label>
            <input id="code" className="input input-mono" value={code}
              onChange={e => handleCodeChange(e.target.value)}
              placeholder="PLG" maxLength={3} required />
            <span className="field-hint">
              Предложен автоматически — можно изменить. После добавления объектов код нельзя будет сменить.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="status">Статус</label>
            <select id="status" className="input" value={status}
              onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="desc">Описание</label>
            <textarea id="desc" className="input" value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Краткое описание вселенной..." />
          </div>

        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Сохранение..." : "Создать вселенную"}
          </button>
          <Link href="/admin/universes" className="btn btn-secondary">Отмена</Link>
        </div>
      </form>
    </div>
  );
}
