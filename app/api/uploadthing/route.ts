import { NextRequest } from "next/server";
import { connection } from "next/server";
import { createRouteHandler } from "uploadthing/next";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import { resolveUploadThingToken } from "@/lib/credentials/resolve";
import {
  isUploadThingServerHook,
  resolveUploadThingHookToken,
} from "@/lib/media/uploadthing-hook";
import { ourFileRouter } from "./core";

function runUploadThingHandler(request: NextRequest, token: string) {
  const handler = createRouteHandler({
    router: ourFileRouter,
    config: { token },
  });
  if (request.method === "GET") {
    return handler.GET(request);
  }
  return handler.POST(request);
}

async function handle(request: NextRequest) {
  await connection();

  if (isUploadThingServerHook(request)) {
    const resolved = await resolveUploadThingHookToken(request);
    if (!resolved.ok) {
      return Response.json({ message: resolved.message }, { status: 401 });
    }
    return runUploadThingHandler(request, resolved.token);
  }

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

  return runUploadThingHandler(request, resolved.token);
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}
