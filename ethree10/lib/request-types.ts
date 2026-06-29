/**
 * Single source of truth for the agency's two departments and the client-facing request
 * "Task Type" catalog. Shared by the request form (grouped picker), the request-create
 * service (self-routing), the DB seed, and agency workspace creation so they never drift.
 */

export const DEPARTMENT_SLUGS = {
  creative: "creative",
  productDevelopment: "product-development",
} as const;

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[keyof typeof DEPARTMENT_SLUGS];

/** The two fixed departments seeded into every agency workspace. */
export const DEFAULT_DEPARTMENTS: Array<{
  name: string;
  slug: DepartmentSlug;
  description: string;
  color: string;
}> = [
  {
    name: "Creative",
    slug: DEPARTMENT_SLUGS.creative,
    description: "Media, content, video, graphics, social, and branding.",
    color: "#22D3A5",
  },
  {
    name: "Product Development",
    slug: DEPARTMENT_SLUGS.productDevelopment,
    description: "Websites, apps, and software tools.",
    color: "#6366F1",
  },
];

export interface TaskType {
  /** Stable key stored in Request.projectType. */
  value: string;
  label: string;
  departmentSlug: DepartmentSlug;
  /** "Other (describe)" options reveal a free-text field on the form. */
  isOther?: boolean;
}

export interface TaskTypeGroup {
  department: string;
  departmentSlug: DepartmentSlug;
  options: TaskType[];
}

export const TASK_TYPE_GROUPS: TaskTypeGroup[] = [
  {
    department: "Creative",
    departmentSlug: DEPARTMENT_SLUGS.creative,
    options: [
      { value: "graphic_design", label: "Graphic Design", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "video_production", label: "Video Production / Editing", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "photography", label: "Photography", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "content_copywriting", label: "Content / Copywriting", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "social_media", label: "Social Media Management", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "branding", label: "Branding & Identity", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "branded_email", label: "Branded Email / Newsletter", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "flyer_poster", label: "Flyer / Poster / Banner", departmentSlug: DEPARTMENT_SLUGS.creative },
      { value: "creative_other", label: "Other (describe)", departmentSlug: DEPARTMENT_SLUGS.creative, isOther: true },
    ],
  },
  {
    department: "Product Development",
    departmentSlug: DEPARTMENT_SLUGS.productDevelopment,
    options: [
      { value: "website", label: "Website", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "web_application", label: "Web Application", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "mobile_app", label: "Mobile App", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "ui_ux_design", label: "UI/UX Design", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "software_automation", label: "Software / Automation Tool", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "survey_form", label: "Survey / Form", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "registration_qr", label: "Registration Link / QR Code", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "budget_request", label: "Budget Request", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "landing_page", label: "Landing Page", departmentSlug: DEPARTMENT_SLUGS.productDevelopment },
      { value: "product_other", label: "Other (describe)", departmentSlug: DEPARTMENT_SLUGS.productDevelopment, isOther: true },
    ],
  },
];

export const TASK_TYPES: TaskType[] = TASK_TYPE_GROUPS.flatMap((g) => g.options);

const TASK_TYPE_BY_VALUE = new Map(TASK_TYPES.map((t) => [t.value, t]));

export function getTaskType(value: string): TaskType | undefined {
  return TASK_TYPE_BY_VALUE.get(value);
}

/** Department slug a request should route to, or null if the type isn't in the catalog. */
export function departmentSlugForTaskType(value: string): DepartmentSlug | null {
  return TASK_TYPE_BY_VALUE.get(value)?.departmentSlug ?? null;
}

/** Human label for a stored task-type value; falls back to the raw value (legacy data). */
export function labelForTaskType(value: string): string {
  return TASK_TYPE_BY_VALUE.get(value)?.label ?? value;
}

export function isOtherTaskType(value: string): boolean {
  return TASK_TYPE_BY_VALUE.get(value)?.isOther ?? false;
}
