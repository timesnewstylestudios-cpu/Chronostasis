let map;
let marker;
let leaflet;
let token = 0;

async function loadLeaflet() {
  if (leaflet) return leaflet;
  const mod = await import('leaflet');
  await import('leaflet/dist/leaflet.css');
  leaflet = mod.default ?? mod;
  return leaflet;
}

function place(lat, lon) {
  if (!map || !leaflet) return;
  if (marker) marker.remove();
  marker = leaflet.circleMarker([lat, lon], {
    radius: 8,
    color: '#8d4f24',
    weight: 2,
    fillColor: '#e2b067',
    fillOpacity: 0.95,
  }).addTo(map);
}

export async function mountMap(container) {
  const mine = ++token;
  const L = await loadLeaflet();
  if (mine !== token || !container.isConnected) return;
  if (map) {
    map.remove();
    map = null;
    marker = null;
  }
  const lat = Number(document.getElementById('c-lat')?.value);
  const lon = Number(document.getElementById('c-lon')?.value);
  const has = Number.isFinite(lat) && Number.isFinite(lon);
  map = L.map(container, { zoomControl: true, attributionControl: true })
    .setView(has ? [lat, lon] : [51.2, 10.4], has ? 13 : 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  if (has) place(lat, lon);
  map.on('click', (event) => {
    place(event.latlng.lat, event.latlng.lng);
    const latInput = document.getElementById('c-lat');
    const lonInput = document.getElementById('c-lon');
    if (latInput) latInput.value = event.latlng.lat.toFixed(6);
    if (lonInput) lonInput.value = event.latlng.lng.toFixed(6);
  });
  setTimeout(() => map.invalidateSize(), 80);
}

export function focusMap(lat, lon) {
  if (!map) return;
  map.setView([lat, lon], 15);
  place(lat, lon);
}
