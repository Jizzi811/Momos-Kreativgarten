import { getStore } from "@netlify/blobs";

const store = () => getStore("momo-images", { consistency: "strong" });

export default async (request) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return;
  }

  const jobId = String(body.jobId || "");
  const prompt = String(body.prompt || "").trim().slice(0, 7000);
  const format = String(body.format || "").toLowerCase();
  if (!/^[a-f0-9-]{20,60}$/i.test(jobId) || !prompt) return;

  const images = store();
  try {
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Der OpenAI-Schlüssel fehlt in Netlify.");

    const size = format.includes("hoch") || format.includes("story")
      ? "1024x1536"
      : format.includes("quer")
        ? "1536x1024"
        : "1024x1024";

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt,
        quality: "medium",
        size,
        output_format: "jpeg",
        output_compression: 72,
        n: 1
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenAI konnte das Bild nicht erstellen.");
    }

    const image = data?.data?.[0]?.b64_json;
    if (!image) throw new Error("OpenAI hat keine Bilddatei geliefert.");
    await images.setJSON(jobId, {
      state: "done",
      image: `data:image/jpeg;base64,${image}`
    });
  } catch (error) {
    await images.setJSON(jobId, {
      state: "error",
      error: error?.message || "Die Bilderstellung ist fehlgeschlagen."
    });
  }
};
