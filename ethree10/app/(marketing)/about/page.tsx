import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Ethree10",
  description: "The story, leadership, and mission behind Ethree10.",
};

export default function AboutPage() {
  return (
    <main className="py-20 px-6">
      <div className="mx-auto max-w-3xl space-y-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">About Ethree10</h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Ethree10 gets its name from Ephesians 3:10 — <span className="italic">&ldquo;so that through the church the manifold wisdom of God might now be made known...&rdquo;</span>
            We also operate on the principle of Excellence Through Three: <strong>People, Process, and Product</strong>.
          </p>
        </div>

        <div className="prose prose-neutral max-w-none">
          <h2 className="text-2xl font-semibold text-brand-900">Our Mission</h2>
          <p>
            As the technology and product agency of Reach4Christ Global, our mission is to equip sibling initiatives, partner organizations, and ministries with world-class digital tools. We believe that operational software should be calm, respectful of the user&apos;s time, and built with stewardship in mind.
          </p>

          <h2 className="text-2xl font-semibold text-brand-900 mt-10">Our Approach</h2>
          <p>
            We don&apos;t just build software; we build systems. Every project we take on is rigorously scoped, tracked, and delivered through our internal Operations Management System. This ensures that nothing falls through the cracks and that our partners always have visibility into the work being done.
          </p>

          <h2 className="text-2xl font-semibold text-brand-900 mt-10">Leadership</h2>
          <p>
            Ethree10 is led by a dedicated team of professionals who combine technical excellence with a heart for service. We are committed to fostering a culture of continuous learning and uncompromising quality.
          </p>
        </div>
      </div>
    </main>
  );
}
