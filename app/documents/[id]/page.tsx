import { redirect } from "next/navigation";

export default async function OldDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/portal/documents/${id}`);
}
