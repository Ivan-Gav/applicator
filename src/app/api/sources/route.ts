import { type NextRequest, NextResponse } from "next/server";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { sourceSearchParam } from "@/app/routes";
import { knownSources } from "@/domain/source/known-sources";
import { suggestSources } from "@/domain/source/rules";

/** Sources the source field offers for one search. */
const shownSources = 8;

/** The known sources and the user's own matching `q`, best first. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  const search = request.nextUrl.searchParams.get(sourceSearchParam) ?? "";
  const repository = await applicationRepositoryForRequest();
  const used = await repository.distinctValues(user.id, "source");

  return NextResponse.json(suggestSources(knownSources, used, search, shownSources));
}
