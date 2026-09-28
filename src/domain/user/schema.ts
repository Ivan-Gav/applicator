import { z } from "zod";

export const emailSchema = z.string().trim().pipe(z.email());

export const signInSchema = z.object({ email: emailSchema });
export type SignInInput = z.infer<typeof signInSchema>;
