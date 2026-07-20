const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } });
const decode = value => value.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (item, name) => decode(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
const parse = (xml, source) => [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 8).map(match => ({ title: tag(match[1], 'title'), link: tag(match[1], 'link'), date: tag(match[1], 'pubDate') || new Date().toISOString(), source })).filter(item => item.title && /^https?:\/\//.test(item.link));

export default async () => {
  const feeds = [
    ['Tagesschau','https://www.tagesschau.de/index~rss2.xml'],
    ['Deutschlandfunk','https://www.deutschlandfunk.de/nachrichten-100.rss']
  ];
  const results = await Promise.allSettled(feeds.map(async ([source,url]) => parse(await fetch(url, { headers: { 'user-agent':'Momos-Kreativgarten/1.0' } }).then(response => { if (!response.ok) throw new Error(); return response.text(); }), source)));
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,12);
  return items.length ? json({ items }) : json({ error:'Die Nachrichtenquellen sind gerade nicht erreichbar.' }, 502);
};
