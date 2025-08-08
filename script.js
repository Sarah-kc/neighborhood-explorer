// Initialize map centered on NYC
const map = L.map('map').setView([40.7128, -74.0060], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

/* =========================
   Layer groups
========================= */
const bathroomLayer = L.layerGroup().addTo(map); // on by default
const artLayer = L.layerGroup().addTo(map);      // on by default
const dogLayer = L.layerGroup().addTo(map);      // on by default

/* =========================
   Bathrooms with slider
========================= */
let allBathrooms = []; // store all bathroom records

// fetch bathrooms and store them
fetch('https://data.cityofnewyork.us/resource/i7jb-7jku.json')
  .then(res => res.json())
  .then(data => {
    allBathrooms = data.filter(p => p.latitude && p.longitude);
    // initial render
    showBathrooms(50);
    // after data arrives, make sure slider max reflects total count
    updateBathroomSliderMax();
  })
  .catch(err => console.error('Bathrooms error:', err));

// render N bathrooms into the layer
function showBathrooms(limit) {
  bathroomLayer.clearLayers();
  const n = Math.min(limit, allBathrooms.length);
  allBathrooms.slice(0, n).forEach(point => {
    L.marker([Number(point.latitude), Number(point.longitude)])
      .addTo(bathroomLayer)
      .bindPopup(`<b>${point.facility_name || 'No Facility Name'}</b>`);
  });
}

/* A Leaflet control with a slider that controls how many bathrooms are visible */
const bathroomCountControl = L.control({ position: 'topright' });

bathroomCountControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'bathroom-control');
  div.innerHTML = `
    <label style="display:block;font-weight:600;margin-bottom:6px;">
      Bathrooms to show: <span id="bathroomCountValue">50</span>
    </label>
    <input type="range" id="bathroomCount" min="10" max="300" step="10" value="50" style="width:180px;">
  `;
  L.DomEvent.disableClickPropagation(div); // using the control should not drag the map
  return div;
};

bathroomCountControl.addTo(map);

// wire the slider
function initBathroomSlider() {
  const slider = document.getElementById('bathroomCount');
  const label = document.getElementById('bathroomCountValue');
  if (!slider || !label) return;

  slider.addEventListener('input', e => {
    const value = Number(e.target.value);
    label.textContent = value;
    showBathrooms(value);
  });
}
initBathroomSlider();

function updateBathroomSliderMax() {
  const slider = document.getElementById('bathroomCount');
  const label = document.getElementById('bathroomCountValue');
  if (!slider || !label) return;
  if (allBathrooms.length) {
    const max = Math.max(10, Math.min(1000, allBathrooms.length));
    slider.max = String(max);
    if (Number(slider.value) > max) {
      slider.value = String(max);
      label.textContent = slider.value;
      showBathrooms(max);
    }
  }
}

/* =========================
   Public Art (red pins) with description
========================= */
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// helper to extract lat/lon from various schema possibilities
function extractLatLon(rec) {
  if (rec.latitude && rec.longitude) {
    return [Number(rec.latitude), Number(rec.longitude)];
  }
  if (rec.location && rec.location.latitude && rec.location.longitude) {
    return [Number(rec.location.latitude), Number(rec.location.longitude)];
  }
  if (rec.the_geom && rec.the_geom.type === 'Point' && Array.isArray(rec.the_geom.coordinates)) {
    const [lon, lat] = rec.the_geom.coordinates;
    return [Number(lat), Number(lon)];
  }
  return null;
}

fetch('https://data.cityofnewyork.us/resource/3r2x-bnmj.json?$limit=250')
  .then(r => r.json())
  .then(rows => {
    rows.forEach(rec => {
      const coords = extractLatLon(rec);
      if (!coords) return;

      const title = rec.title || rec.name || 'Public Art';
      const desc = rec.descriptio || rec.description || ''; // some datasets use "descriptio"
      const artist = rec.artist || rec.creator || rec.author || '';

      const popupHTML = `
        <b>${title}</b><br>
        ${artist ? `Artist: ${artist}<br>` : ''}
        ${desc ? `<div style="max-width:220px;margin-top:4px;">${desc}</div>` : ''}
      `;

      L.marker(coords, { icon: redIcon })
        .addTo(artLayer)
        .bindPopup(popupHTML);
    });
  })
  .catch(err => console.error('Public Art error:', err));

/* =========================
   Dog Runs (yellow pins) from MultiPolygon
========================= */
const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// simple centroid for MultiPolygon: average of all vertices
function centroidOfMultiPolygon(geom) {
  try {
    if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) return null;
    let latSum = 0, lonSum = 0, count = 0;
    // geom.coordinates = [ polygon[], polygon[], ... ]
    geom.coordinates.forEach(poly => {
      // poly = [ ring[], ring[], ... ] first ring is outer boundary
      poly.forEach(ring => {
        ring.forEach(([lon, lat]) => {
          latSum += Number(lat);
          lonSum += Number(lon);
          count += 1;
        });
      });
    });
    if (count === 0) return null;
    return [latSum / count, lonSum / count];
  } catch {
    return null;
  }
}

fetch('https://data.cityofnewyork.us/resource/hxx3-bwgv.json?$limit=500')
  .then(r => r.json())
  .then(rows => {
    rows.forEach(rec => {
      // prefer centroid of the polygon geometry
      let coords = null;
      if (rec.the_geom && rec.the_geom.type === 'MultiPolygon') {
        const c = centroidOfMultiPolygon(rec.the_geom);
        if (c) coords = c;
      }
      // fallback to first coordinate if centroid failed
      if (!coords && rec.the_geom && rec.the_geom.type === 'MultiPolygon') {
        const first = rec.the_geom.coordinates?.[0]?.[0]?.[0]; // [lon, lat]
        if (first) coords = [Number(first[1]), Number(first[0])];
      }
      if (!coords) return;

      const name = rec.name || 'Dog Run';
      const zipcode = rec.zipcode || '';

      L.marker(coords, { icon: yellowIcon })
        .addTo(dogLayer)
        .bindPopup(`<b>${name}</b>${zipcode ? `<br>${zipcode}` : ''}`);
    });
  })
  .catch(err => console.error('Dog Runs error:', err));

/* =========================
   Legend with checkboxes
========================= */
const legend = L.control({ position: 'bottomright' });

legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'legend');
  div.innerHTML = `
    <h4>Legend</h4>
    <label class="legend-item">
      <input type="checkbox" id="toggle-bathrooms" checked />
      <img src="https://unpkg.com/leaflet/dist/images/marker-icon.png" width="12" height="20" />
      <span>Bathrooms</span>
    </label>
    <label class="legend-item">
      <input type="checkbox" id="toggle-art" checked />
      <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png" width="12" height="20" />
      <span>Public Art</span>
    </label>
    <label class="legend-item">
      <input type="checkbox" id="toggle-dogs" checked />
      <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png" width="12" height="20" />
      <span>Dog Runs</span>
    </label>
  `;
  L.DomEvent.disableClickPropagation(div);
  return div;
};

legend.addTo(map);

// connect legend checkboxes to layers and the bathroom slider control
function bindLegendToggles() {
  const b = document.getElementById('toggle-bathrooms');
  const a = document.getElementById('toggle-art');
  const d = document.getElementById('toggle-dogs');

  b.addEventListener('change', e => {
    if (e.target.checked) {
      bathroomLayer.addTo(map);
      // show the bathroom slider control again
      document.querySelector('.bathroom-control')?.classList.remove('hidden');
    } else {
      map.removeLayer(bathroomLayer);
      // hide the bathroom slider control
      document.querySelector('.bathroom-control')?.classList.add('hidden');
    }
  });

  a.addEventListener('change', e => {
    if (e.target.checked) artLayer.addTo(map);
    else map.removeLayer(artLayer);
  });

  d.addEventListener('change', e => {
    if (e.target.checked) dogLayer.addTo(map);
    else map.removeLayer(dogLayer);
  });
}
bindLegendToggles();