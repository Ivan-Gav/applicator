import { headers } from "next/headers";
import { requestedPathHeader } from "@/app/routes";
import { sameSitePath } from "@/lib/same-site-path";

/** The path and query of the current request, as the proxy recorded it. */
export async function requestedPath(): Promise<string | null> {
  return sameSitePath((await headers()).get(requestedPathHeader));
}
