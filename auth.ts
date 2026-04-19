import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages:   { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",  type: "email"    },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email as string) as {
            id: number; email: string; name: string;
            password_hash: string; role: string;
          } | undefined;
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!ok) return null;
        return { id: String(user.id), email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role: string }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session { user: { id: string; email: string; name: string; role: string } }
  interface User    { role: string }
}
declare module "next-auth/jwt" {
  interface JWT { role: string }
}
