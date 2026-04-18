"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary" style={{ cursor: "pointer" }}>
      🖨️ Распечатать
    </button>
  );
}
