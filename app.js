// client-side app.js
// - displays map with earthquake markers from /api/earthquakes
// - shows lists for volcanoes and floods (proxied)
// - shows tsunami feed quick status
// Requires: Leaflet (included in HTML)

async function fetchJson(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error('Network error');
    return await r.json();
  } catch (e) {
    console.error(path, e);
    return null;
  }
}

async function init() {
  // Map setup
  const map = L.map('map').setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Fetch earthquakes
  const eq = await fetchJson('/api/earthquakes');
  const eqListEl = document.getElementById('eq-list');
  const eqCountEl = document.getElementById('eq-count');
  if (eq && eq.ok && eq.data && Array.isArray(eq.data.features)) {
    eqCountEl.textContent = `${eq.data.features.length} events (past day)`;
    eqListEl.innerHTML = '';
    eq.data.features.sort((a,b)=>b.properties.mag - a.properties.mag).slice(0,50).forEach((f,i) => {
      const mag = f.properties.mag || 0;
      const place = f.properties.place || 'Unknown';
      const time = new Date(f.properties.time).toLocaleString();
      const li = document.createElement('li');
      li.innerHTML = `<strong>M${mag.toFixed(1)}</strong> — ${place} <br><small>${time}</small>`;
      li.onclick = () => {
        const [lon,lat] = f.geometry.coordinates;
        map.setView([lat, lon], 6);
      };
      eqListEl.appendChild(li);
      // marker
      const color = mag >= 5 ? 'red' : (mag >= 3 ? 'orange' : 'yellow');
      const marker = L.circleMarker([f.geometry.coordinates[1], f.geometry.coordinates[0]], {
        radius: 4 + Math.max(0, mag),
        color: color, fillColor: color, fillOpacity: 0.7
      }).addTo(map);
      marker.bindPopup(`<strong>${place}</strong><br>Mag: ${mag}<br>${time}<br><a target="_blank" href="${f.properties.url}">details</a>`);
    });
  } else {
    eqCountEl.textContent = 'Earthquake feed unavailable';
  }

  // Tsunami feed
  const ts = await fetchJson('/api/tsunami');
  const tsunamiMsg = document.getElementById('tsunami-msg');
  if (ts && ts.ok && ts.data && ts.data.length > 0) {
    tsunamiMsg.textContent = ts.data[0].title || 'Latest tsunami message';
    // clickable: open full feed
    tsunamiMsg.onclick = () => window.open('https://www.tsunami.gov/', '_blank');
  } else {
    tsunamiMsg.textContent = 'No tsunami warnings (or feed unavailable)';
  }

  // Volcanoes
  const vol = await fetchJson('/api/volcanoes');
  const volEl = document.getElementById('volcano-list');
  if (vol && vol.ok && vol.data) {
    volEl.innerHTML = '';
    vol.data.slice(0,6).forEach(v=>{
      const li = document.createElement('li');
      li.textContent = `${v.name}${v.status ? ' — ' + v.status : ''}`;
      volEl.appendChild(li);
    });
    // link to full report
    const more = document.createElement('li');
    more.innerHTML = `<a href="https://volcano.si.edu/" target="_blank">Full Weekly Volcanic Activity Report</a>`;
    volEl.appendChild(more);
  } else {
    volEl.innerHTML = '<li>Volcano feed unavailable</li>';
  }

  // Floods (ReliefWeb)
  const flood = await fetchJson('/api/floods');
  const floodEl = document.getElementById('flood-list');
  if (flood && flood.ok && flood.data && flood.data.data) {
    floodEl.innerHTML = '';
    flood.data.data.forEach(r => {
      const title = r.fields && r.fields.title ? r.fields.title : 'Report';
      const url = r.fields && r.fields.url ? r.fields.url[0] : null;
      const li = document.createElement('li');
      li.innerHTML = url ? `<a target="_blank" href="${url}">${title}</a>` : title;
      floodEl.appendChild(li);
    });
    const more = document.createElement('li');
    more.innerHTML = `<a href="https://reliefweb.int/" target="_blank">Full ReliefWeb Flood Reports</a>`;
    floodEl.appendChild(more);
  } else {
    floodEl.innerHTML = '<li>Flood feed unavailable</li>';
  }

  // Emergency button (EMSR839)
  document.getElementById('emergency-btn').onclick = () => {
    window.open('https://rapidmapping.emergency.copernicus.eu/EMSR839/download', '_blank');
  };
}

window.addEventListener('DOMContentLoaded', init);
