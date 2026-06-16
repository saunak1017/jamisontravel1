import { err, json, nowISO, readJson, uid } from "../../_utils";

export const onRequestGet: PagesFunction = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    "SELECT id, name, color, created_at FROM travelers ORDER BY name COLLATE NOCASE"
  ).all();
  return json(results);
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const body = await readJson<{ name?: string; color?: string }>(ctx.request);
  const name = (body.name || "").trim();
  if (!name) return err("Name is required.");
  const id = uid();
  const created_at = nowISO();
  await ctx.env.DB.prepare("INSERT INTO travelers (id, name, color, created_at) VALUES (?, ?, ?, ?)")
    .bind(id, name, body.color || "sky", created_at)
    .run();
  return json({ id, name, color: body.color || "sky", created_at }, { status: 201 });
};
