"use client";

import { useRouter } from "next/navigation";

export default function DeleteUniverseBtn({ id, name }: { id: number; name: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Удалить вселенную «${name}»? Это действие необратимо.`)) return;
    await fetch(`/api/universes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button className="btn btn-danger btn-sm" onClick={handleDelete}>
      Удалить
    </button>
  );
}
