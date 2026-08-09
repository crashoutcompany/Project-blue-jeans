import { createUploadthing, type FileRouter } from "uploadthing/next";

import { isAdminUser } from "@/lib/auth/admin";
import { auth } from "@/lib/auth/server";

const f = createUploadthing();

export const ourFileRouter = {
  closetImage: f(
    {
      image: { maxFileSize: "8MB", maxFileCount: 8 },
    },
    /** Don’t block the browser on `onUploadComplete` (avoids dev/callback timing stalls). */
    { awaitServerData: false }
  )
    .middleware(async () => {
      const { data } = await auth.getSession();
      if (!data?.user) {
        throw new Error("Unauthorized");
      }
      if (!isAdminUser(data.user)) {
        throw new Error("Forbidden");
      }
      return { source: "closet" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.info("[uploadthing] closet upload complete", {
        key: file.key,
        ufsUrl: file.ufsUrl,
        source: metadata.source,
      });
      return { source: metadata.source };
    }),

  wearerPhoto: f(
    {
      image: { maxFileSize: "8MB", maxFileCount: 1 },
    },
    { awaitServerData: false },
  )
    .middleware(async () => {
      const { data } = await auth.getSession();
      if (!data?.user) {
        throw new Error("Unauthorized");
      }
      if (!isAdminUser(data.user)) {
        throw new Error("Forbidden");
      }
      return { source: "wearer" as const };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.info("[uploadthing] wearer photo upload complete", {
        key: file.key,
        ufsUrl: file.ufsUrl,
        source: metadata.source,
      });
      return { source: metadata.source };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
