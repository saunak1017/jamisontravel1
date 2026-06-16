import { err, json, nowISO, readJson, uid } from "../../_utils";

export const onRequestGet: PagesFunction = async (ctx) => {
  const { results } = await ctx.env.DB.prepare("SELECT id, name, created_at FROM trips ORDER BY name COLLATE NOCASE").all();
  return json(results);
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const body = await readJson<{ name?: string }>(ctx.request);
  const name = (body.name || "").trim();
  if (!name) return err("Trip name is required.");
  const id = uid();
  const created_at = nowISO();
  await ctx.env.DB.prepare("INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)").bind(id, name, created_at).run();
  return json({ id, name, created_at }, { status: 201 });
};
