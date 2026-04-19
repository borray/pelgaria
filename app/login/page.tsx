"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Suspense } from "react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [error,    setError]    = useState(searchParams.get("error") ? "Неверный email или пароль" : "");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email:    fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Неверный email или пароль");
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <span className="sl">//</span>
          <span className="co">:</span>
          <span className="nm">МОСТ</span>
        </div>
        <div className="auth-title">Вход для операторов</div>
      </div>

      <div className="auth-divider" />

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input"
            placeholder="admin@most.local" required autoComplete="email" />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="password">Пароль</label>
          <input id="password" name="password" type="password" className="input"
            placeholder="••••••••" required autoComplete="current-password" />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>

      <div className="auth-back">
        <Link href="/">← Вернуться на главную</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
