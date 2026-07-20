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
    'Schreibe einen gut singbaren deutschen Liedtext mit klar gekennzeichneten Strophen und Refrain.'
  ].join('\n');
  const response = await fetch('/api/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task: 'song', input })
  });
  const data = await parseResponse(response);
  if (!response.ok || data.error) throw new Error(data.error || 'Momo konnte den Liedtext nicht schreiben.');
  return data.text;
}

function sunoStyle(values) {
  const voice = values.stimme === 'Momo entscheidet' ? 'passende ausdrucksstarke Gesangsstimme' : values.stimme;
  return `${values.stil}, ${values.stimmung}, ${voice}, deutscher Song, warme klare Produktion, eingängiger Refrain`;
}

async function copyText(text, button, success) {
  try {
    await navigator.clipboard.writeText(text);
    const old = button.textContent;
    button.textContent = success;
    setTimeout(() => { button.textContent = old; }, 1800);
  } catch {
    alert('Das Kopieren hat nicht geklappt. Bitte markiere den Text und kopiere ihn von Hand.');
  }
}

async function prepareForSuno() {
  const form = document.querySelector('#form');
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
  submit.textContent = 'Momo bereitet alles vor …';
  document.querySelector('#result').classList.remove('hidden');
  document.querySelector('#output').textContent = 'Momo schreibt und sortiert deine Songidee …';

  try {
    let lyrics = '';
    if (values.liedart === 'Nur instrumental') lyrics = 'Instrumental – ohne Liedtext';
    else if (values.liedart === 'Ich habe einen eigenen Liedtext') lyrics = values.liedtext.trim();
    else lyrics = await createLyrics(values);
    const style = sunoStyle(values);
    const output = document.querySelector('#output');
    output.textContent = lyrics;
    let box = document.querySelector('#songResult');
    if (!box) {
      document.querySelector('#result').insertAdjacentHTML('beforeend', '<div id="songResult"></div>');
      box = document.querySelector('#songResult');
    }
    box.innerHTML = `<div class="song-player"><h3>Alles für Suno ist vorbereitet</h3><p><b>Musikstil für Suno:</b><br>${escapeHtml(style)}</p><div class="suno-actions"><button type="button" id="copyLyrics">Liedtext kopieren</button><button type="button" id="copyStyle">Musikstil kopieren</button><a class="download" href="https://suno.com/create" target="_blank" rel="noopener">Suno öffnen ↗</a></div><p class="suno-hint">In Suno „Custom“ auswählen, Liedtext und Musikstil einfügen und anschließend auf „Create“ drücken.</p></div>`;
    document.querySelector('#copyLyrics').onclick = event => copyText(lyrics, event.currentTarget, 'Liedtext kopiert ✓');
    document.querySelector('#copyStyle').onclick = event => copyText(style, event.currentTarget, 'Musikstil kopiert ✓');
    submit.textContent = 'Neue Songidee vorbereiten 🎵';
  } catch (error) {
    document.querySelector('#output').textContent = error.message;
    submit.textContent = 'Noch einmal versuchen';
  } finally {
    submit.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[character]));
}

document.querySelector('#form').addEventListener('submit', event => {
  if (current !== 'music') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  prepareForSuno();
}, true);
