const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export default async (request) => {
  const token = Netlify.env.get("REPLICATE_API_TOKEN");
  if (!token) return json({ error: "Für Momos Songstudio fehlt noch REPLICATE_API_TOKEN in Netlify." }, 503);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-z0-9]{10,80}$/i.test(id)) return json({ error: "Ungültiger Musikauftrag." }, 400);

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.detail || data?.error || "Der Musikstatus ist nicht erreichbar.");
    const outputs = Array.isArray(data.output) ? data.output : data.output ? [data.output] : [];
    return json({ status: data.status, audio: outputs[0] || null, error: data.error || null });
  } catch (error) {
    return json({ error: error?.message || "Die Cloud-GPU ist gerade nicht erreichbar." }, 502);
  }
};
