const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const resultWatcher = new MutationObserver(() => {
  if (current !== 'card' || $('#result').classList.contains('hidden')) return;
  if (!$('#makeImage')) {
    $('#result').insertAdjacentHTML(
      'beforeend',
      '<button id="makeImage" class="image-action" onclick="makeCardImage()">Jetzt das fertige Bild erstellen 🎨</button><div id="imageResult" class="image-result"></div>'
    );
  }
});
resultWatcher.observe($('#result'), { attributes: true, attributeFilter: ['class'] });

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Momo hat eine unvollständige Antwort erhalten. Bitte noch einmal versuchen.');
  }
}

async function createImage(prompt, format, box) {
  const jobId = crypto.randomUUID();
  const start = await fetch('/api/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jobId, prompt, format })
  });
  if (!start.ok) throw new Error('Momo konnte den Malauftrag nicht starten.');

  for (let attempt = 0; attempt < 150; attempt += 1) {
    await wait(2000);
    const response = await fetch(`/api/image-status?id=${encodeURIComponent(jobId)}`, {
      cache: 'no-store'
    });
    const data = await readJson(response);
    if (!response.ok || data.state === 'error') {
      throw new Error(data.error || 'Die Bilderstellung ist fehlgeschlagen.');
    }
    if (data.state === 'done' && data.image) {
      box.innerHTML = `<img src="${data.image}" alt="Von Momo erstelltes Bild"><a class="download" href="${data.image}" download="momos-bild.jpg">Bild herunterladen</a>`;
      return;
    }
    if (attempt === 14) {
      box.innerHTML = '<div class="image-wait">Momo malt noch – aufwendige Bilder brauchen manchmal etwas länger. 🌿</div>';
    }
  }
  throw new Error('Das Bild braucht ungewöhnlich lange. Bitte später noch einmal versuchen.');
}

async function makeCardImage() {
  const button = $('#makeImage');
  const box = $('#imageResult');
  const format = new FormData($('#form')).get('format') || 'Quadratisch';
  button.disabled = true;
  button.textContent = 'Momo malt deine Karte …';
  box.innerHTML = '<div class="image-wait">Momo malt im Hintergrund. Das kann ein bis zwei Minuten dauern. 🌿</div>';
  try {
    await createImage($('#output').textContent, format, box);
    button.textContent = 'Noch eine Variante erstellen';
  } catch (error) {
    box.innerHTML = `<div class="image-wait">${error.message}</div>`;
    button.textContent = 'Noch einmal versuchen';
  } finally {
    button.disabled = false;
  }
}

async function makeFreeImage() {
  const formData = new FormData($('#form'));
  const idea = String(formData.get('idee') || '').trim();
  if (!idea) {
    alert('Bitte beschreibe kurz, was Momo malen soll.');
    return;
  }

  const style = formData.get('stil') || 'Natürlich und warm';
  const format = formData.get('format') || 'Quadratisch';
  const imageText = String(formData.get('bildtext') || '').trim();
  const prompt = `Erstelle ein hochwertiges Bild. Bildidee: ${idea}. Stil: ${style}. ${imageText ? `Schreibe gut lesbar exakt diesen Text auf das Bild: "${imageText}".` : 'Kein Text und keine Schrift im Bild.'}`;

  $('#result').classList.remove('hidden');
  $('#output').textContent = `Deine Bildidee: ${idea}`;
  let box = $('#imageResult');
  if (!box) {
    $('#result').insertAdjacentHTML('beforeend', '<div id="imageResult" class="image-result"></div>');
    box = $('#imageResult');
  }
  box.innerHTML = '<div class="image-wait">Momo malt deine freie Idee im Hintergrund. Das kann ein bis zwei Minuten dauern. ✨</div>';

  const submit = $('#form .submit');
  submit.disabled = true;
  submit.textContent = 'Momo malt …';
  try {
    await createImage(prompt, format, box);
    submit.textContent = 'Noch ein freies Bild erstellen ✨';
  } catch (error) {
    box.innerHTML = `<div class="image-wait">${error.message}</div>`;
    submit.textContent = 'Noch einmal versuchen';
  } finally {
    submit.disabled = false;
  }
}

$('#form').addEventListener('submit', event => {
  if (current !== 'free') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  makeFreeImage();
}, true);
