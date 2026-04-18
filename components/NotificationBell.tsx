"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/notifications/count")
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <Link
      href="/notifications"
      title="Уведомления"
      style={{
        position: "relative", display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        width: "30px", height: "30px", borderRadius: "6px",
        color: count > 0 ? "var(--text)" : "var(--text-muted)",
        textDecoration: "none", flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span style={{ fontSize: "15px", lineHeight: 1 }}>🔔</span>
      {count > 0 && (
        <span style={{
          position: "absolute", top: "1px", right: "1px",
          minWidth: "14px", height: "14px", borderRadius: "99px",
          background: "var(--red)", color: "#fff",
          fontSize: "9px", fontWeight: 700, lineHeight: "14px",
          textAlign: "center", padding: "0 3px", pointerEvents: "none",
        }}>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
