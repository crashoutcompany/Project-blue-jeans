import { after } from "next/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";

import { assertAdmittedSession } from "@/lib/auth/admitted";
import {
  consumeUploadIntent,
  cleanupExpiredUnclaimedUploads,
  createUploadIntent,
  type MediaKind,
  type UploadEndpoint,
} from "@/lib/media/intents";
import { resolveUploadSession } from "@/lib/media/resolve-upload-session";
import { sealLegacyUploadThingMedia } from "@/lib/media/seal-legacy";
import { logServerError } from "@/lib/server/safe-client-error";

const f = createUploadthing();

const PRIVATE_IMAGE = {
  image: { maxFileSize: "8MB" as const, maxFileCount: 24, acl: "private" as const },
};

async function uploadMiddleware(endpoint: UploadEndpoint) {
  const gate = await assertAdmittedSession();
  if (!gate.ok) {
    throw new Error(gate.message);
  }

  const session = await resolveUploadSession(gate.userId, gate.membership);
  if (!session.ok) {
    throw new Error(session.message);
  }

  after(() =>
    Promise.all([
      sealLegacyUploadThingMedia(gate.userId).catch((error) => {
        logServerError("sealLegacyUploadThingMedia", error);
      }),
      cleanupExpiredUnclaimedUploads(
        new Map([[gate.userId, gate.membership]]),
      ).catch((error) => {
        logServerError("cleanupExpiredUnclaimedUploads", error);
      }),
    ]),
  );

  const { intentId } = await createUploadIntent({
    userId: gate.userId,
    connectionId: session.connectionId,
    endpoint,
  });

  return {
    userId: gate.userId,
    intentId,
    connectionId: session.connectionId,
    source: endpoint === "closetImage" ? ("closet" as const) : ("wearer" as const),
  };
}

async function completeUpload(input: {
  userId: string;
  intentId: string;
  fileKey: string;
  kind: MediaKind;
}): Promise<{ mediaAssetId: string }> {
  const consumed = await consumeUploadIntent({
    intentId: input.intentId,
    userId: input.userId,
    fileKey: input.fileKey,
    kind: input.kind,
  });
  if (!consumed) {
    throw new Error("That upload could not be recorded.");
  }
  return consumed;
}

export const ourFileRouter = {
  closetImage: f(PRIVATE_IMAGE, { awaitServerData: true })
    .middleware(async () => uploadMiddleware("closetImage"))
    .onUploadComplete(async ({ metadata, file }) => {
      return completeUpload({
        userId: metadata.userId,
        intentId: metadata.intentId,
        fileKey: file.key,
        kind: "closet_image",
      });
    }),

  wearerPhoto: f(
    {
      image: { maxFileSize: "8MB", maxFileCount: 1, acl: "private" },
    },
    { awaitServerData: true },
  )
    .middleware(async () => uploadMiddleware("wearerPhoto"))
    .onUploadComplete(async ({ metadata, file }) => {
      return completeUpload({
        userId: metadata.userId,
        intentId: metadata.intentId,
        fileKey: file.key,
        kind: "wearer_photo",
      });
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
