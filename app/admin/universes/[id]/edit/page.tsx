"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const STATUS_OPTIONS = [
  { value: "active",    label: "Активная"    },
  { value: "completed", label: "Завершённая" },
  { value: "legendary", label: "Легендарная" },
];

export default function EditUniversePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [status,      setStatus]      = useState("active");
  const [code,        setCode]        = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [fetching,    setFetching]    = useState(true);

  useEffect(() => {
    fetch(`/api/universes/${id}`)
      .then(r => r.json())
      .then(d => {
        setName(d.name); setCode(d.code);
        setDescription(d.description ?? ""); setStatus(d.status);
        setFetching(false);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await fetch(`/api/universes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, status }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Ошибка"); return; }
    router.push("/admin/universes");
  }

  if (fetching) return <div className="admin-page"><p className="t-muted">Загрузка...</p></div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Редактировать вселенную</h1>
          <p className="page-subtitle t-mono">{code}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
        <div className="card card-p" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field">
            <label className="field-label">Код вселенной</label>
            <input className="input input-mono" value={code} disabled />
            <span className="field-hint">Код нельзя изменить после создания.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="name">Название</label>
            <input id="name" className="input" value={name}
              onChange={e => setName(e.target.value)} required />
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
              onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Сохранение..." : "Сохранить"}
          </button>
          <Link href="/admin/universes" className="btn btn-secondary">Отмена</Link>
        </div>
      </form>
    </div>
  );
}
