const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch { throw new Error('Momo hat eine unvollständige Antwort erhalten.'); }
}

async function createLyrics(values) {
  const input = [
    `Thema oder Anlass: ${values.idee}`,
    `Musikstil: ${values.stil}`,
    `Stimmung: ${values.stimmung}`,
    `Stimme: ${values.stimme}`,
    `Länge: ${values.dauer}`
  ].join('\n');
  const response = await fetch('/api/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task: 'song', input })
  });
  const data = await parseResponse(response);
  if (data.error) throw new Error(data.error);
  return data.text;
}

async function makeSong() {
  const form = $('#form');
  const values = Object.fromEntries(new FormData(form));
  if (!String(values.idee || '').trim()) {
    alert('Bitte beschreibe kurz, worum es in dem Lied gehen soll.');
    return;
  }
  if (values.liedart === 'Ich habe einen eigenen Liedtext' && !String(values.liedtext || '').trim()) {
    alert('Bitte füge deinen eigenen Liedtext ein.');
    return;
  }

  const submit = form.querySelector('.submit');
  submit.disabled = true;
  submit.textContent = 'Momo bereitet dein Lied vor …';
  $('#result').classList.remove('hidden');
  $('#output').textContent = 'Momo sammelt Melodie, Stimmung und Worte …';
  let box = $('#songResult');
  if (!box) {
    $('#result').insertAdjacentHTML('beforeend', '<div id="songResult"></div>');
    box = $('#songResult');
  }
  box.innerHTML = '<div class="song-progress">Momo schreibt und komponiert. Das dauert meistens ein bis zwei Minuten.</div>';

  try {
    let lyrics;
    if (values.liedart === 'Nur instrumental') lyrics = '[Instrumental]';
    else if (values.liedart === 'Ich habe einen eigenen Liedtext') lyrics = values.liedtext;
    else lyrics = await createLyrics(values);

    $('#output').textContent = lyrics === '[Instrumental]' ? 'Instrumentalstück ohne Gesang' : lyrics;
    submit.textContent = 'Momo komponiert …';
    const prompt = `${values.stil}, ${values.stimmung}, ${values.stimme}, German song, warm polished production`;
    const startResponse = await fetch('/api/music-start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, lyrics, title: String(values.idee).slice(0, 80) })
    });
    const start = await parseResponse(startResponse);
    if (start.error || !start.id) throw new Error(start.error || 'Der Musikauftrag konnte nicht gestartet werden.');

    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(2500);
      const statusResponse = await fetch(`/api/music-status?id=${encodeURIComponent(start.id)}`, { cache: 'no-store' });
      const status = await parseResponse(statusResponse);
      if (status.error || status.status === 'failed' || status.status === 'canceled') {
        throw new Error(status.error || 'Die Musikerstellung wurde beendet.');
      }
      if (status.status === 'succeeded' && status.audio) {
        box.innerHTML = `<div class="song-player"><h3>${escapeHtml(status.title || 'Momos neues Lied')}</h3><p>Fertig komponiert im Songstudio</p><audio controls preload="metadata" src="${escapeHtml(status.audio)}"></audio><a class="download" href="${escapeHtml(status.audio)}" target="_blank" rel="noopener" download="momos-lied.mp3">Lied öffnen und herunterladen</a>${lyrics === '[Instrumental]' ? '' : `<details class="song-lyrics"><summary>Liedtext anzeigen</summary><pre>${escapeHtml(lyrics)}</pre></details>`}</div>`;
        submit.textContent = 'Noch ein Lied erstellen 🎵';
        return;
      }
      if (attempt === 20) box.innerHTML = '<div class="song-progress">Momo komponiert noch. Ein ganzes Lied braucht manchmal etwas länger.</div>';
    }
    throw new Error('Das Lied braucht ungewöhnlich lange. Bitte später erneut versuchen.');
  } catch (error) {
    box.innerHTML = `<div class="song-progress">${escapeHtml(error.message)}</div>`;
    submit.textContent = 'Noch einmal versuchen';
  } finally {
    submit.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}

$('#form').addEventListener('submit', event => {
  if (current !== 'music') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  makeSong();
}, true);

const originalOpenTool = openTool;
openTool = function(key) {
  originalOpenTool(key);
  if (key !== 'music') return;
  const form = $('#form');
  form.insertAdjacentHTML('afterbegin', '<div id="musicCredits" class="music-credits">Songstudio wird geprüft …</div>');
  fetch('/api/music-credits', { cache: 'no-store' }).then(parseResponse).then(data => {
    const label = $('#musicCredits');
    if (!label) return;
    if (!data.configured) label.textContent = 'Das Songstudio wird noch eingerichtet.';
    else if (data.credits === null) label.textContent = 'Songstudio ist bereit.';
    else label.textContent = `Songstudio bereit · ${data.credits} Credits verfügbar · dieses Lied benötigt 5 Credits`;
  }).catch(() => { const label = $('#musicCredits'); if (label) label.textContent = 'Songstudio ist bereit.'; });
};
