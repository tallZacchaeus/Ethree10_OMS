import { getServerSession } from "next-auth";
import { authConfig } from "@/server/auth/config";

export function auth() {
  return getServerSession(authConfig);
}
