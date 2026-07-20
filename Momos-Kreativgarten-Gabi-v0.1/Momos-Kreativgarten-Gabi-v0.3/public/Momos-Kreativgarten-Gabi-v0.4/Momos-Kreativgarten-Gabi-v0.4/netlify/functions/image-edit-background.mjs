import { getStore } from "@netlify/blobs";

const store = () => getStore("momo-images", { consistency: "strong" });
const prompts = {
  "Störendes Objekt entfernen": detail => `Entferne ausschließlich folgendes störende Objekt aus dem Foto: ${detail}. Rekonstruiere den verdeckten Hintergrund natürlich und unauffällig. Bewahre alle anderen Personen, Tiere, Gegenstände, Bildausschnitt, Beleuchtung und Farben so genau wie möglich.`,
  "Fremde Person entfernen": detail => `Entferne ausschließlich folgende Person oder Personen aus dem Foto: ${detail}. Rekonstruiere den verdeckten Hintergrund natürlich. Verändere die übrigen Personen, Gesichter, Tiere, Gegenstände, Beleuchtung und den Bildausschnitt nicht.`,
  "Hintergrund entfernen": () => "Entferne den gesamten Hintergrund sauber und mache ihn vollständig transparent. Erhalte das Hauptmotiv mit natürlichen, sauberen Kanten und allen feinen Details. Verändere das Hauptmotiv nicht.",
  "Hintergrund ersetzen": detail => `Ersetze ausschließlich den Hintergrund durch: ${detail}. Erhalte das Hauptmotiv, alle Gesichter, Körper, Kleidung und Details unverändert. Passe Licht und Übergänge realistisch an.`,
  "Eigene Änderung": detail => `${detail}. Bearbeite nur das ausdrücklich Gewünschte und bewahre alle übrigen Bildinhalte, Gesichter, Proportionen, Farben und den Bildausschnitt so genau wie möglich.`
};

export default async request => {
  let body;
  try { body = await request.json(); } catch { return; }
  const jobId = String(body.jobId || "");
  const action = String(body.action || "");
  const instruction = String(body.instruction || "").trim().slice(0, 1200);
  const match = String(body.image || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!/^[a-f0-9-]{20,60}$/i.test(jobId) || !match || !prompts[action] || (!instruction && action !== "Hintergrund entfernen")) return;
  const images = store();
  try {
    const apiKey = Netlify.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("Der OpenAI-Schlüssel fehlt in Netlify.");
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.byteLength > 5_000_000) throw new Error("Das Foto ist trotz Verkleinerung noch zu groß.");
    const mime = match[1];
    const valid = mime === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
      : mime === "image/png"
        ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    if (!valid) throw new Error("Das hochgeladene Foto ist unvollständig. Bitte wähle es erneut aus.");
    const width = Number(body.width) || 1, height = Number(body.height) || 1;
    const size = height > width * 1.2 ? "1024x1536" : width > height * 1.2 ? "1536x1024" : "1024x1024";
    const transparent = action === "Hintergrund entfernen";
    const form = new FormData();
    form.set("model", "gpt-image-2");
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    form.set("image", new File([bytes], `foto.${extension}`, { type:mime }));
    form.set("prompt", prompts[action](instruction));
    form.set("quality", "medium");
    form.set("size", size);
    form.set("input_fidelity", "high");
    form.set("output_format", transparent ? "png" : "jpeg");
    if (!transparent) form.set("output_compression", "78");
    const response = await fetch("https://api.openai.com/v1/images/edits", { method:"POST", headers:{ authorization:`Bearer ${apiKey}` }, body:form });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "OpenAI konnte das Foto nicht bearbeiten.");
    const image = data?.data?.[0]?.b64_json;
    if (!image) throw new Error("OpenAI hat keine Bilddatei geliefert.");
    await images.setJSON(jobId, { state:"done", image:`data:image/${transparent ? 'png' : 'jpeg'};base64,${image}` });
  } catch (error) {
    await images.setJSON(jobId, { state:"error", error:error?.message || "Die Fotobearbeitung ist fehlgeschlagen." });
  }
};
