import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("images").withIndex("by_created").order("desc").collect();
    return Promise.all(
      docs.map(async (doc) => ({ ...doc, url: await ctx.storage.getUrl(doc.fileId) })),
    );
  },
});

export const save = mutation({
  args: {
    data: v.bytes(),
    prompt: v.string(),
    model: v.string(),
    size: v.string(),
    revisedPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const fileId = await ctx.storage.store(new Blob([args.data], { type: "image/png" }));
    const id = await ctx.db.insert("images", {
      prompt: args.prompt,
      model: args.model,
      size: args.size,
      revisedPrompt: args.revisedPrompt,
      fileId,
      createdAt: Date.now(),
    });
    return { id, url: await ctx.storage.getUrl(fileId) };
  },
});

export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.storage.delete(doc.fileId);
    await ctx.db.delete(args.id);
  },
});
