const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async request => {
  const token = Netlify.env.get("UDIOAPI_PRO_KEY");
  if (!token) return json({ error: "Für Momos Songstudio fehlt noch UDIOAPI_PRO_KEY in Netlify." }, 503);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[a-z0-9_-]{6,160}$/i.test(id)) return json({ error: "Ungültiger Musikauftrag." }, 400);
  try {
    const response = await fetch(`https://udioapi.pro/api/v2/feed?workId=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || data?.error || "Der Musikstatus ist nicht erreichbar.");
    const tracks = Array.isArray(data?.data?.response_data) ? data.data.response_data : [];
    const ready = tracks.find(track => track?.audio_url && /complete|success|finished/i.test(track?.status || "")) || tracks.find(track => track?.audio_url);
    const failed = tracks.find(track => /fail|error|cancel/i.test(track?.status || ""));
    if (failed) return json({ status: "failed", error: failed.fail_message || "Die Musikerstellung wurde beendet." });
    if (ready) return json({ status: "succeeded", audio: ready.audio_url, title: ready.title || "Momos Lied" });
    return json({ status: "processing" });
  } catch (error) { return json({ error: error?.message || "Der Musikdienst ist gerade nicht erreichbar." }, 502); }
};
