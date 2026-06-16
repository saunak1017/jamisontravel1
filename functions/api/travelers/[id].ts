import { err, json, readJson } from "../../_utils";

export const onRequestPut: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  const body = await readJson<{ name?: string; color?: string | null }>(ctx.request);
  const name = (body.name || "").trim();
  if (!name) return err("Name is required.");
  const r = await ctx.env.DB.prepare("UPDATE travelers SET name = ?, color = ? WHERE id = ?").bind(name, body.color || "sky", id).run();
  if (r.meta.changes === 0) return err("Traveler not found.", 404);
  const { results } = await ctx.env.DB.prepare("SELECT id, name, color, created_at FROM travelers WHERE id = ?").bind(id).all();
  return json(results[0]);
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  await ctx.env.DB.prepare("DELETE FROM travelers WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
