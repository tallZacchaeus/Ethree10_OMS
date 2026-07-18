/**
 * Single source of truth for the agency's two teams and the client-facing request
 * "Task Type" catalog. Shared by the request form (grouped picker), the request-create
 * service (self-routing), the DB seed, and agency creation so they never drift.
 */

export const TEAM_SLUGS = {
  brandsCommunications: "brands-communications",
  productDevelopment: "product-development",
} as const;

export type TeamSlug = (typeof TEAM_SLUGS)[keyof typeof TEAM_SLUGS];

/** The two fixed teams seeded into the agency. */
export const DEFAULT_TEAMS: Array<{
  name: string;
  slug: TeamSlug;
  description: string;
  color: string;
}> = [
  {
    name: "Brands & Communications",
    slug: TEAM_SLUGS.brandsCommunications,
    description: "Media, content, video, graphics, social, and branding.",
    color: "#22D3A5",
  },
  {
    name: "Product Development",
    slug: TEAM_SLUGS.productDevelopment,
    description: "Websites, apps, and software tools.",
    color: "#6366F1",
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
