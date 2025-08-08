// Initialize map centered on NYC
const map = L.map('map').setView([40.7128, -74.0060], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Layer groups for interactivity
const bathroomLayer = L.layerGroup().addTo(map); // on by default
const artLayer = L.layerGroup().addTo(map);      // on by default
const dogLayer = L.layerGroup().addTo(map);      // on by default

// Fetch Public Wi-Fi Hotspots data (limit 200 for now)
fetch('https://data.cityofnewyork.us/resource/i7jb-7jku.json?$limit=200') // get rid of ?$limit=200 to see all
  .then(res => res.json())
  .then(data => {
    data.forEach(point => {
      if (point.latitude && point.longitude) {
        const popupContent = `
          <b>${point.facility_name || 'No Facility Name'}</b><br>
          ${point.borough || ''}
        `;

        L.marker([point.latitude, point.longitude])
          //.addTo(map)
          .addTo(bathroomLayer) 
          .bindPopup(popupContent);
      }
    });
  })
  .catch(err => console.error('Error loading data:', err));
// Define a custom red icon for Public Art
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  iconSize: [25, 41], // size of the icon
  iconAnchor: [12, 41], // point of the icon which will correspond to marker's location
  popupAnchor: [1, -34], // point from which the popup should open
  shadowSize: [41, 41]
});

// Public Art — pins with custom icon
fetch('https://data.cityofnewyork.us/resource/3r2x-bnmj.json?$limit=250')
  .then(r => r.json())
  .then(rows => {
    rows.forEach(rec => {
      let lat = rec.latitude;
      let lon = rec.longitude;

      if ((!lat || !lon) && rec.location && rec.location.latitude && rec.location.longitude) {
        lat = rec.location.latitude;
        lon = rec.location.longitude;
      }
      if ((!lat || !lon) && rec.the_geom && rec.the_geom.type === 'Point' && rec.the_geom.coordinates) {
        const [gLon, gLat] = rec.the_geom.coordinates;
        lat = gLat;
        lon = gLon;
      }

      if (lat && lon) {
        L.marker([Number(lat), Number(lon)], { icon: redIcon }).addTo(artLayer);//.addTo(map);
         
      }
    });
  })
  .catch(err => console.error('Public Art fetch error:', err));
//dog piss ayyyy
// Yellow icon for dog runs
const yellowIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png',
  shadowUrl: 'https://unpkg.com/leaflet/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

fetch('https://data.cityofnewyork.us/resource/hxx3-bwgv.json?$limit=200')
  .then(r => r.json())
  .then(rows => {
    rows.forEach(rec => {
      if (rec.the_geom && rec.the_geom.type === 'MultiPolygon') {
        // Grab the very first coordinate in the shape
        const coords = rec.the_geom.coordinates[0][0][0]; // [lon, lat]
        const lon = coords[0];
        const lat = coords[1];

        L.marker([lat, lon], { icon: yellowIcon })
          //.addTo(map)
          .addTo(dogLayer)
          .bindPopup(`<b>${rec.name || 'Dog Run'}</b><br>${rec.borough || ''}`);
      }
    });
  })
  .catch(err => console.error('Dog Runs fetch error:', err));

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

  // Let users click in the legend without the map dragging
  L.DomEvent.disableClickPropagation(div);
  return div;
};

legend.addTo(map);

// Wire up checkbox events
function bindLegendToggles() {
  const b = document.getElementById('toggle-bathrooms');
  const a = document.getElementById('toggle-art');
  const d = document.getElementById('toggle-dogs');

  b.addEventListener('change', (e) => {
    if (e.target.checked) bathroomLayer.addTo(map);
    else map.removeLayer(bathroomLayer);
  });

  a.addEventListener('change', (e) => {
    if (e.target.checked) artLayer.addTo(map);
    else map.removeLayer(artLayer);
  });

  d.addEventListener('change', (e) => {
    if (e.target.checked) dogLayer.addTo(map);
    else map.removeLayer(dogLayer);
  });
}
bindLegendToggles();
console.log("yas queen");
