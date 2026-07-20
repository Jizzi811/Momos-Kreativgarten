const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function downloadableImage(dataUrl, filename, alt) {
  const [header, encoded] = String(dataUrl).split(',');
  const mime = header.match(/^data:([^;]+);base64$/)?.[1] || 'image/jpeg';
  const binary = atob(encoded || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type:mime }));
  return `<img src="${objectUrl}" alt="${alt}"><a class="download" href="${objectUrl}" download="${filename}">Bild herunterladen</a>`;
}

const imageOpenTool = openTool;
openTool = function(key) {
  imageOpenTool(key);
  if (key !== 'free') return;
  $('#form').insertAdjacentHTML('afterbegin', `<div class="photo-editor field wide"><h3>Oder ein eigenes Foto verschönern</h3><p>Lade ein Foto hoch und sage Momo, was sie vorsichtig ändern soll.</p><label class="upload-box"><span>📷 Foto auswählen</span><input id="editImage" type="file" accept="image/jpeg,image/png,image/webp"></label><img id="editPreview" class="edit-preview hidden" alt="Vorschau des ausgewählten Fotos"><div class="edit-options"><label>Was soll Momo machen?<select id="editAction"><option>Störendes Objekt entfernen</option><option>Fremde Person entfernen</option><option>Hintergrund entfernen</option><option>Hintergrund ersetzen</option><option>Eigene Änderung</option></select></label><label>Was genau? <small>(bei Hintergrund entfernen optional)</small><textarea id="editInstruction" placeholder="Zum Beispiel: die rote Mülltonne links entfernen"></textarea></label></div><button type="button" id="editButton" class="image-action">Dieses Foto bearbeiten ✨</button><div id="editResult" class="image-result"></div></div><div class="atelier-divider field wide"><span>oder ein neues Bild erfinden</span></div>`);
  $('#editImage').addEventListener('change', previewEditImage);
  $('#editButton').addEventListener('click', makeEditedImage);
};

function previewEditImage(event) {
  const file = event.target.files?.[0];
  const preview = $('#editPreview');
  if (!file) return preview.classList.add('hidden');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    event.target.value = '';
    return alert('Bitte wähle ein JPG-, PNG- oder WebP-Bild aus.');
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
}

async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
  if (!blob) throw new Error('Das Foto konnte nicht vorbereitet werden.');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
  return { dataUrl, width, height };
}

async function makeEditedImage() {
  const file = $('#editImage').files?.[0];
  const action = $('#editAction').value;
  const instruction = $('#editInstruction').value.trim();
  const box = $('#editResult');
  const button = $('#editButton');
  if (!file) return alert('Bitte wähle zuerst ein Foto aus.');
  if (!instruction && action !== 'Hintergrund entfernen') return alert('Bitte beschreibe kurz, was Momo ändern soll.');
  button.disabled = true;
  button.textContent = 'Momo bereitet das Foto vor …';
  box.innerHTML = '<div class="image-wait">Momo bearbeitet dein Foto vorsichtig. Das kann ein bis zwei Minuten dauern. 🌿</div>';
  try {
    const prepared = await shrinkImage(file);
    const jobId = crypto.randomUUID();
    const response = await fetch('/api/image-edit', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ jobId, image: prepared.dataUrl, width: prepared.width, height: prepared.height, action, instruction })
    });
    if (!response.ok) throw new Error('Momo konnte die Fotobearbeitung nicht starten.');
    for (let attempt = 0; attempt < 150; attempt += 1) {
      await wait(2000);
      const statusResponse = await fetch(`/api/image-status?id=${encodeURIComponent(jobId)}`, { cache:'no-store' });
      const data = await readJson(statusResponse);
      if (!statusResponse.ok || data.state === 'error') throw new Error(data.error || 'Die Fotobearbeitung ist fehlgeschlagen.');
      if (data.state === 'done' && data.image) {
        box.innerHTML = downloadableImage(data.image, `momos-bearbeitetes-foto.${action === 'Hintergrund entfernen' ? 'png' : 'jpg'}`, 'Von Momo bearbeitetes Foto');
        button.textContent = 'Noch einmal bearbeiten';
        return;
      }
    }
    throw new Error('Die Bearbeitung braucht ungewöhnlich lange. Bitte später erneut versuchen.');
  } catch (error) {
    box.innerHTML = `<div class="image-wait">${escapeHtml(error.message)}</div>`;
    button.textContent = 'Noch einmal versuchen';
  } finally { button.disabled = false; }
}

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
      box.innerHTML = downloadableImage(data.image, 'momos-bild.jpg', 'Von Momo erstelltes Bild');
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
