import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Services — Ethree10",
  description: "Web, Mobile, Brand, and Strategy services for Kingdom impact.",
};

const SERVICES = [
  {
    title: "Web & Product Development",
    description: "We build fast, accessible, and scalable web applications and internal tools.",
    features: ["Marketing sites", "Custom dashboards", "E-commerce", "API Integrations"],
  },
  {
    title: "Mobile App Development",
    description: "Cross-platform mobile applications designed to work smoothly on all devices.",
    features: ["React Native", "Offline-first architectures", "Push notifications", "App Store deployment"],
  },
  {
    title: "Brand & Creative",
    description: "Cohesive brand identities and design systems that communicate excellence.",
    features: ["Logo design", "Brand guidelines", "UI/UX design", "Marketing assets"],
  },
  {
    title: "Strategy & Operations",
    description: "Consulting and systems implementation to help your organization scale.",
    features: ["Process optimization", "Tech stack audits", "Team training", "Data analytics"],
  },
];

export default function ServicesPage() {
  return (
    <main className="py-20 px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">Our Services</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Ethree10 provides end-to-end creative and technology services. Whether you need a simple landing page or a complex operational system, we deliver with excellence.
        </p>

        <div className="mt-16 space-y-16">
          {SERVICES.map((service, index) => (
            <div key={index} className="grid gap-8 md:grid-cols-2 items-center">
              <div>
                <h2 className="text-2xl font-semibold text-brand-900">{service.title}</h2>
                <p className="mt-4 text-muted-foreground">{service.description}</p>
              </div>
              <ul className="space-y-3 rounded-lg bg-neutral-50 p-6 border">
                {service.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-neutral-700">
                    <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 rounded-xl bg-brand-50 p-10 text-center">
          <h2 className="text-2xl font-bold text-brand-900">Ready to start?</h2>
          <p className="mt-4 text-muted-foreground">
            Submit a request and our team will get back to you with scoping details.
          </p>
          <Link
            href="/request"
            className="mt-8 inline-block rounded-md bg-brand-700 px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-brand-600"
          >
            Request a Project
          </Link>
        </div>
      </div>
    </main>
  );
}
