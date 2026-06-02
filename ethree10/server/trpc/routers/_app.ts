import { router } from "../trpc";
import { authRouter } from "./auth";
import { workspacesRouter } from "./workspaces";
import { departmentsRouter } from "./departments";
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
import { analyticsRouter } from "./analytics";
import { sponsorshipsRouter } from "./sponsorships";

export const appRouter = router({
  auth: authRouter,
  workspaces: workspacesRouter,
  departments: departmentsRouter,
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
  analytics: analyticsRouter,
  sponsorships: sponsorshipsRouter,
});

export type AppRouter = typeof appRouter;
