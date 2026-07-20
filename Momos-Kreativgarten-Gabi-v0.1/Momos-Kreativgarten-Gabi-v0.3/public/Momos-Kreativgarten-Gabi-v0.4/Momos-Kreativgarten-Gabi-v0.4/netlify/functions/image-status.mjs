import { getStore } from "@netlify/blobs";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

export default async (request) => {
  const jobId = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-f0-9-]{20,60}$/i.test(jobId)) {
    return json({ state: "error", error: "Ungültige Bildanfrage." }, 400);
  }

  const images = getStore("momo-images", { consistency: "strong" });
  const result = await images.get(jobId, { type: "json" });
  if (!result) return json({ state: "pending" });
  await images.delete(jobId);
  return json(result);
};
