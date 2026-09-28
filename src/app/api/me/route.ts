import { NextResponse } from "next/server";
import { requireUser } from "@/app/auth/_utils/require-user";

export async function GET() {
  const user = await requireUser();

  return NextResponse.json({ id: user.id, email: user.email });
}
