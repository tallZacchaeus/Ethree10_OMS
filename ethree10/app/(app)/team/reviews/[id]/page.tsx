import { redirect } from "next/navigation";
export default function TeamReviewPage({ params }: { params: { id: string } }) { redirect(`/tasks/${params.id}`); }
