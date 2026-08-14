/**
 * Single source of truth for the agency's two teams and the client-facing request
 * "Task Type" catalog. Shared by the request form (grouped picker), the request-create
 * service (self-routing), the DB seed, and agency creation so they never drift.
 */

export const TEAM_SLUGS = {
  brandsCommunications: "digital-media",
  productDevelopment: "tech-product",
} as const;

export type TeamSlug = (typeof TEAM_SLUGS)[keyof typeof TEAM_SLUGS];

/**
 * The agency's two **branches**. Each is a `Team` row led by a `branch_head`,
 * and each contains **departments** (`SubUnit` rows) led by a `department_lead`.
 * Both branches report to the Chief Executive.
 */
export const DEFAULT_TEAMS: Array<{
  name: string;
  slug: TeamSlug;
  description: string;
  color: string;
}> = [
  {
    name: "Digital Media",
    slug: TEAM_SLUGS.brandsCommunications,
    description: "Media, content, video, graphics, social, and branding.",
    color: "#22D3A5",
  },
  {
    name: "Tech & Product",
    slug: TEAM_SLUGS.productDevelopment,
    description: "Websites, apps, software, and product design.",
    color: "#6366F1",
  },
];

/**
 * Client-facing category names for each branch.
 *
 * Clients must never see internal org structure — they pick what they want done
 * and it lands with the right team. Branch names ("Digital Media", "Tech &
 * Product") are how *we* are organised; these are how the *work* is described.
 * Use these on every public surface.
 */
export const PUBLIC_CATEGORY_LABELS: Record<TeamSlug, string> = {
  [TEAM_SLUGS.brandsCommunications]: "Design, Content & Media",
  [TEAM_SLUGS.productDevelopment]: "Websites, Apps & Software",
};

/** Public label for a branch, falling back to a neutral catch-all. */
export function publicCategoryLabel(slug: string | null | undefined): string {
  if (!slug) return "Something else";
  return PUBLIC_CATEGORY_LABELS[slug as TeamSlug] ?? "Something else";
}

/**
 * Starter departments inside each branch. These are seeded so a new agency is
 * usable immediately; branch heads and admins can create, rename and archive
 * departments freely, and assign a lead and members to each.
 */
export const DEFAULT_DEPARTMENTS: Array<{
  branchSlug: TeamSlug;
  name: string;
  slug: string;
  description: string;
}> = [
  {
    branchSlug: TEAM_SLUGS.brandsCommunications,
    name: "Video & Photography",
    slug: "video-photography",
    description: "Shoots, edits, motion graphics and photography.",
  },
  {
    branchSlug: TEAM_SLUGS.brandsCommunications,
    name: "Design & Brand",
    slug: "design-brand",
    description: "Graphic design, brand identity and print collateral.",
  },
  {
    branchSlug: TEAM_SLUGS.brandsCommunications,
    name: "Content & Social",
    slug: "content-social",
    description: "Copywriting, newsletters and social media management.",
  },
  {
    branchSlug: TEAM_SLUGS.productDevelopment,
    name: "Engineering",
    slug: "engineering",
    description: "Web, mobile and backend build.",
  },
  {
    branchSlug: TEAM_SLUGS.productDevelopment,
    name: "Product Design",
    slug: "product-design",
    description: "UI/UX, prototyping and design systems.",
  },
  {
    branchSlug: TEAM_SLUGS.productDevelopment,
    name: "Automation & Tools",
    slug: "automation-tools",
    description: "Internal tools, forms, integrations and automation.",
  },
];

export interface TaskType {
  /** Stable key stored in Request.projectType. */
  value: string;
  label: string;
  teamSlug: TeamSlug;
  /** "Other (describe)" options reveal a free-text field on the form. */
  isOther?: boolean;
}

export interface TaskTypeGroup {
  team: string;
  teamSlug: TeamSlug;
  options: TaskType[];
}

export const TASK_TYPE_GROUPS: TaskTypeGroup[] = [
  {
    team: "Brands & Communications",
    teamSlug: TEAM_SLUGS.brandsCommunications,
    options: [
      { value: "graphic_design", label: "Graphic Design", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "video_production", label: "Video Production / Editing", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "photography", label: "Photography", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "content_copywriting", label: "Content / Copywriting", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "social_media", label: "Social Media Management", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "branding", label: "Branding & Identity", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "branded_email", label: "Branded Email / Newsletter", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "flyer_poster", label: "Flyer / Poster / Banner", teamSlug: TEAM_SLUGS.brandsCommunications },
      { value: "creative_other", label: "Other (describe)", teamSlug: TEAM_SLUGS.brandsCommunications, isOther: true },
    ],
  },
  {
    team: "Product Development",
    teamSlug: TEAM_SLUGS.productDevelopment,
    options: [
      { value: "website", label: "Website", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "web_application", label: "Web Application", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "mobile_app", label: "Mobile App", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "ui_ux_design", label: "UI/UX Design", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "software_automation", label: "Software / Automation Tool", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "survey_form", label: "Survey / Form", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "registration_qr", label: "Registration Link / QR Code", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "budget_request", label: "Budget Request", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "landing_page", label: "Landing Page", teamSlug: TEAM_SLUGS.productDevelopment },
      { value: "product_other", label: "Other (describe)", teamSlug: TEAM_SLUGS.productDevelopment, isOther: true },
    ],
  },
];

export const TASK_TYPES: TaskType[] = TASK_TYPE_GROUPS.flatMap((g) => g.options);

const TASK_TYPE_BY_VALUE = new Map(TASK_TYPES.map((t) => [t.value, t]));

export function getTaskType(value: string): TaskType | undefined {
  return TASK_TYPE_BY_VALUE.get(value);
}

/** Team slug a request should route to, or null if the type isn't in the catalog. */
export function teamSlugForTaskType(value: string): TeamSlug | null {
  return TASK_TYPE_BY_VALUE.get(value)?.teamSlug ?? null;
}

/** Human label for a stored task-type value; falls back to the raw value (legacy data). */
export function labelForTaskType(value: string): string {
  return TASK_TYPE_BY_VALUE.get(value)?.label ?? value;
}

export function isOtherTaskType(value: string): boolean {
  return TASK_TYPE_BY_VALUE.get(value)?.isOther ?? false;
}

/**
 * Client-facing blurb per service. Shared by the seed and the catalog
 * bootstrap so production and demo data cannot describe a service differently.
 */
export const SERVICE_BLURBS: Record<string, string> = {
  graphic_design: "Flyers, social graphics, decks and print pieces that look like you.",
  video_production: "Filming and editing — events, testimonies, promos and highlight reels.",
  photography: "Event, portrait and documentary photography, edited and ready to publish.",
  content_copywriting: "Words that land: articles, scripts, newsletters and web copy.",
  social_media: "Planning, producing and running your social channels.",
  branding: "Logo, colours, typography and the guidelines to keep it consistent.",
  branded_email: "Newsletters and email campaigns designed and set up to send.",
  flyer_poster: "A single flyer, poster or banner, print- and screen-ready.",
  website: "A website built for your audience — fast, mobile-friendly and easy to update.",
  web_application: "A web app for a specific job: portals, dashboards and member areas.",
  mobile_app: "An Android or iOS app, from first sketch through to the app stores.",
  ui_ux_design: "Screens and flows designed and tested before anything gets built.",
  software_automation: "Internal tools and automations that remove repetitive manual work.",
  survey_form: "Forms and surveys that collect clean data you can actually use.",
  registration_qr: "Registration links and QR codes for events and sign-ups.",
  landing_page: "A single focused page for a campaign, event or launch.",
  budget_request: "Costed proposals and budget planning for a piece of work.",
};
