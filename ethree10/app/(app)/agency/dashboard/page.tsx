import { redirect } from "next/navigation";

// Agency dashboard has not been built yet — redirect to the main dashboard.
export default function AgencyDashboardPage() {
  redirect("/dashboard");
}
