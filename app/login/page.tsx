import { getPreLoginNotifications } from "@/lib/db";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const announcements = getPreLoginNotifications();
  return <LoginForm announcements={announcements} />;
}
