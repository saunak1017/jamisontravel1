import { err, json, readJson } from "../../_utils";

export const onRequestPut: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  const body = await readJson<{ name?: string }>(ctx.request);
  const name = (body.name || "").trim();
  if (!name) return err("Trip name is required.");
  const r = await ctx.env.DB.prepare("UPDATE trips SET name = ? WHERE id = ?").bind(name, id).run();
  if (r.meta.changes === 0) return err("Trip not found.", 404);
  const { results } = await ctx.env.DB.prepare("SELECT id, name, created_at FROM trips WHERE id = ?").bind(id).all();
  return json(results[0]);
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const id = ctx.params.id as string;
  await ctx.env.DB.prepare("UPDATE bookings SET trip_id = NULL WHERE trip_id = ?").bind(id).run();
  await ctx.env.DB.prepare("DELETE FROM trips WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
