import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-500">E10</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ethree10 Operations Management System
        </p>
      </div>

      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold">Sign in</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your email to receive a magic link, or continue with Google.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
