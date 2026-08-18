import { NextRequest } from "next/server";
import { connection } from "next/server";
import { createRouteHandler } from "uploadthing/next";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import { ourFileRouter } from "./core";

async function handle(request: NextRequest) {
  await connection();
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    return Response.json(
      { message: gate.message },
      { status: gate.status },
    );
  }

  const resolved = await resolveUploadThingToken(
    gate.userId,
    gate.membership,
  );
  if (!resolved.ok) {
    return Response.json({ message: resolved.message }, { status: 409 });
  }

  const handler = createRouteHandler({
    router: ourFileRouter,
    config: { token: resolved.token },
  });

  if (request.method === "GET") {
    return handler.GET(request);
  }
  return handler.POST(request);
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
