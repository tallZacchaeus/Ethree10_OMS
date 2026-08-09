import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const GUIDES_DIR = resolve(process.cwd(), "docs/user-guides");

/**
 * The guides must describe the system that exists. This test is the tripwire —
 * it previously encoded the old workspace/department model and kept passing
 * while the product moved on underneath it.
 */
describe("user guides", () => {
  const files = readdirSync(GUIDES_DIR).filter((file) => file.endsWith(".md"));
  const combined = files.map((file) => readFileSync(join(GUIDES_DIR, file), "utf8")).join("\n");

  it("covers every role that can log in, and nothing that cannot", () => {
    expect(files).toEqual(
      expect.arrayContaining([
        "chief-executive.md",
        "agency-admin.md",
        "finance-manager.md",
        "branch-head.md",
        "department-lead.md",
        "team-member.md",
      ]),
    );
    // Roles that no longer exist must not have guides.
    expect(files).not.toContain("subunit-lead.md");
    expect(files).not.toContain("team-head.md");
    expect(files).not.toContain("reviewer.md");
  });

  it("uses the current org vocabulary", () => {
    // Workspaces were removed from the product.
    expect(combined).not.toMatch(/\bworkspace\b/i);
    // The two branches, by their current names.
    expect(combined).toMatch(/Digital Media/);
    expect(combined).toMatch(/Tech & Product/);
    // Clients do not log in — they get a capability link.
    expect(combined).toMatch(/tracking link/i);
  });

  it("states the money rules that hold the system together", () => {
    expect(combined).toMatch(/Chief Executive/);
    expect(combined).toMatch(/budget/i);
    expect(combined).toMatch(/separation of duties/i);
  });
});
