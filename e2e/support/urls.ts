import { routes } from "@/app/routes";

/**
 * A toHaveURL predicate matching a path built by the app's own route helpers,
 * query string included, regardless of the origin under test.
 */
export function isAt(path: string): (url: URL) => boolean {
  return (url) => `${url.pathname}${url.search}` === path;
}

/** The magic link callback with the query Supabase would append. */
export function authCallbackPath(params: Record<string, string>): string {
  return `${routes.authCallback}?${new URLSearchParams(params).toString()}`;
}
