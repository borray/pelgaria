export const dynamic = 'force-dynamic';

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getNotificationsByPassport, getPassportById, getPassportByUserId } from "@/lib/db";
import NotificationCenter from "@/components/NotificationCenter";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as any;
  let passport = user?.passportId ? getPassportById(Number(user.passportId)) : undefined;
  if (!passport && user?.id && !String(user.id).startsWith("passport:")) {
    passport = getPassportByUserId(Number(user.id));
  }

  const notifications = passport ? getNotificationsByPassport(passport.id) : [];

  return (
    <div className="page-enter" style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "4px" }}>
          Личный кабинет
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.5rem", color: "var(--text)", letterSpacing: "-0.04em" }}>
          Уведомления
        </h1>
      </div>

      {!passport ? (
        <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: "10px" }}>
          <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>Паспорт не привязан к аккаунту</div>
        </div>
      ) : (
        <NotificationCenter initialNotifs={notifications as any} />
      )}
    </div>
  );
}
