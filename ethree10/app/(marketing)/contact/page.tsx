import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact — Ethree10",
  description: "Get in touch with the Ethree10 team.",
};

export default function ContactPage() {
  return (
    <main className="py-20 px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">Contact Us</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          We would love to hear from you. Whether you have a question about our services or are ready to start a project.
        </p>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 text-left">
          <div className="rounded-xl border p-8 bg-card">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand-600" /> Email
            </h2>
            <p className="mt-4 text-muted-foreground">For general inquiries and support.</p>
            <a href="mailto:hello@ethree10.example" className="mt-4 inline-block font-medium text-brand-700 hover:underline">
              hello@ethree10.example
            </a>
          </div>

          <div className="rounded-xl border p-8 bg-card">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-600" /> Office
            </h2>
            <p className="mt-4 text-muted-foreground">Reach4Christ Global HQ</p>
            <p className="mt-1 font-medium text-neutral-900">Lagos, Nigeria</p>
          </div>
        </div>

        <div className="mt-16 border-t pt-16">
          <h2 className="text-2xl font-bold text-brand-900">Ready to build?</h2>
          <p className="mt-4 text-muted-foreground">
            The best way to engage us for work is through our structured project intake form.
          </p>
          <Link
            href="/request"
            className="mt-8 inline-block rounded-md bg-brand-700 px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-brand-600"
          >
            Submit a Project Request
          </Link>
        </div>
      </div>
    </main>
  );
}
