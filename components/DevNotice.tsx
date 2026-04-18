"use client";

import { useState, useEffect } from "react";

export default function DevNotice({ children, label }: { children: React.ReactNode; label?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <>
      <span onClick={() => setShow(true)} style={{ cursor: "pointer" }}>
        {children}
      </span>
      {show && (
        <div className="toast">
          {label ?? "Раздел в разработке"}
        </div>
      )}
    </>
  );
}
