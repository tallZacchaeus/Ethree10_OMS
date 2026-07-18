import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";

export async function requirePageRole(allowed: Role[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      isSuperAdmin: true,
      memberships: { where: { removedAt: null, acceptedAt: { not: null } }, select: { role: true } },
    },
  });
  if (!user?.isSuperAdmin && !user?.memberships.some((membership) => allowed.includes(membership.role))) {
    redirect("/dashboard?access=denied");
  }
}
