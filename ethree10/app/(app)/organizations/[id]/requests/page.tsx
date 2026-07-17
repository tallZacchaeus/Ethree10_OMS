import { redirect } from "next/navigation";
export default function OrganizationRequestsPage({ params }: { params: { id: string } }) { redirect(`/organizations/${params.id}`); }
