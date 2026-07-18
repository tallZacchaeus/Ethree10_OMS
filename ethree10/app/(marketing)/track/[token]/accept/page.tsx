import { redirect } from "next/navigation";

export default async function DeliveryAcceptancePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/track/${token}`);
}
