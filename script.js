// =========================================================
// 台北垃圾車即時查詢  script.js  v1.4.0
// =========================================================


// =========================
// 基本設定
// =========================
const DATA_URL = "./garbage.json";

// 前往方式：步行 / 騎車
const TRAVEL_MODES = {
  walk: {
    label: "步行",
    icon: "🚶",
    speedMPerMin: 75,      // 每分鐘約 75 公尺
    maxDistanceM: 1000,    // 最遠搜尋 1 公里
    googleMode: "walking",
  },
  ride: {
    label: "騎車",
    icon: "🛵",
    speedMPerMin: 275,     // 每分鐘約 275 公尺（約時速 16 公里）
    maxDistanceM: 3000,    // 最遠搜尋 3 公里
    googleMode: "driving",
  },
};
const DEFAULT_TRAVEL_MODE = "walk";

const ARRIVE_BUFFER_MIN = 1;       // 至少要比垃圾車離開早幾分鐘到
const MAX_RECOMMENDATIONS = 10;    // 最多推薦幾個停靠點
const ROUTE_PREVIEW_MIN = 40;      // 點選後顯示之後幾分鐘的路線
const SERVICE_DAY_START_HOUR = 5;  // 凌晨 5 點前，算是前一天的收運班次

// 臺北市大致範圍（用來排除錯誤座標）
const TAIPEI_BOUNDS = {
  minLat: 24.95,
  maxLat: 25.22,
  minLng: 121.45,
  maxLng: 121.67,
};

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const WEEKDAY_INDEX = { 日: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };


// =========================
// Developer Mode
// =========================
// ⚠️ 測試完記得改回 false 再上傳
const DEV_MODE = false;

// 測試用日期（YYYY-MM-DD）與時間（HH:mm）
const DEV_TEST_DATE = "2026-08-03";
const DEV_TEST_TIME = "19:58";

// 測試用座標（不想用假座標就設成 null）
const DEV_TEST_POSITION = {
  lat: 24.993156933279657,
  lng: 121.56042900451732,
};


// =========================
// 狀態
// =========================
let map;
let userMarker = null;
let truckMarkers = [];
let routeLine = null;
let routeMarkers = [];
let currentRouteKey = null;
let allStations = [];
let userPosition = null;
let travelMode = loadTravelMode();

init();


// =========================
// 初始化
// =========================
async function init() {
  initMap();
  bindEvents();
  updateModeButtons();
  await loadGarbageData();
}

function initMap() {
  map = L.map("map").setView([25.033964, 121.564468], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 300);
}

function bindEvents() {
  document.getElementById("locateBtn")?.addEventListener("click", locateUser);
  document.getElementById("addressSearchBtn")?.addEventListener("click", handleAddressSearch);

  document.getElementById("addressSearch")?.addEventListener("keydown", (event) => {
    // isComposing：注音輸入法正在選字時按 Enter，不要觸發搜尋
    if (event.key === "Enter" && !event.isComposing) {
      handleAddressSearch();
    }
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTravelMode(btn.dataset.mode));
  });
}


// =========================
// 前往方式（步行 / 騎車）
// =========================
function loadTravelMode() {
  try {
    const saved = localStorage.getItem("travelMode");
    if (saved && TRAVEL_MODES[saved]) return saved;
  } catch (e) {
    // 無痕模式等情況可能無法使用 localStorage，忽略即可
  }
  return DEFAULT_TRAVEL_MODE;
}

function setTravelMode(mode) {
  if (!TRAVEL_MODES[mode] || mode === travelMode) return;

  travelMode = mode;

  try {
    localStorage.setItem("travelMode", mode);
  } catch (e) {
    // 忽略
  }

  updateModeButtons();

  if (userPosition) {
    recommendCatchableTruck(userPosition);
  }
}

function updateModeButtons() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const active = btn.dataset.mode === travelMode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}


// =========================
// 時間相關
// =========================
function getCurrentTime() {
  const now = new Date();
  if (!DEV_MODE) return now;

  const testNow = new Date(now);

  const dateMatch = DEV_TEST_DATE && DEV_TEST_DATE.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    testNow.setFullYear(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
  }

  const timeMatch = DEV_TEST_TIME && DEV_TEST_TIME.match(/^(\d{1,2})[:：](\d{2})$/);
  if (timeMatch) {
    testNow.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
  }

  return testNow;
}

// 「收運日」：凌晨 5 點前還算前一天（例如週二晚上的車，開到週三 00:10）
function getServiceDate(now) {
  const d = new Date(now);
  if (d.getHours() < SERVICE_DAY_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

// 把 "1630"、"2410"、"16:30" 轉成實際日期時間
function parseScheduleTime(timeText, serviceDate) {
  const match = String(timeText || "").trim().match(/^(\d{1,2})[:：]?(\d{2})$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (minute > 59 || hour > 29) return null;

  // 例如 "0010" 也視為收運日當晚的 24:10
  if (hour < SERVICE_DAY_START_HOUR) hour += 24;

  const date = new Date(serviceDate);
  date.setHours(hour, minute, 0, 0); // setHours(24, 10) 會自動進位到隔天 00:10
  return date;
}

// 把 "2410" 顯示成 "00:10"
function formatScheduleTime(timeText) {
  const match = String(timeText || "").trim().match(/^(\d{1,2})[:：]?(\d{2})$/);
  if (!match) return timeText || "未知";

  const hour = Number(match[1]) % 24;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function formatDateTime(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}


// =========================
// 停收日判斷
// =========================
function isRegularCollectionDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 3; // 週日、週三停收
}

function getCollectionStatus(serviceDate, now) {
  if (isRegularCollectionDay(serviceDate)) {
    return { isCollectionDay: true };
  }

  const nextDate = new Date(serviceDate);
  do {
    nextDate.setDate(nextDate.getDate() + 1);
  } while (!isRegularCollectionDay(nextDate));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysAhead = Math.round((nextDate - today) / 86400000);

  let relative;
  if (daysAhead <= 0) relative = "今天";
  else if (daysAhead === 1) relative = "明天";
  else if (daysAhead === 2) relative = "後天";
  else relative = `${daysAhead} 天後`;

  const weekdayName = WEEKDAY_NAMES[serviceDate.getDay()];
  const nextWeekdayName = WEEKDAY_NAMES[nextDate.getDay()];

  return {
    isCollectionDay: false,
    weekdayName,
    nextLabel: `${relative}（週${nextWeekdayName}）`,
    message: `今天是週${weekdayName}，臺北市例行停收；下一次收運是${relative}（週${nextWeekdayName}）。`,
  };
}

// 解析地點名稱裡的「週一、週四收運」「週二、週五無收運」「每星期一、四收運」
function parseWeekdayRule(name) {
  const match = String(name || "").match(
    /(?:每)?(?:週|星期)((?:[一二三四五六日]|、|週|星期)+?)(無)?收運/
  );
  if (!match) return null;

  const days = [...match[1].matchAll(/[一二三四五六日]/g)].map((m) => WEEKDAY_INDEX[m[0]]);
  if (days.length === 0) return null;

  return { days, isExclude: Boolean(match[2]) };
}

function isStationActiveOn(station, serviceDate) {
  const rule = station.weekdayRule;
  if (!rule) return true;

  const included = rule.days.includes(serviceDate.getDay());
  return rule.isExclude ? !included : included;
}


// =========================
// 資料載入
// =========================
async function loadGarbageData() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const rawStations = Array.isArray(data.stations) ? data.stations : [];

    allStations = rawStations.map(normalizeStation).filter(Boolean);

    const skipped = rawStations.length - allStations.length;
    if (skipped > 0) {
      console.warn(`已略過 ${skipped} 筆座標異常的資料`);
    }

    renderMeta(data);
    showMessage(`資料載入完成，共 ${allStations.length} 個停靠點。`);
  } catch (err) {
    console.error("Failed to load garbage data:", err);

    const info = document.getElementById("dataStatus");
    if (info) info.textContent = "資料載入失敗";

    showMessage("資料載入失敗，請稍後重新整理頁面。");
  }
}

// 整理每一筆停靠點資料，修正或排除錯誤座標
function normalizeStation(raw) {
  let lat = Number(raw.lat);
  let lng = Number(raw.lng);

  if (!isInTaipei(lat, lng)) {
    if (isInTaipei(lng, lat)) {
      [lat, lng] = [lng, lat]; // 經緯度對調，換回來
    } else {
      return null;
    }
  }

  const address = raw.address || raw.name || "未知地點";

  return {
    address,
    district: raw.district || "",
    village: raw.village || "",
    route: raw.route || "",
    truck: raw.truck || "未知",
    time: raw.time || "",
    leaveTime: raw.leaveTime || raw.time || "",
    lat,
    lng,
    weekdayRule: parseWeekdayRule(address),
  };
}

function isInTaipei(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= TAIPEI_BOUNDS.minLat &&
    lat <= TAIPEI_BOUNDS.maxLat &&
    lng >= TAIPEI_BOUNDS.minLng &&
    lng <= TAIPEI_BOUNDS.maxLng
  );
}

function renderMeta(data) {
  const info = document.getElementById("dataStatus");
  if (!info) return;

  const updatedAt = data?.meta?.updatedAt;

  info.innerHTML = `
    資料最後更新：${escapeHtml(formatDateTime(updatedAt))}<br>
    共 ${allStations.length} 個停靠點
  `;
}


// =========================
// 定位 / 地址搜尋
// =========================
function locateUser() {
  if (DEV_MODE && DEV_TEST_POSITION) {
    userPosition = DEV_TEST_POSITION;
    showUserOnMap(userPosition);
    const summary = recommendCatchableTruck(userPosition);
    showMessage(`🧪 Developer Mode：使用假座標｜${summary}`);
    return;
  }

  if (!navigator.geolocation) {
    showMessage("此瀏覽器不支援定位功能，請改用地址搜尋。");
    return;
  }

  showMessage("正在取得你的位置...");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      showUserOnMap(userPosition);
      recommendCatchableTruck(userPosition);
    },
    (err) => {
      console.error(err);
      showMessage("無法取得定位，請確認瀏覽器定位權限已開啟，或改用地址搜尋。");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

async function getGeocoderClass() {
  if (google.maps.Geocoder) return google.maps.Geocoder;
  const lib = await google.maps.importLibrary("geocoding");
  return lib.Geocoder;
}

async function handleAddressSearch() {
  const input = document.getElementById("addressSearch");
  if (!input) return;

  const keyword = input.value.trim();

  if (!keyword) {
    showMessage("請輸入地址或地標。");
    return;
  }

  if (typeof google === "undefined" || !google.maps) {
    showMessage("地圖服務還在載入中，請稍等幾秒再試。");
    return;
  }

  showMessage("正在搜尋地址...");

  try {
    const Geocoder = await getGeocoderClass();

    const hasCity = /台北|臺北/.test(keyword);
    const query = hasCity ? `${keyword}, 台灣` : `${keyword}, 臺北市, 台灣`;

    const { results } = await new Geocoder().geocode({
      address: query,
      region: "tw",
      language: "zh-TW",
    });

    if (!results || results.length === 0) {
      showMessage("找不到這個地址，請試著輸入更完整的地址。");
      return;
    }

    const place = results[0];
    const position = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    if (!isInTaipei(position.lat, position.lng)) {
      showMessage("搜尋結果不在臺北市範圍內，請輸入臺北市的地址或地標。");
      return;
    }

    userPosition = position;
    showUserOnMap(position);

    const summary = recommendCatchableTruck(position);
    showMessage(`📍 ${place.formatted_address || keyword}｜${summary}`);
  } catch (err) {
    console.error("Address search failed:", err);

    if (err && err.code === "ZERO_RESULTS") {
      showMessage("找不到這個地址，請試著輸入更完整的地址。");
    } else {
      showMessage("地址搜尋失敗，請稍後再試。");
    }
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

  map.setView([position.lat, position.lng], 16);
}


// =========================
// 推薦演算法
// =========================
// 回傳一句摘要文字，方便呼叫端顯示
function recommendCatchableTruck(position) {
  clearTruckRoute();

  const now = getCurrentTime();
  const serviceDate = getServiceDate(now);
  const status = getCollectionStatus(serviceDate, now);

  if (!status.isCollectionDay) {
    clearTruckMarkers();
    renderNoCollectionDay(status);
    showMessage(status.message);
    return status.message;
  }

  const mode = TRAVEL_MODES[travelMode];
  const candidates = [];

  for (const station of allStations) {
    if (!isStationActiveOn(station, serviceDate)) continue;

    const arrivalDate = parseScheduleTime(station.time, serviceDate);
    const leaveDate = parseScheduleTime(station.leaveTime, serviceDate);
    if (!arrivalDate || !leaveDate) continue;

    const distanceM = getDistanceMeters(position.lat, position.lng, station.lat, station.lng);
    if (distanceM > mode.maxDistanceM) continue;

    const minutesUntilArrival = (arrivalDate - now) / 60000;
    const minutesUntilLeave = (leaveDate - now) / 60000;

    // 垃圾車已經離開
    if (minutesUntilLeave <= 0) continue;

    const travelMinutes = distanceM / mode.speedMPerMin;

    // 來不及在離開前趕到
    if (travelMinutes + ARRIVE_BUFFER_MIN > minutesUntilLeave) continue;

    candidates.push({
      station,
      distanceM,
      minutesUntilArrival,
      minutesUntilLeave,
      travelMinutes,
      // 最快幾分鐘後可以丟垃圾 = 走到的時間 與 車到的時間 取較晚者
      doneMinutes: Math.max(travelMinutes, minutesUntilArrival),
      // 到了之後還要等多久
      waitMinutes: Math.max(0, minutesUntilArrival - travelMinutes),
      // 離開前還剩多少餘裕
      slackMinutes: minutesUntilLeave - travelMinutes,
      isStoppedNow: minutesUntilArrival <= 0,
    });
  }

  // 依「最快可以丟垃圾的時間」排序，一樣快就比距離
  candidates.sort((a, b) => a.doneMinutes - b.doneMinutes || a.distanceM - b.distanceM);

  // 同一個地點只保留最好的一班
  const seen = new Set();
  const results = [];

  for (const item of candidates) {
    const key = `${item.station.lat.toFixed(5)},${item.station.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= MAX_RECOMMENDATIONS) break;
  }

  if (results.length === 0) {
    clearTruckMarkers();
    renderEmptyRecommendation(mode);
    const msg = `目前${mode.label}範圍內沒有來得及趕上的垃圾車。`;
    showMessage(msg);
    return msg;
  }

  renderRecommendation(results, mode);
  showTrucksOnMap(results, position);

  const msg = `已找到 ${results.length} 個${mode.label}來得及的停靠點。`;
  showMessage(msg);
  return msg;
}


// =========================
// 畫面：推薦卡片
// =========================
function renderRecommendation(results, mode) {
  const box = document.getElementById("result");
  if (!box) return;

  box.innerHTML = `
    <h2>🚛 附近垃圾車</h2>
    ${results.map((item, index) => renderCard(item, index, mode)).join("")}
  `;
}

function renderCard(item, index, mode) {
  const station = item.station;

  const navUrl =
    "https://www.google.com/maps/dir/?api=1" +
    `&destination=${station.lat},${station.lng}` +
    `&travelmode=${mode.googleMode}`;

  const doneText =
    item.doneMinutes < 1
      ? "現在出發就趕得上"
      : `約 ${Math.ceil(item.doneMinutes)} 分鐘後可以丟垃圾`;

  const waitText =
    item.waitMinutes >= 1
      ? `<span class="card-sub">（到了大約要等 ${Math.ceil(item.waitMinutes)} 分鐘）</span>`
      : "";

  const statusText = item.isStoppedNow
    ? "🟢 垃圾車目前正在這裡停靠"
    : `⏳ 垃圾車約 ${Math.ceil(item.minutesUntilArrival)} 分鐘後抵達`;

  const hurryText =
    item.slackMinutes < 3
      ? `<p class="card-warning">⚠️ 時間有點趕，建議馬上出發</p>`
      : "";

  const routeText = station.route ? `（${escapeHtml(station.route)}）` : "";

  return `
    <div class="recommend-card" id="recommend-card-${index}">
      <h3>${index === 0 ? "🏆 最佳推薦" : `#${index + 1}`}</h3>

      <p class="card-highlight">✅ ${doneText}${waitText}</p>
      ${hurryText}

      <p>📍 ${escapeHtml(station.address)}</p>
      <p>🚛 車號：${escapeHtml(station.truck)}${routeText}</p>
      <p>🕒 停靠時間：${escapeHtml(formatScheduleTime(station.time))} ～ ${escapeHtml(formatScheduleTime(station.leaveTime))}</p>
      <p>${statusText}</p>
      <p>🏁 約 ${Math.ceil(item.minutesUntilLeave)} 分鐘後離開</p>
      <p>${mode.icon} ${mode.label}約 ${Math.ceil(item.travelMinutes)} 分鐘（${formatDistance(item.distanceM)}）</p>

      <a href="${navUrl}" target="_blank" rel="noopener noreferrer">
        🧭 Google Maps 導航
      </a>
    </div>
  `;
}

function renderEmptyRecommendation(mode) {
  const box = document.getElementById("result");
  if (!box) return;

  const tip =
    travelMode === "walk"
      ? "可以試試切換成「🛵 騎車」，搜尋範圍會擴大到 3 公里。"
      : "可能已經過了今天的收運時間，或附近暫時沒有班次。";

  box.innerHTML = `
    <h2>🚛 附近垃圾車</h2>
    <p>目前${escapeHtml(mode.label)}範圍內（${formatDistance(mode.maxDistanceM)}），沒有來得及趕上的垃圾車。</p>
    <p class="empty-tip">${tip}</p>
  `;
}

function renderNoCollectionDay(status) {
  const box = document.getElementById("result");
  if (!box) return;

  box.innerHTML = `
    <div class="no-collection-card">
      <div class="no-collection-icon">🛑</div>
      <div>
        <h2>今天暫停收運</h2>
        <p>今天是週${escapeHtml(status.weekdayName)}，臺北市週三、週日例行停止垃圾收運。</p>
        <p><strong>下一次收運：${escapeHtml(status.nextLabel)}</strong></p>
        <p class="no-collection-note">請勿將垃圾放置於路邊，建議於下一個收運日再行丟棄。</p>
      </div>
    </div>
  `;
}


// =========================
// 地圖：推薦標記
// =========================
function showTrucksOnMap(results, position) {
  clearTruckMarkers();

  const points = [[position.lat, position.lng]];

  results.forEach((item, index) => {
    const station = item.station;

    const marker = L.marker([station.lat, station.lng], {
      icon: createRankIcon(index + 1, index === 0),
      zIndexOffset: 500 - index,
    })
      .addTo(map)
      .bindPopup(`
        <strong>${index === 0 ? "🏆 最佳推薦" : `推薦 #${index + 1}`}</strong><br>
        ${escapeHtml(station.address)}
      `);

    const card = document.getElementById(`recommend-card-${index}`);

    const selectRecommendation = () => {
      marker.openPopup();

      document
        .querySelectorAll(".recommend-card.is-selected")
        .forEach((el) => el.classList.remove("is-selected"));

      if (card) {
        card.classList.add("is-selected");
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      showTruckRoute(item);
    };

    marker.on("click", selectRecommendation);

    if (card) {
      card.addEventListener("click", (event) => {
        // 點導航按鈕時只開導航
        if (event.target instanceof Element && event.target.closest("a")) return;
        selectRecommendation();
      });
    }

    truckMarkers.push(marker);
    points.push([station.lat, station.lng]);
  });

  map.fitBounds(L.latLngBounds(points), {
    padding: [60, 60],
    maxZoom: 17,
  });
}

function clearTruckMarkers() {
  truckMarkers.forEach((marker) => map.removeLayer(marker));
  truckMarkers = [];
}


// =========================
// 地圖：垃圾車後續路線
// =========================
function getRouteKey(station) {
  return `${station.truck}|${station.time}|${station.lat}|${station.lng}`;
}

function showTruckRoute(item) {
  const routeKey = getRouteKey(item.station);

  // 再點一次同一個推薦點：收合路線
  if (currentRouteKey === routeKey) {
    clearTruckRoute();
    return;
  }

  clearTruckRoute();
  currentRouteKey = routeKey;

  const serviceDate = getServiceDate(getCurrentTime());
  const startDate = parseScheduleTime(item.station.time, serviceDate);
  if (!startDate) return;

  const endDate = new Date(startDate.getTime() + ROUTE_PREVIEW_MIN * 60000);

  const stops = allStations
    .filter((s) => s.truck === item.station.truck && isStationActiveOn(s, serviceDate))
    .map((s) => ({ station: s, date: parseScheduleTime(s.time, serviceDate) }))
    .filter((x) => x.date && x.date >= startDate && x.date <= endDate)
    .sort((a, b) => a.date - b.date);

  routeLine = L.polyline(
    stops.map((x) => [x.station.lat, x.station.lng]),
    {
      color: "#1976d2",
      weight: 5,
      opacity: 0.8,
      dashArray: "10,10",
    }
  ).addTo(map);

  stops.forEach(({ station }) => {
    if (getRouteKey(station) === routeKey) return;

    const marker = L.marker([station.lat, station.lng], {
      icon: createTruckIcon(),
      zIndexOffset: 2000,
    })
      .addTo(map)
      .bindPopup(`
        <strong>🚛 ${escapeHtml(station.truck)}</strong><br>
        🕒 ${escapeHtml(formatScheduleTime(station.time))} ～ ${escapeHtml(formatScheduleTime(station.leaveTime))}<br>
        📍 ${escapeHtml(station.address)}
      `);

    routeMarkers.push(marker);
  });

  showRouteToggleButton();
}

function clearTruckRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  routeMarkers.forEach((marker) => map.removeLayer(marker));
  routeMarkers = [];

  currentRouteKey = null;
  hideRouteToggleButton();
}

function showRouteToggleButton() {
  let button = document.getElementById("toggleRecommendationMarkersBtn");

  if (!button) {
    button = document.createElement("button");
    button.id = "toggleRecommendationMarkersBtn";
    button.type = "button";
    button.title = "隱藏路徑";
    button.setAttribute("aria-label", "隱藏路徑");
    button.innerHTML = "<span>隱藏</span><span>路徑</span>";
    button.addEventListener("click", clearTruckRoute);

    document.getElementById("map")?.appendChild(button);
  }

  button.style.display = "flex";
}

function hideRouteToggleButton() {
  const button = document.getElementById("toggleRecommendationMarkersBtn");
  if (button) button.style.display = "none";
}


// =========================
// 小工具
// =========================
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} 公里`;
  return `${Math.round(meters)} 公尺`;
}

function showMessage(message) {
  const box = document.getElementById("message");
  if (box) box.textContent = message;
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
    iconSize: [56, 56],
    iconAnchor: [28, 56],   // 圖釘尖端在底部中央
    popupAnchor: [0, -56],
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

function createRankIcon(rank, isBest) {
  return L.divIcon({
    className: `rank-icon${isBest ? " is-best" : ""}`,
    html: `<span>${rank}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}