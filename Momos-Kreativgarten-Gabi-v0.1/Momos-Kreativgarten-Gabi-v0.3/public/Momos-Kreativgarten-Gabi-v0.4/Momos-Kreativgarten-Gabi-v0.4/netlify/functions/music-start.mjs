const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const messageFrom = data => data?.message || data?.error || data?.msg || "udioapi.pro konnte den Musikauftrag nicht starten.";

export default async request => {
  if (request.method !== "POST") return json({ error: "Nur POST ist erlaubt." }, 405);
  const token = Netlify.env.get("UDIOAPI_PRO_KEY");
  if (!token) return json({ error: "Für Momos Songstudio fehlt noch UDIOAPI_PRO_KEY in Netlify." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Ungültige Musikanfrage." }, 400); }
  const style = String(body.prompt || "").trim().slice(0, 1000);
  const lyrics = String(body.lyrics || "").trim().slice(0, 5000);
  const title = String(body.title || "Momos Lied").trim().slice(0, 100) || "Momos Lied";
  const instrumental = lyrics === "[Instrumental]";
  if (!style) return json({ error: "Momo braucht eine Musikidee." }, 400);
  try {
    const response = await fetch("https://udioapi.pro/api/v2/generate", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "chirp-v3-5", prompt: instrumental ? "" : lyrics, style, title, make_instrumental: instrumental })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (data?.code && Number(data.code) >= 400)) throw new Error(messageFrom(data));
    const id = data?.workId || data?.data?.task_id || data?.data?.workId || data?.task_id;
    if (!id) throw new Error("udioapi.pro hat keine Auftragsnummer zurückgegeben.");
    return json({ id, status: "processing", provider: "udioapi.pro" });
  } catch (error) { return json({ error: error?.message || "Der Musikdienst ist gerade nicht erreichbar." }, 502); }
};
