import { NextResponse } from "next/server";
import { requireUser } from "@/app/auth/_utils/require-user";

/**
 * The signed-in user as the API sees it. Route handlers are independent HTTP
 * entry points that no layout covers, so the check is the first statement.
 */
export async function GET() {
  const user = await requireUser();

  return NextResponse.json({ id: user.id, email: user.email });
}
