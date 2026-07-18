import { redirect } from "next/navigation";
export default function ExportReportPage({ params }: { params: { id: string } }) { redirect(`/api/reports/${params.id}/pdf`); }
