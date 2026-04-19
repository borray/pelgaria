"use client";

import { signOut } from "next-auth/react";

export default function SignOutBtn() {
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: "/" })}>
      Выйти
    </button>
  );
}
