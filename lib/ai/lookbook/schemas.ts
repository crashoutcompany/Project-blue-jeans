import { z } from "zod";

const lookSchema = z.object({
  title: z.string().max(120),
  description: z.string().max(500),
  tags: z.array(z.string().max(40)).min(1).max(5),
  garmentIds: z.array(z.string().uuid()).min(1).max(14),
});

export function createLookbookSchema(lookCount: number) {
  return z.object({
    looks: z.array(lookSchema).length(lookCount),
    curatorNote: z.string().max(600).optional(),
  });
}

export type LookbookPlan = z.infer<ReturnType<typeof createLookbookSchema>>;
