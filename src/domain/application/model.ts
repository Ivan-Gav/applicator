export type ApplicationStatus =
  | "draft"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type Application = {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  appliedAt: Date | null;
  lastContactAt: Date | null;
};
