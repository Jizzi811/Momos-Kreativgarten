const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Nur POST ist erlaubt." }, 405);
  const token = Netlify.env.get("REPLICATE_API_TOKEN");
  if (!token) return json({ error: "Für Momos Songstudio fehlt noch REPLICATE_API_TOKEN in Netlify." }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Ungültige Musikanfrage." }, 400); }

  const prompt = String(body.prompt || "").trim().slice(0, 512);
  const lyrics = String(body.lyrics || "").trim().slice(0, 4096);
  const duration = Math.max(30, Math.min(120, Number(body.duration) || 60));
  if (!prompt || !lyrics) return json({ error: "Momo braucht eine Musikidee und einen Liedtext." }, 400);

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        version: "74e3a7d383b18815e277de5223f5fe9d53d38832de15aa567fe729fa129d0d85",
        input: {
          prompt,
          lyrics,
          duration,
          thinking: true,
          batch_size: 1,
          audio_format: "mp3",
          inference_steps: 8,
          shift: 3
        }
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.detail || data?.error || "Replicate konnte den Musikauftrag nicht starten.");
    return json({ id: data.id, status: data.status });
  } catch (error) {
    return json({ error: error?.message || "Die Cloud-GPU ist gerade nicht erreichbar." }, 502);
  }
};
