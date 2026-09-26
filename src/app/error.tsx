"use client";

import { isAuthUnavailable } from "@/app/auth/_utils/auth-unavailable-error";
import { ErrorScreen } from "@/ui/errors/ErrorScreen";

// Catches what the (protected) layout throws, which a boundary inside that
// group could not: a layout's errors go to the boundary of the segment above.
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorScreen authUnavailable={isAuthUnavailable(error)} retry={retry} />;
}
