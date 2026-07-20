const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export default async () => {
  const token = Netlify.env.get("UDIOAPI_PRO_KEY");
  if (!token) return json({ configured: false });
  try {
    const response = await fetch("https://udioapi.pro/api/v2/credits", { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error();
    const credits = data?.data?.credits ?? data?.data?.balance ?? data?.credits ?? data?.balance;
    return json({ configured: true, credits: Number.isFinite(Number(credits)) ? Number(credits) : null });
  } catch { return json({ configured: true, credits: null }); }
};
