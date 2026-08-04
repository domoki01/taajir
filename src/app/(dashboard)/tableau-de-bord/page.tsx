import { redirect } from "next/navigation";

// Nothing else lives at the root of the dashboard yet, so send people to the
// page they actually came for rather than showing an empty shell.
export default function DashboardPage() {
  redirect("/tableau-de-bord/annonces");
}
