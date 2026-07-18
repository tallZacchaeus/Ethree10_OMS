import { redirect } from "next/navigation";
export default async function OrganizationRequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/organizations/${id}`);
}
