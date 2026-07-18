import { redirect } from "next/navigation";

export default function DeliveryAcceptancePage({ params }: { params: { token: string } }) {
  redirect(`/track/${params.token}`);
}
