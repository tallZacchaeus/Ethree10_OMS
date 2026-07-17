import { router } from "../trpc";
import { authRouter } from "./auth";
import { organizationsRouter } from "./organizations";
import { teamsRouter } from "./teams";
import { subunitsRouter } from "./subunits";
import { membersRouter } from "./members";
import { requestsRouter } from "./requests";
import { projectsRouter } from "./projects";
import { tasksRouter } from "./tasks";
import { leadsRouter } from "./leads";
import { auditRouter } from "./audit";
import { notificationsRouter } from "./notifications";
import { integrationsRouter } from "./integrations";
import { reportsRouter } from "./reports";
import { dashboardRouter } from "./dashboard";
import { proposalsRouter } from "./proposals";
import { approvalRulesRouter } from "./approvalRules";
import { templatesRouter } from "./templates";
import { timeLogsRouter } from "./timeLogs";
import { scorecardsRouter } from "./scorecards";
import { whatsappRouter } from "./whatsapp";
import { preferencesRouter } from "./preferences";
import { cmsRouter } from "./cms";
import { invoicesRouter } from "./invoices";
import { receiptsRouter } from "./receipts";
import { analyticsRouter } from "./analytics";
import { sponsorshipsRouter } from "./sponsorships";
import { setupRouter } from "./setup";
import { trackRouter } from "./track";
import { servicesRouter } from "./services";

export const appRouter = router({
  auth: authRouter,
  organizations: organizationsRouter,
  teams: teamsRouter,
  subunits: subunitsRouter,
  members: membersRouter,
  requests: requestsRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  leads: leadsRouter,
  audit: auditRouter,
  notifications: notificationsRouter,
  integrations: integrationsRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  proposals: proposalsRouter,
  approvalRules: approvalRulesRouter,
  templates: templatesRouter,
  timeLogs: timeLogsRouter,
  scorecards: scorecardsRouter,
  whatsapp: whatsappRouter,
  preferences: preferencesRouter,
  cms: cmsRouter,
  invoices: invoicesRouter,
  receipts: receiptsRouter,
  analytics: analyticsRouter,
  sponsorships: sponsorshipsRouter,
  setup: setupRouter,
  track: trackRouter,
  services: servicesRouter,
});

export type AppRouter = typeof appRouter;
