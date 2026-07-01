const DATA_URL = "./garbage.json";
const WALKING_SPEED_M_PER_MIN = 75;
const CATCH_BUFFER_MIN = 3;

let map;
let userMarker;
let stationLayer;
let allStations = [];
let userPosition = null;

init();

async function init() {
  initMap();
  await loadGarbageData();
  addLocateButton();
}

function initMap() {
  map = L.map("map").setView([25.033964, 121.564468], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  stationLayer = L.layerGroup().addTo(map);
}

async function loadGarbageData() {
  try {
    const res = await fetch(DATA_URL);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    allStations = Array.isArray(data.stations) ? data.stations : [];

    renderMeta(data);
    //renderStations(allStations);

    showMessage(`資料載入完成，共 ${allStations.length} 個停靠點。`);
  } catch (err) {
    console.error("Failed to load garbage data:", err);
    showMessage("資料載入失敗，請確認 garbage.json 是否存在，或是否使用 Live Server 開啟。");
  }
}

function renderMeta(data) {
  const info = document.getElementById("data-info");
  if (!info) return;

  const updatedAt = data?.meta?.updatedAt || "未知";
  const totalValid = data?.meta?.totalValid || allStations.length;

  info.innerHTML = `
    資料最後更新：${formatDateTime(updatedAt)}<br>
    共 ${totalValid} 個停靠點
  `;
}

function renderStations(stations) {
  stationLayer.clearLayers();

  stations.forEach((station) => {
    const lat = Number(station.lat);
    const lng = Number(station.lng);

    if (!isValidLatLng(lat, lng)) return;

    const address = station.address || "未知地點";
    const truck = station.truck || "未知";
    const arrivalTime = station.time || "未知";

    L.marker([lat, lng])
      .bindPopup(`
        <strong>${escapeHtml(address)}</strong><br>
        🚛 車號：${escapeHtml(truck)}<br>
        🕒 抵達時間：${escapeHtml(arrivalTime)}
      `)
      .addTo(stationLayer);
  });
}

function addLocateButton() {
  const btn =
    document.getElementById("locate-btn") ||
    Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent.includes("使用我的位置")
    );

  if (!btn) return;

  btn.addEventListener("click", () => {
    locateUser();
  });
}

function locateUser() {
  if (!navigator.geolocation) {
    showMessage("此瀏覽器不支援定位功能。");
    return;
  }

  showMessage("正在取得你的位置...");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      
      showMessage("已取得你的位置，正在推薦垃圾車...");
      
      showUserOnMap(userPosition);
      recommendCatchableTruck(userPosition);
    },
    (err) => {
      console.error(err);
      showMessage("無法取得定位，請確認瀏覽器定位權限已開啟。");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

function showUserOnMap(position) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  userMarker = L.marker([position.lat, position.lng], {
    icon: createUserIcon(),
  })
    .addTo(map)
    .bindPopup("你的位置")
    .openPopup();

  map.setView([position.lat, position.lng], 16);
}

function recommendCatchableTruck(position) {
  const now = new Date();
  const candidates = [];

  allStations.forEach((station) => {
    const lat = Number(station.lat);
    const lng = Number(station.lng);

    if (!isValidLatLng(lat, lng)) return;

    const arrivalTimeText = station.time;
    const arrivalDate = parseArrivalTimeToday(arrivalTimeText, now);

    if (!arrivalDate) return;

    const distanceM = getDistanceMeters(position.lat, position.lng, lat, lng);

    const walkingMinutes = Math.ceil(distanceM / WALKING_SPEED_M_PER_MIN);
    const minutesUntilArrival = Math.floor((arrivalDate - now) / 60000);

    const canCatch = minutesUntilArrival >= walkingMinutes + CATCH_BUFFER_MIN;

    if (!canCatch) return;

    candidates.push({
      station,
      lat,
      lng,
      distanceM,
      walkingMinutes,
      minutesUntilArrival,
      arrivalDate,
      score: minutesUntilArrival,
    });
  });

  candidates.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.distanceM - b.distanceM;
  });

  const best = candidates[0];

  if (!best) {
    renderRecommendation(null);
    return;
  }

  renderRecommendation(best);
  showMessage("已找到推薦垃圾車。");

  L.marker([best.lat, best.lng])
    .addTo(map)
    .bindPopup("🏃 推薦垃圾車")
    .openPopup();

  map.setView([best.lat, best.lng], 17);
}

function renderRecommendation(result) {
  let box = document.getElementById("recommendation");

  if (!box) {
    box = document.createElement("div");
    box.id = "recommendation";
    box.style.padding = "12px";
    box.style.margin = "12px";
    box.style.border = "1px solid #ddd";
    box.style.borderRadius = "8px";
    box.style.background = "#fff";

    const mapEl = document.getElementById("map");
    if (mapEl && mapEl.parentNode) {
      mapEl.parentNode.insertBefore(box, mapEl);
    } else {
      document.body.prepend(box);
    }
  }

  if (!result) {
    box.innerHTML = `
      <h2>🏃 推薦垃圾車</h2>
      <p>目前附近沒有找到來得及趕上的垃圾車。</p>
    `;
    return;
  }

  const station = result.station;
  const address = station.address || "未知地點";
  const truck = station.truck || "未知";
  const arrivalTime = station.time || "未知";

  const navUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${result.lat},${result.lng}` +
    `&travelmode=walking`;

  box.innerHTML = `
    <h2>🏃 推薦垃圾車</h2>
    <p>📍 地址：${escapeHtml(address)}</p>
    <p>🚛 車號：${escapeHtml(truck)}</p>
    <p>🕒 抵達時間：${escapeHtml(arrivalTime)}</p>
    <p>📏 距離：約 ${Math.round(result.distanceM)} 公尺</p>
    <p>🚶 步行時間：約 ${result.walkingMinutes} 分鐘</p>
    <p>
      <a href="${navUrl}" target="_blank" rel="noopener noreferrer">
        🧭 Google Maps 導航
      </a>
    </p>
  `;
}

function parseArrivalTimeToday(timeText, now = new Date()) {
  if (!timeText) return null;

  const raw = String(timeText).trim();

  let hour;
  let minute;

  const colonMatch = raw.match(/^(\d{1,2})[:：](\d{2})$/);
  const compactMatch = raw.match(/^(\d{4})$/);

  if (colonMatch) {
    hour = Number(colonMatch[1]);
    minute = Number(colonMatch[2]);
  } else if (compactMatch) {
    hour = Number(raw.slice(0, 2));
    minute = Number(raw.slice(2, 4));
  } else {
    return null;
  }

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const arrival = new Date(now);
  arrival.setHours(hour, minute, 0, 0);

  return arrival;
}

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function formatDateTime(value) {
  if (!value) return "未知";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
  });
}

function showMessage(message) {
  let box = document.getElementById("message");

  if (!box) {
    box = document.createElement("div");
    box.id = "message";
    box.style.padding = "8px 12px";
    box.style.margin = "12px";
    document.body.prepend(box);
  }

  box.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createUserIcon() {
  return L.divIcon({
    className: "user-cartoon-icon",
    html: "🧍",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}