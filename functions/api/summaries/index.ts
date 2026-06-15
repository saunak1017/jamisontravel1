import { err, json, nowISO, readJson } from "../../_utils";

type SummaryRow = {
  passenger: string;
  flight_number: string;
  airline: string;
  dep_airport: string;
  arr_airport: string;
  dep_date: string;
  dep_time: string;
  arr_date: string;
  arr_time: string;
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const body = await readJson<{ slug?: string; rows?: SummaryRow[] }>(ctx.request);
  const slug = (body.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return err("Slug must be 1–60 lowercase letters, numbers, or single hyphens.");
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) return err("Select at least one flight.");

  const created_at = nowISO();
  try {
    await ctx.env.DB.prepare("INSERT INTO shared_summaries (slug, rows_json, created_at) VALUES (?, ?, ?)")
      .bind(slug, JSON.stringify(body.rows), created_at)
      .run();
  } catch {
    return err("That summary slug is already in use.", 409);
  }
  return json({ slug, rows: body.rows, created_at }, { status: 201 });
};
