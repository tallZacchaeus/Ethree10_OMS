import { redirect } from "next/navigation";
export default function EditReportPage({ params }: { params: { id: string } }) { redirect(`/reports/${params.id}`); }
