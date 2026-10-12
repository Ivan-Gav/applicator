import { type NextRequest, NextResponse } from "next/server";
import { geonamesCityIndex } from "@/adapters/geonames/cities";
import { requireUser } from "@/app/auth/_utils/require-user";
import { citySearchParam } from "@/app/routes";
import { searchCities } from "@/domain/city/search";

/** Cities the city field offers for one search. */
const shownCities = 8;

/** The cities of the reference list matching `q`, best first; the list itself stays here. */
export async function GET(request: NextRequest) {
  await requireUser();
  const search = request.nextUrl.searchParams.get(citySearchParam) ?? "";

  return NextResponse.json(searchCities(geonamesCityIndex(), search, shownCities));
}
