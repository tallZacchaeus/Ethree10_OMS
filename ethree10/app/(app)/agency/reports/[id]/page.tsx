import { redirect } from "next/navigation";
export default function AgencyReportPage({ params }: { params: { id: string } }) { redirect(`/reports/${params.id}`); }
