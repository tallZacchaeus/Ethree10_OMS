import { redirect } from "next/navigation";
export default function OrganizationReportsPage({ params }: { params: { id: string } }) { redirect(`/organizations/${params.id}`); }
