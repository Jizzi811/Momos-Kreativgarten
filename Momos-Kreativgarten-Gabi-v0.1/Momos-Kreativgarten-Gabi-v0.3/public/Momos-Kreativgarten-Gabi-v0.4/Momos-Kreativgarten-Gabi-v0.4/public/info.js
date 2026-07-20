const weatherIcons = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️',96:'⛈️',99:'⛈️'};
const weatherNames = {0:'Klar',1:'Überwiegend klar',2:'Teilweise bewölkt',3:'Bewölkt',45:'Nebel',48:'Nebel',51:'Leichter Nieselregen',53:'Nieselregen',55:'Starker Nieselregen',61:'Leichter Regen',63:'Regen',65:'Starker Regen',71:'Leichter Schnee',73:'Schnee',75:'Starker Schnee',80:'Regenschauer',81:'Regenschauer',82:'Starke Schauer',95:'Gewitter',96:'Gewitter',99:'Starkes Gewitter'};

function infoShell(over, title, intro, html) {
  current = 'info';
  document.querySelector('#start').classList.add('hidden');
  document.querySelector('#workspace').classList.remove('hidden');
  document.querySelector('#overline').textContent = over;
  document.querySelector('#title').textContent = title;
  document.querySelector('#intro').textContent = intro;
  document.querySelector('#form').className = '';
  document.querySelector('#form').innerHTML = html;
  document.querySelector('#result').classList.add('hidden');
}

function weatherGarden() {
  const saved = localStorage.getItem('momoWeatherPlace') || '';
  infoShell('MOMOS WETTERGARTEN','Wie wird das Wetter?','Gib einen Ort ein. Momo zeigt dir das aktuelle Wetter und fünf Tage Vorschau.',`<div class="info-card"><div class="info-form"><input id="weatherPlace" value="${escapeHtml(saved)}" placeholder="Zum Beispiel Köln" aria-label="Ort"><button type="button" id="weatherButton">Wetter anzeigen</button></div><div id="weatherOutput" class="info-status">Noch keinen Ort ausgewählt.</div><p class="source-note">Wetterdaten: Open-Meteo · Vorhersagen können sich ändern.</p></div>`);
  document.querySelector('#weatherButton').onclick = loadWeather;
  document.querySelector('#weatherPlace').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); loadWeather(); } };
  if (saved) loadWeather();
}

async function loadWeather() {
  const place = document.querySelector('#weatherPlace').value.trim();
  const output = document.querySelector('#weatherOutput');
  if (!place) return alert('Bitte gib einen Ort ein.');
  output.textContent = 'Momo schaut zum Himmel …';
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=de&format=json`).then(r => r.json());
    const location = geo.results?.[0];
    if (!location) throw new Error('Diesen Ort konnte Momo leider nicht finden.');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
    const data = await fetch(url).then(r => r.json());
    localStorage.setItem('momoWeatherPlace', location.name);
    const days = data.daily.time.map((date, index) => `<div><b>${new Date(`${date}T12:00:00`).toLocaleDateString('de-DE',{weekday:'short'})}</b><span>${weatherIcons[data.daily.weather_code[index]] || '🌤️'}</span><small>${Math.round(data.daily.temperature_2m_max[index])}° / ${Math.round(data.daily.temperature_2m_min[index])}°</small><small>${data.daily.precipitation_probability_max[index]} % Regen</small></div>`).join('');
    output.innerHTML = `<div class="weather-now"><span class="weather-icon">${weatherIcons[data.current.weather_code] || '🌤️'}</span><div><h3>${escapeHtml(location.name)} · ${Math.round(data.current.temperature_2m)} °C</h3><p>${weatherNames[data.current.weather_code] || 'Aktuelles Wetter'} · gefühlt ${Math.round(data.current.apparent_temperature)} °C · Wind ${Math.round(data.current.wind_speed_10m)} km/h</p></div></div><div class="forecast">${days}</div>`;
  } catch (error) { output.textContent = error.message || 'Das Wetter ist gerade nicht erreichbar.'; }
}

function dailyNews() {
  infoShell('NACHRICHTEN MIT QUELLEN','Was ist heute wichtig?','Aktuelle Überschriften seriöser Redaktionen. Ein Klick führt immer zum vollständigen Originalartikel.',`<div class="info-card"><div id="newsOutput" class="info-status">Momo lädt die neuesten Meldungen …</div><p class="source-note">Die Überschriften stammen direkt von den genannten Redaktionen. Momo verändert oder bewertet sie nicht.</p></div>`);
  fetch('/api/news',{cache:'no-store'}).then(parseResponse).then(data => {
    if (data.error) throw new Error(data.error);
    document.querySelector('#newsOutput').className = 'news-list';
    document.querySelector('#newsOutput').innerHTML = data.items.map(item => `<a class="news-item" href="${escapeHtml(item.link)}" target="_blank" rel="noopener"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.source)} · ${new Date(item.date).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})}</small></a>`).join('');
  }).catch(error => { document.querySelector('#newsOutput').textContent = error.message || 'Die Nachrichten sind gerade nicht erreichbar.'; });
}

function factCheck() {
  infoShell('MOMOS FAKTENCHECK','Stimmt das wirklich?','Füge eine Behauptung oder Nachricht ein. Momo öffnet passende Suchen bei professionellen Prüfstellen.',`<div class="info-card"><textarea id="factClaim" placeholder="Zum Beispiel: Eine Nachricht aus WhatsApp oder eine Behauptung …" style="width:100%;min-height:110px;border:1px solid #617c6638;border-radius:13px;padding:13px;font:14px Arial"></textarea><button type="button" id="factButton" style="width:100%;margin-top:10px;border:0;border-radius:12px;background:#416f50;color:white;padding:13px;font-weight:bold">Prüfstellen durchsuchen</button><div id="factLinks"></div><div class="fact-warning">Wichtig: Ein fehlender Treffer beweist weder Wahrheit noch Unwahrheit. Prüfe Datum, Originalquelle und ob mehrere unabhängige Quellen dasselbe berichten.</div></div>`);
  document.querySelector('#factButton').onclick = buildFactLinks;
}

function buildFactLinks() {
  const claim = document.querySelector('#factClaim').value.trim();
  if (!claim) return alert('Bitte füge zuerst eine Behauptung ein.');
  const q = encodeURIComponent(claim.slice(0, 350));
  document.querySelector('#factLinks').innerHTML = `<div class="fact-actions"><a href="https://toolbox.google.com/factcheck/explorer/search/${q}?hl=de" target="_blank" rel="noopener">Google Fact Check Explorer</a><a href="https://correctiv.org/?s=${q}" target="_blank" rel="noopener">CORRECTIV.Faktencheck</a><a href="https://www.tagesschau.de/suche2.html?query=${q}" target="_blank" rel="noopener">Tagesschau & Faktenfinder</a><a href="https://www.google.com/search?q=${encodeURIComponent('site:afp.com/de/faktencheck OR site:dpa.com/de/faktencheck ' + claim.slice(0,250))}" target="_blank" rel="noopener">Weitere professionelle Faktenchecks</a></div>`;
}
