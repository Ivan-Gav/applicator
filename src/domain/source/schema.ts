import { z } from "zod";

/** A source search's answer, as it arrives over the wire. */
export const sourceSuggestionsSchema = z.array(z.string());
