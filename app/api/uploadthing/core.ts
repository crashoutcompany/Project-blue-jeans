import { createUploadthing, type FileRouter } from "uploadthing/next";

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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
