import { z } from "zod";
import { blankToNull } from "@/lib/blank-to-null";
import { documentLanguages, documentTypes } from "./model";

/** The names of the upload form's fields, as the upload actions read them. */
export const documentFormField = {
  file: "file",
  type: "type",
  title: "title",
  language: "language",
  label: "label",
} as const;

export const documentTitleSchema = z.string().trim().min(1).max(200);

export const versionLabelSchema = z.preprocess(
  blankToNull,
  z.string().trim().min(1).max(100).nullable(),
);

export const documentDetailsSchema = z.object({
  type: z.enum(documentTypes),
  title: documentTitleSchema,
  language: z.preprocess(blankToNull, z.enum(documentLanguages).nullable()),
});

export const documentIdSchema = z.uuid();
