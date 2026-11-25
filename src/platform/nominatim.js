const memory = new Map();
let lastRequest = 0;

/**
 * Nominatim usage policy: at most one request per second, and the results are cached
 * on device. Browsers forbid a custom User-Agent; the Android shell appends one.
 * The request reveals the query and the IP to the OpenStreetMap operator, nothing else.
 */
export async function searchAddress(query) {
  const q = query.trim();
  if (q.length < 3) return [];
  if (memory.has(q)) return memory.get(q);
  const wait = Math.max(0, 1100 - (Date.now() - lastRequest));
  if (wait) await new Promise((resolve) => { setTimeout(resolve, wait); });
  lastRequest = Date.now();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '5');
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'de',
    },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const rows = await response.json();
  const results = rows.slice(0, 5).map((row) => ({
    lat: Number(row.lat),
    lon: Number(row.lon),
    label: row.display_name,
  })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
  memory.set(q, results);
  return results;
}
