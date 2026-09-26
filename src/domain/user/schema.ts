import { z } from "zod";

// No display text here: the domain says *that* an address is invalid, the UI
// message catalogue says how to put it to the user.
export const emailSchema = z.string().trim().pipe(z.email());

export const signInSchema = z.object({ email: emailSchema });
export type SignInInput = z.infer<typeof signInSchema>;
