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
const cafeLayer = L.layerGroup().addTo(map);


/* =========================
   Cluster groups
========================= */
const clusterOpts = { showCoverageOnHover: false, disableClusteringAtZoom: 16 };
const bathroomCluster = L.markerClusterGroup(clusterOpts);
const artCluster = L.markerClusterGroup(clusterOpts);
const dogCluster = L.markerClusterGroup(clusterOpts);
const cafeCluster = L.markerClusterGroup(clusterOpts); // reuse your existing clusterOpts

// Add clusters into their layer groups (so your legend toggles still work)
bathroomLayer.addLayer(bathroomCluster);
artLayer.addLayer(artCluster);
dogLayer.addLayer(dogCluster);
cafeLayer.addLayer(cafeCluster);


/* =========================
   Bathrooms with slider
========================= */
let allBathrooms = []; // store all bathroom records

// Title & description control (top left)
const titleControl = L.control({ position: 'topleft' });

titleControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'map-title');
  div.innerHTML = `
    <h2 style="margin:0; font-size:16px;">Map for a Free Sarah NYC Day</h2>
    <p style="margin:2px 0 0; font-size:12px; max-width:180px; line-height:1.2;">
      A map for a free day in NYC to fill with walking my dog, looking at art, and grabbing a coffee (and maybe needing a restroom)!
    </p>
  `;
  return div;
};

titleControl.addTo(map);

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
  bathroomCluster.clearLayers();      // clear cluster instead of the layer
  const n = Math.min(limit, allBathrooms.length);
  allBathrooms.slice(0, n).forEach(point => {
    L.marker([Number(point.latitude), Number(point.longitude)])
      .bindPopup(`<div class="nx-popup">
        <div class="popup-title">${point.facility_name || 'No Facility Name'}</div>
      </div>`, { className: 'nx-popup' })
      .addTo(bathroomCluster);
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
      const artist = rec.artist || rec.creator || rec.author || '';
      const desc = rec.descriptio || rec.description || '';

      const popupHTML = `
        <div class="nx-popup">
          <div class="popup-title">${title}</div>
          ${artist ? `<div class="popup-meta">Artist: ${artist}</div>` : ''}
          ${desc ? `<div class="popup-body">${desc}</div>` : ''}
        </div>
      `;

      L.marker(coords, { icon: redIcon })
        .bindPopup(popupHTML, { className: 'nx-popup' })
        .addTo(artCluster);
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

      const popupHTML = `
        <div class="nx-popup">
          <div class="popup-title">${name}</div>
          ${zipcode ? `<div class="popup-meta">ZIP ${zipcode}</div>` : ''}
        </div>
      `;

      L.marker(coords, { icon: yellowIcon })
        .bindPopup(popupHTML, { className: 'nx-popup' })
        .addTo(dogCluster);
    });
  })
  .catch(err => console.error('Dog Runs error:', err));

  const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
  });
  // Cafés — filter to coffee/tea cuisines, pull only needed fields
const cafesURL = "https://data.cityofnewyork.us/resource/43nn-pn8j.json?$query=SELECT%20camis%2C%20dba%2C%20boro%2C%20building%2C%20street%2C%20zipcode%2C%20phone%2C%20cuisine_description%2C%20inspection_date%2C%20action%2C%20violation_code%2C%20violation_description%2C%20critical_flag%2C%20score%2C%20grade%2C%20grade_date%2C%20record_date%2C%20inspection_type%2C%20latitude%2C%20longitude%2C%20community_board%2C%20council_district%2C%20census_tract%2C%20bin%2C%20bbl%2C%20nta%2C%20location_point1%20WHERE%20(upper(%60cuisine_description%60)%20LIKE%20'%25COFFEE%25')"


fetch(cafesURL)
  .then(r => r.json())
  .then(rows => {
    rows.forEach(rec => {
      const lat = Number(rec.latitude);
      const lon = Number(rec.longitude);
      if (isNaN(lat) || isNaN(lon)) return;

      // Make name/title case-ish instead of all caps
      const formatCase = str =>
        str
          ? str
              .toLowerCase()
              .replace(/\b\w/g, c => c.toUpperCase())
          : '';

      const name = formatCase(rec.dba || 'Cafe');
      const addr = formatCase([rec.building, rec.street].filter(Boolean).join(' '));
      const boro = formatCase(rec.boro || '');
      const zip = rec.zipcode || '';

      // Remove "Coffee/Tea" from cuisine if present
      let cuisine = rec.cuisine_description || '';
      if (/coffee\/tea/i.test(cuisine)) {
        cuisine = ''; // blank it out entirely
      } else {
        cuisine = formatCase(cuisine);
      }

      const popupHTML = `
        <div class="nx-popup">
          <div class="popup-title">${name}</div>
          <div class="popup-meta">${addr ? addr + ', ' : ''}${boro}${zip ? ' ' + zip : ''}</div>
          ${cuisine ? `<div class="popup-body">${cuisine}</div>` : ''}
        </div>
      `;

      L.marker([lat, lon], { icon: orangeIcon })
        .bindPopup(popupHTML, { className: 'nx-popup' })
        .addTo(cafeCluster);
    });
  })
  .catch(err => console.error('Cafés error:', err));

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
    <label class="legend-item">
      <input type="checkbox" id="toggle-cafes" checked />
      <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png" width="12" height="20" />
      <span>Cafés (Coffee/Tea)</span>
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
  const c = document.getElementById('toggle-cafes');


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
  c.addEventListener('change', (e) => {
  if (e.target.checked) cafeLayer.addTo(map);
  else map.removeLayer(cafeLayer);
});
}
bindLegendToggles();