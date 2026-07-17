import { redirect } from "next/navigation";
export default function TeamReportPage({ params }: { params: { id: string } }) { redirect(`/reports/${params.id}`); }
