import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByUsername, getPassportByNumber, getPassportByUserId } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username:       { label: "Username" },
        password:       { label: "Password", type: "password" },
        passportNumber: { label: "Passport Number" },
        passportPin:    { label: "Passport PIN" },
      },
      async authorize(credentials) {
        // ── Passport login ──────────────────────────────────
        if (credentials?.passportNumber) {
          const pn = (credentials.passportNumber as string).trim().toUpperCase();
          if (!pn) return null;
          const passport = getPassportByNumber(pn);
          if (!passport) return null;
          if (passport.status === "blocked") return null;

          // If a PIN is set, verify it
          if (passport.pin_hash) {
            const pin = (credentials.passportPin as string)?.trim() ?? "";
            if (!pin) return null;
            const pinOk = await bcrypt.compare(pin, passport.pin_hash);
            if (!pinOk) return null;
          }

          return {
            id: `passport:${passport.id}`,
            name: passport.minecraft_nick,
            role: "citizen",
            passportId: passport.id,
            passportNumber: passport.passport_number,
            citizenshipLevel: passport.citizenship_level,
            passportStatus: passport.status,
          };
        }

        // ── Username / password login ───────────────────────
        const username = (credentials?.username as string)?.trim();
        const password = credentials?.password as string;
        if (!username || !password) return null;

        const user = getUserByUsername(username);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        // Check if this user has a linked passport
        const linkedPassport = getPassportByUserId(user.id);

        return {
          id: String(user.id),
          name: user.username,
          role: user.role,
          passportId:        linkedPassport?.id ?? null,
          passportNumber:    linkedPassport?.passport_number ?? null,
          citizenshipLevel:  linkedPassport?.citizenship_level ?? null,
          passportStatus:    linkedPassport?.status ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role             = (user as any).role;
        token.id               = (user as any).id;
        token.passportId       = (user as any).passportId ?? null;
        token.passportNumber   = (user as any).passportNumber ?? null;
        token.citizenshipLevel = (user as any).citizenshipLevel ?? null;
        token.passportStatus   = (user as any).passportStatus ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role             = token.role;
        (session.user as any).id               = token.id;
        (session.user as any).passportId       = token.passportId;
        (session.user as any).passportNumber   = token.passportNumber;
        (session.user as any).citizenshipLevel = token.citizenshipLevel;
        (session.user as any).passportStatus   = token.passportStatus;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
