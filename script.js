const DATA_URL = "./garbage.json";
const WALKING_SPEED_M_PER_MIN = 75;
const CATCH_BUFFER_MIN = 0;
const STOP_BUFFER_MIN = 5;
const ROUTE_PREVIEW_MIN = 30;//推薦點後顯示多久時間

// =========================
// Developer Mode
// =========================
// 測試完後要記得改回 false
const DEV_MODE = true;

// 測試用假時間，格式 HH:mm
const DEV_TEST_TIME = "19:45";

// 假座標（之後會用）測試完記得改回null
const DEV_TEST_POSITION = {
  lat: 24.99311302,
  lng: 121.56029363, 
};

// 顯示 Debug 資訊（之後會用）
const DEV_SHOW_DEBUG = false;
// =========================


let map;
let userMarker = null;
let truckMarkers = [];
let stationLayer;
let allStations = [];
let userPosition = null;
let routeLine = null;
let routeMarkers = [];
let routeArrowMarkers = [];
let currentRouteKey = null;

init();

async function init() {
  initMap();
  await loadGarbageData();
  addLocateButton();
}

function getCurrentTime() {
  const now = new Date();

  if (!DEV_MODE || !DEV_TEST_TIME) {
    return now;
  }

  const match = DEV_TEST_TIME.match(/^(\d{1,2})[:：](\d{2})$/);
  if (!match) return now;

  const testNow = new Date(now);
  testNow.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return testNow;
}

function initMap() {
  map = L.map("map").setView([25.033964, 121.564468], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  stationLayer = L.layerGroup().addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
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
    // renderStations(allStations);

    showMessage(`資料載入完成，共 ${allStations.length} 個停靠點。`);
  } catch (err) {
    console.error("Failed to load garbage data:", err);
    showMessage("資料載入失敗，請確認 garbage.json 是否存在，或是否使用 Live Server 開啟。");
  }
}

function renderMeta(data) {
  const info = document.getElementById("dataStatus");
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
  const btn = document.getElementById("locateBtn");
  if (btn) {
    btn.addEventListener("click", locateUser);
  }

  const searchInput = document.getElementById("addressSearch");
  const searchBtn = document.getElementById("addressSearchBtn");

  if (searchBtn) {
    searchBtn.addEventListener("click", handleAddressSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handleAddressSearch();
      }
    });
  }
}

function locateUser() {

  if (DEV_MODE && DEV_TEST_POSITION) {
    userPosition = DEV_TEST_POSITION;

    showMessage("🧪 Developer Mode：使用假座標");

    showUserOnMap(userPosition);
    recommendCatchableTruck(userPosition);
    return;
  }

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

async function handleAddressSearch() {
  const input = document.getElementById("addressSearch");
  if (!input) return;

  const keyword = input.value.trim();

  if (!keyword) {
    showMessage("請輸入地址或地標。");
    return;
  }

  clearTruckRoute();
  clearTruckMarkers();
  renderRecommendation([]);
  
  showMessage("正在搜尋地址...");

  try {
    const hasCity = keyword.includes("台北") || keyword.includes("臺北");

    const query = hasCity
      ? `${keyword}, 台灣`
      : `${keyword}, 台北市, 台灣`;

    const geocoder = new google.maps.Geocoder();

    const result = await geocoder.geocode({
      address: query,
      region: "tw",
      language: "zh-TW",
    });

    if (!result.results || result.results.length === 0) {
      showMessage("找不到這個地址，請試著輸入更完整的地址。");
      return;
    }

    const place = result.results[0];

    const position = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    if (!isValidLatLng(position.lat, position.lng)) {
      showMessage("搜尋結果座標格式錯誤。");
      return;
    }

    userPosition = position;

    showUserOnMap(position);
    recommendCatchableTruck(position);

    showMessage(`已搜尋到：${place.formatted_address || keyword}`);
  } catch (err) {
    console.error("Address search failed:", err);
    showMessage("地址搜尋失敗，請稍後再試。");
  }
}

function showUserOnMap(position) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  userMarker = L.marker([position.lat, position.lng], {
    icon: createUserIcon(),
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindPopup("📍 你的位置");

  if (userMarker.setZIndexOffset) {
  userMarker.setZIndexOffset(1000);
  }

  map.setView([position.lat, position.lng], 16);
}

function recommendCatchableTruck(position) {
  clearTruckRoute();
  
  const now = getCurrentTime();
  const candidates = [];

  allStations.forEach((station) => {
    
    const lat = Number(station.lat);
    const lng = Number(station.lng);

    if (!isValidLatLng(lat, lng)) return;

    const arrivalDate = parseArrivalTimeToday(station.time, now);
    const leaveDate = parseArrivalTimeToday(station.leaveTime, now);

    if (!arrivalDate || !leaveDate) return;

    if (leaveDate < now) return;

    const distanceM = getDistanceMeters(position.lat, position.lng, lat, lng);
    const walkingMinutes = Math.ceil(distanceM / WALKING_SPEED_M_PER_MIN);
    const minutesUntilArrival = Math.floor((arrivalDate - now) / 60000);
    const minutesUntilLeave = Math.floor((leaveDate - now) / 60000);

    let canCatch = false;

    // 情況 1：垃圾車還沒到，照原本邏輯判斷能不能趕上
    if (arrivalDate > now) {
      canCatch = minutesUntilArrival >= walkingMinutes + CATCH_BUFFER_MIN;
    }

    // 情況 2：垃圾車已到但尚未離站，仍可推薦
    if (arrivalDate <= now && leaveDate >= now) {
      canCatch = walkingMinutes <= minutesUntilLeave + STOP_BUFFER_MIN;
    }

    if (!canCatch) return;

    candidates.push({
      station,
      lat,
      lng,
      distanceM,
      walkingMinutes,
      minutesUntilArrival,
      arrivalDate,
      leaveDate,
    });
  });

  candidates.sort((a, b) => {
    const aWait = Math.max(0, a.minutesUntilArrival);
    const bWait = Math.max(0, b.minutesUntilArrival);

    return (aWait + a.walkingMinutes) - (bWait + b.walkingMinutes);
  });

  const results = candidates.slice(0, 10);

if (results.length === 0) {
  clearTruckMarkers();
  renderRecommendation([]);
  showMessage("目前沒有找到 2 分鐘後可抵達的垃圾車。");
  return;
}

renderRecommendation(results);
showMessage(`已找到 ${results.length} 個推薦停靠點。`);

showTrucksOnMap(results, position);
}

function showTruckRoute(item) {
  const routeKey = `${item.station.truck}-${item.station.time}`;

  if (currentRouteKey === routeKey) {
    clearTruckRoute();
    return;
  }

  currentRouteKey = routeKey;

  const truckNo = item.station.truck;
  const selectedTime = item.station.time;

  const selectedDate = parseArrivalTimeToday(item.station.time, getCurrentTime());
  const routeEndDate = new Date(selectedDate.getTime() + ROUTE_PREVIEW_MIN * 60000  );

  const futureStops = allStations
    .filter((station) => {
      return station.truck === truckNo;
    })
    .filter((station) => {
      const stationDate = parseArrivalTimeToday(station.time, getCurrentTime());

      return (
        stationDate >= selectedDate &&
        stationDate <= routeEndDate
      );
    })
    .sort((a, b) => {
      return a.time.localeCompare(b.time);
    });

  console.log("後續路徑停靠點:", futureStops);

  const routePoints = futureStops.map((station) => {
    return [Number(station.lat), Number(station.lng)];
  });

  if (routeLine) {
    map.removeLayer(routeLine);
  }

  routeMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });

  routeMarkers = [];

  routeArrowMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });

  routeArrowMarkers = [];

  routeLine = L.polyline(routePoints, {
    color: "#1976d2",
    weight: 5,
    opacity: 0.8,
    dashArray: "10,10",
  }).addTo(map);

  //const decorator = L.polylineDecorator(routeLine, {
  //  patterns: [
  //    {
  //      offset: 0,
  //      repeat: 80,
  //      symbol: L.Symbol.dash({
  //        pixelSize: 20,
  //        pathOptions: {
  //          color: "#1976d2",
  //          weight: 4,
  //          opacity: 0.9,
  //        },
  //      }),
  //    },
  //  ],
  //}).addTo(map);

  futureStops.forEach((station) => {

    if (station.time === item.station.time) {
      return;
    }

    const marker = L.marker([station.lat, station.lng], {
      icon: createTruckIcon(),
      zIndexOffset: 2000,
    })
    .addTo(map)
    .bindPopup(`
      <strong>🚛 ${station.truck}</strong><br>
      🕒 ${station.time} ~ ${station.leaveTime}<br>
      📍 ${station.address}
    `);

    routeMarkers.push(marker);

  });

}



function showTrucksOnMap(results, position) {
  clearTruckMarkers();

  const points = [[position.lat, position.lng]];

  results.forEach((item, index) => {
    const marker = L.marker([item.lat, item.lng], {
      zIndexOffset: 500,
    })
      .addTo(map)
      .bindPopup(`🚛 推薦停靠點 ${index + 1}`);

    marker.on("click", () => {
      const card = document.getElementById(`recommend-card-${index}`);

      if (card) {
        card.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }

      showTruckRoute(item);

    });

    truckMarkers.push(marker);
    points.push([item.lat, item.lng]);
  });

  if (userMarker && userMarker.setZIndexOffset) {
    userMarker.setZIndexOffset(1000);
  }

  const bounds = L.latLngBounds(points);

  map.fitBounds(bounds, {
    padding: [60, 60],
    maxZoom: 17,
  });
}

function clearTruckMarkers() {
  truckMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });

  truckMarkers = [];
}

function clearTruckRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  routeMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });
  routeMarkers = [];

  routeArrowMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });
  routeArrowMarkers = [];

  currentRouteKey = null;
}

function renderRecommendation(results) {
  let box = document.getElementById("result");
  if (!box) return;

  if (!results || results.length === 0) {
    box.innerHTML = `
      <h2>🚛 附近垃圾車</h2>
      <p>目前附近沒有找到 2 分鐘後可抵達的垃圾車。</p>
    `;
    return;
  }

  box.innerHTML = `
    <h2>🚛 附近垃圾車</h2>
    ${results.map((result, index) => {
      const station = result.station;
      const address = station.address || "未知地點";
      const truck = station.truck || "未知";
      const arrivalTime = station.time || "未知";

      const navUrl =
        `https://www.google.com/maps/dir/?api=1` +
        `&destination=${result.lat},${result.lng}` +
        `&travelmode=walking`;

      return `
        <div class="recommend-card" id="recommend-card-${index}">
          <h3>
            ${index === 0 ? "🏆 最佳推薦" : `#${index + 1}`}
          </h3>
          <p>💧 地址：${escapeHtml(address)}</p>
          <p>🚛 車號：${escapeHtml(truck)}</p>
          <p>🕒 抵達時間：${escapeHtml(arrivalTime)}</p>
          <p>📏 距離：約 ${Math.round(result.distanceM)} 公尺</p>
          <p>🚶 步行時間：約 ${result.walkingMinutes} 分鐘</p>
          <p>
            <a href="${navUrl}" target="_blank" rel="noopener noreferrer">
              🧭 Google Maps 導航
            </a>
          </p>
        </div>
      `;
    }).join("")}
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
    html: "📍",
    iconSize: [60, 60],
    iconAnchor: [60, 60],
    popupAnchor: [0, -60],
  });
}

function createTruckIcon() {
  return L.divIcon({
    className: "truck-cartoon-icon",
    html: "🚛",
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });
}

function createRouteArrowIcon() {
  return L.divIcon({
    className: "route-arrow-icon",
    html: "➤",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

