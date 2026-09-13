export interface ApplicationRepository {
  // Backs autocomplete: company and source are free text, not lookup tables.
  distinctValues(field: "companyName" | "source"): Promise<string[]>;
}
