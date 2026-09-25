import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Single-user album store for the Bun demo. Generated PNGs live in Convex
 * file storage (far too large for documents); this table holds metadata
 * plus a pointer to the stored file. Run `bunx convex dev` in
 * examples/demo once to push this schema and generate ./_generated.
 */
export default defineSchema({
  images: defineTable({
    prompt: v.string(),
    model: v.string(),
    size: v.string(),
    revisedPrompt: v.optional(v.string()),
    fileId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),
});
