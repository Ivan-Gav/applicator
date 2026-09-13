export const applicationStatuses = [
  "draft",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const seniorities = ["junior", "mid", "senior", "lead"] as const;
export type Seniority = (typeof seniorities)[number];

export const workModes = ["on_site", "hybrid", "remote"] as const;
export type WorkMode = (typeof workModes)[number];

export const channels = ["direct", "agency", "referral"] as const;
export type Channel = (typeof channels)[number];

export const salaryPeriods = ["year", "month", "day", "hour"] as const;
export type SalaryPeriod = (typeof salaryPeriods)[number];

/**
 * Encoding convention, so that no extra flags are needed:
 *   exact figure  -> min = max
 *   range         -> both set
 *   "from 60k"    -> min set, max null
 *   "up to 80k"   -> min null, max set
 *   unknown       -> both null
 */
export type SalaryRange = {
  min: number | null;
  max: number | null;
};

export type Salary = {
  posted: SalaryRange;
  asked: SalaryRange;
  target: SalaryRange;
  currency: string | null;
  period: SalaryPeriod | null;
};

// One contact per application; every part may be unknown.
export type Contact = {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  url: string | null;
};

export type Application = {
  id: string;
  companyName: string;
  positionTitle: string;
  seniority: Seniority | null;
  city: string | null;
  country: string | null;
  workMode: WorkMode | null;
  channel: Channel;
  source: string | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  status: ApplicationStatus;
  appliedAt: Date | null;
  lastContactAt: Date | null;
  salary: Salary;
  contact: Contact;
  notes: string | null;
  archivedAt: Date | null;
};
