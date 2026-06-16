import { err, json } from "../../_utils";

export const onRequestGet: PagesFunction = async (ctx) => {
  const slug = String(ctx.params.slug || "").toLowerCase();
  const row = await ctx.env.DB.prepare(
    "SELECT slug, rows_json, created_at FROM shared_summaries WHERE slug = ?"
  ).bind(slug).first<{ slug: string; rows_json: string; created_at: string }>();
  if (!row) return err("Summary not found.", 404);
  return json({ slug: row.slug, rows: JSON.parse(row.rows_json), created_at: row.created_at });
};
