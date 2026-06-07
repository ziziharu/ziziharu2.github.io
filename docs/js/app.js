const initialCenter = [34.275, 134.715];
const initialZoom = 12;

const state = {
  venues: [],
  venueFiles: [],
  busStops: [],
  selectedVenueId: null,
  activeBasemap: "standard"
};

const elements = {
  dataStatus: document.getElementById("dataStatus"),
  districtFilter: document.getElementById("districtFilter"),
  toggleVenues: document.getElementById("toggleVenues"),
  toggle300: document.getElementById("toggle300"),
  toggle600: document.getElementById("toggle600"),
  toggleBusStops: document.getElementById("toggleBusStops"),
  venueDetail: document.getElementById("venueDetail"),
  basemapButtons: document.querySelectorAll(".map-mode")
};

const basemaps = {
  standard: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
    attribution: "出典：国土地理院",
    maxZoom: 18
  }),
  pale: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "出典：国土地理院",
    maxZoom: 18
  }),
  photo: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", {
    attribution: "出典：国土地理院",
    maxZoom: 18
  })
};

const map = L.map("map", {
  center: initialCenter,
  zoom: initialZoom,
  layers: [basemaps.standard]
});

const venueLayer = L.layerGroup();
const circle300Layer = L.layerGroup();
const circle600Layer = L.layerGroup();
const busStopLayer = L.layerGroup();

const venueIcon = L.divIcon({
  className: "",
  html: '<span class="venue-icon">体</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

const busIcon = L.divIcon({
  className: "",
  html: '<span class="bus-icon">B</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -14]
});

async function loadCsv(path, schema = {}) {
  const response = await fetch(`${path}?v=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`${path} を読み込めませんでした`);
  }
  const text = await response.text();
  return parseCsv(text).map((row) => normalizeCsvRow(row, schema));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = cells[index] ?? "";
    });
    return item;
  });
}

function normalizeCsvRow(row, schema) {
  const normalized = { ...row };

  for (const key of schema.numbers || []) {
    normalized[key] = Number(normalized[key]);
  }

  for (const key of schema.booleans || []) {
    normalized[key] = String(normalized[key]).trim().toLowerCase() === "true";
  }

  return normalized;
}

async function init() {
  try {
    const [venues, venueFiles, busStops] = await Promise.all([
      loadCsv("data/venues.csv", {
        numbers: ["id", "latitude", "longitude"],
        booleans: ["is_active"]
      }),
      loadCsv("data/venue_files.csv", {
        numbers: ["id", "venue_id", "display_order"]
      }),
      loadCsv("data/bus_stops.csv", {
        numbers: ["id", "latitude", "longitude"],
        booleans: ["is_active"]
      })
    ]);

    state.venues = venues.filter((venue) => venue.is_active);
    state.venueFiles = venueFiles;
    state.busStops = busStops.filter((stop) => stop.is_active);

    buildDistrictFilter();
    renderLayers();
    applyLayerVisibility();
    setStatus(`${state.venues.length}会場`);
  } catch (error) {
    setStatus("エラー", true);
    elements.venueDetail.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}

function buildDistrictFilter() {
  elements.districtFilter.innerHTML = '<option value="all">すべての地区</option>';
  const districts = [...new Set(state.venues.map((venue) => venue.district).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));

  for (const district of districts) {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    elements.districtFilter.appendChild(option);
  }
}

function renderLayers() {
  venueLayer.clearLayers();
  circle300Layer.clearLayers();
  circle600Layer.clearLayers();
  busStopLayer.clearLayers();

  const selectedDistrict = elements.districtFilter.value;
  const visibleVenues = state.venues.filter((venue) => {
    return selectedDistrict === "all" || venue.district === selectedDistrict;
  });

  for (const venue of visibleVenues) {
    const latLng = [Number(venue.latitude), Number(venue.longitude)];

    L.circle(latLng, {
      radius: 600,
      color: "#38bdf8",
      weight: 2,
      fillColor: "#38bdf8",
      fillOpacity: 0.12
    }).addTo(circle600Layer);

    L.circle(latLng, {
      radius: 300,
      color: "#1d4ed8",
      weight: 2,
      fillColor: "#1d4ed8",
      fillOpacity: 0.18
    }).addTo(circle300Layer);

    const marker = L.marker(latLng, { icon: venueIcon })
      .bindPopup(createVenuePopup(venue))
      .on("click", () => selectVenue(venue.id, false));

    marker.addTo(venueLayer);
  }

  for (const stop of state.busStops) {
    const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], { icon: busIcon })
      .bindPopup(createBusStopPopup(stop));
    marker.addTo(busStopLayer);
  }

  if (visibleVenues.length === 0) {
    elements.venueDetail.innerHTML = '<div class="detail-empty">該当する会場がありません。</div>';
  } else if (state.selectedVenueId) {
    const selectedVenue = visibleVenues.find((venue) => venue.id === state.selectedVenueId);
    if (!selectedVenue) {
      state.selectedVenueId = null;
      elements.venueDetail.innerHTML = '<div class="detail-empty">会場を選択してください。</div>';
    }
  }
}

function applyLayerVisibility() {
  toggleLayer(circle600Layer, elements.toggle600.checked);
  toggleLayer(circle300Layer, elements.toggle300.checked);
  toggleLayer(venueLayer, elements.toggleVenues.checked);
  toggleLayer(busStopLayer, elements.toggleBusStops.checked);
}

function toggleLayer(layer, shouldShow) {
  if (shouldShow && !map.hasLayer(layer)) {
    map.addLayer(layer);
  }
  if (!shouldShow && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }
}

function createVenuePopup(venue) {
  return `
    <p class="popup-title">${escapeHtml(venue.name)}</p>
    ${escapeHtml(venue.district)}<br>
    ${escapeHtml(venue.day_of_week)} ${escapeHtml(venue.time_text)}<br>
    <button class="popup-button" type="button" onclick="selectVenue(${Number(venue.id)}, true)">詳細を見る</button>
  `;
}

function createBusStopPopup(stop) {
  return `
    <p class="popup-title">${escapeHtml(stop.name)}</p>
    路線：${escapeHtml(stop.route_name || "未設定")}<br>
    ${escapeHtml(stop.notes || "")}
  `;
}

function selectVenue(venueId, shouldPan) {
  const venue = state.venues.find((item) => item.id === venueId);
  if (!venue) {
    return;
  }

  state.selectedVenueId = venueId;
  renderVenueDetail(venue);

  if (shouldPan) {
    map.setView([Number(venue.latitude), Number(venue.longitude)], Math.max(map.getZoom(), 15));
  }
}

function renderVenueDetail(venue) {
  const files = state.venueFiles
    .filter((file) => file.venue_id === venue.id)
    .sort((a, b) => Number(a.display_order) - Number(b.display_order));

  elements.venueDetail.innerHTML = `
    <h3 class="detail-title">${escapeHtml(venue.name)}</h3>
    <dl class="detail-grid">
      ${detailRow("住所", venue.address)}
      ${detailRow("地区", venue.district)}
      ${detailRow("開催曜日", venue.day_of_week)}
      ${detailRow("開催時間", venue.time_text)}
      ${detailRow("開催頻度", venue.frequency)}
      ${detailRow("備考", venue.notes || "なし")}
    </dl>
    <h3 class="detail-title">関連資料</h3>
    ${renderFiles(files)}
  `;
}

function detailRow(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "未設定")}</dd>
    </div>
  `;
}

function renderFiles(files) {
  if (files.length === 0) {
    return '<div class="detail-empty">関連資料は登録されていません。</div>';
  }

  return `
    <div class="file-list">
      ${files.map(renderFileItem).join("")}
    </div>
  `;
}

function renderFileItem(file) {
  const title = escapeHtml(file.title);
  const description = escapeHtml(file.description || "");
  const path = encodeURI(file.file_path);
  const type = String(file.file_type).toLowerCase();

  if (type === "png") {
    return `
      <article class="file-item">
        <h4>${title}</h4>
        <img src="${path}" alt="${title}">
        <p>${description}</p>
      </article>
    `;
  }

  if (type === "pdf") {
    return `
      <article class="file-item">
        <h4>${title}</h4>
        <a href="${path}" target="_blank" rel="noopener">PDFを開く</a>
        <p>${description}</p>
      </article>
    `;
  }

  return `
    <article class="file-item">
      <h4>${title}</h4>
      <a href="${path}" target="_blank" rel="noopener">ファイルを開く</a>
      <p>${description}</p>
    </article>
  `;
}

function switchBasemap(name) {
  if (!basemaps[name] || name === state.activeBasemap) {
    return;
  }

  map.removeLayer(basemaps[state.activeBasemap]);
  basemaps[name].addTo(map);
  state.activeBasemap = name;

  elements.basemapButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.basemap === name);
  });
}

function setStatus(text, isError = false) {
  elements.dataStatus.textContent = text;
  elements.dataStatus.classList.toggle("is-error", isError);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.districtFilter.addEventListener("change", () => {
  renderLayers();
  applyLayerVisibility();
});

for (const checkbox of [
  elements.toggleVenues,
  elements.toggle300,
  elements.toggle600,
  elements.toggleBusStops
]) {
  checkbox.addEventListener("change", applyLayerVisibility);
}

elements.basemapButtons.forEach((button) => {
  button.addEventListener("click", () => switchBasemap(button.dataset.basemap));
});

window.selectVenue = selectVenue;

init();
