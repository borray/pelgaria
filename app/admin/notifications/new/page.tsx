import { getAllPassports } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/db";
import NotificationForm from "@/components/NotificationForm";

export default async function NewNotificationPage() {
  const passports = getAllPassports();

  async function handleCreate(formData: FormData) {
    "use server";
    const s = await auth();
    const adminId = Number((s?.user as any)?.id ?? 1);
    const ttlDays = Number(formData.get("ttl") || 0);
    const expires_at = ttlDays > 0
      ? new Date(Date.now() + ttlDays * 86400000).toISOString().replace("T", " ").slice(0, 19)
      : undefined;
    createNotification({
      passport_id: Number(formData.get("passport_id")),
      type: formData.get("type") as string,
      title: formData.get("title") as string,
      content: (formData.get("content") as string) || undefined,
      created_by: adminId,
      expires_at,
    });
    revalidatePath("/admin");
    redirect("/admin");
  }

  return <NotificationForm passports={passports} action={handleCreate} />;
}
