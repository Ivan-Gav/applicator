import { z } from "zod";
import type { CityMatch } from "./model";

/** A city search's answer, as it arrives over the wire. */
export const cityMatchesSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    region: z.string().nullable(),
    district: z.string().nullable(),
    matchedName: z.string().nullable(),
  }) satisfies z.ZodType<CityMatch>,
);
