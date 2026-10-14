// =========================================================
// 台北垃圾車即時查詢  script.js  v1.6.0
// =========================================================


// =========================
// 基本設定
// =========================
const DATA_URL = "./garbage.json";

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
    speedMPerMin: 275,     // 每分鐘約 275 公尺
    maxDistanceM: 3000,    // 最遠搜尋 3 公里
    googleMode: "driving",
  },
};
const DEFAULT_TRAVEL_MODE = "walk";

const ARRIVE_BUFFER_MIN = 1;       // 至少要比垃圾車離開早幾分鐘到
const MAX_RECOMMENDATIONS = 10;    // 最多推薦幾個停靠點
const ROUTE_PREVIEW_MIN = 40;      // 點選後顯示之後幾分鐘的路線
const SERVICE_DAY_START_HOUR = 5;  // 凌晨 5 點前，算是前一天的收運班次
const AUTO_REFRESH_MS = 60 * 1000; // 每 60 秒自動更新
const UPCOMING_SUGGESTIONS = 3;    // 沒有班次時，列出下一個收運日幾個最近的停靠點

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
const DEV_TEST_DATE = "2026-08-03";
const DEV_TEST_TIME = "19:58";
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
let currentResults = [];
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
  startAutoRefresh();
  autoLocateIfPermitted();
}

function initMap() {
  map = L.map("map").setView([25.04, 121.55], 13);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
    crossOrigin: true,
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 300);
}

function bindEvents() {
  document.getElementById("locateBtn")?.addEventListener("click", locateUser);

  // 用 form 的 submit：按 Enter 或手機鍵盤的「搜尋」都會觸發，注音選字時不會誤觸
  document.getElementById("searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAddressSearch();
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTravelMode(btn.dataset.mode));
  });

  document.getElementById("recenterBtn")?.addEventListener("click", recenterMap);
  document.getElementById("hideRouteBtn")?.addEventListener("click", clearTruckRoute);

  const resultBox = document.getElementById("result");
  resultBox?.addEventListener("click", handleResultClick);
  resultBox?.addEventListener("keydown", handleResultKeydown);
}

// 結果區所有點擊集中處理（卡片、切換騎車、重新整理）
function handleResultClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest("a")) return; // 點導航連結就交給瀏覽器

  const el = target.closest("[data-action]");
  if (!el) return;

  switch (el.dataset.action) {
    case "select":
      selectRecommendation(Number(el.dataset.index), true);
      break;
    case "switch-ride":
      setTravelMode("ride");
      break;
    case "refresh":
      refreshRecommendation(true);
      break;
  }
}

// 鍵盤操作：卡片上按 Enter 或空白鍵
function handleResultKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target instanceof Element
    ? event.target.closest('[data-action="select"]')
    : null;

  if (!card || event.target !== card) return;

  event.preventDefault();
  selectRecommendation(Number(card.dataset.index), true);
}


// =========================
// 前往方式（步行 / 騎車）
// =========================
function loadTravelMode() {
  try {
    const saved = localStorage.getItem("travelMode");
    if (saved && TRAVEL_MODES[saved]) return saved;
  } catch (e) {
    // 無痕模式可能無法使用 localStorage
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
    const result = recommendCatchableTruck(userPosition);
    showMessage(`已切換為${TRAVEL_MODES[mode].label}｜${result.text}`, result.type);
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

// 「收運日」：凌晨 5 點前還算前一天
function getServiceDate(now) {
  const d = new Date(now);
  if (d.getHours() < SERVICE_DAY_START_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

// "1630"、"2410"、"16:30" → 實際日期時間
function parseScheduleTime(timeText, serviceDate) {
  const match = String(timeText || "").trim().match(/^(\d{1,2})[:：]?(\d{2})$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);

  if (minute > 59 || hour > 29) return null;
  if (hour < SERVICE_DAY_START_HOUR) hour += 24;

  const date = new Date(serviceDate);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// "2410" → "00:10"
function formatScheduleTime(timeText) {
  const match = String(timeText || "").trim().match(/^(\d{1,2})[:：]?(\d{2})$/);
  if (!match) return timeText || "未知";

  const hour = Number(match[1]) % 24;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

// Date → "18:10"
function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// → "明天（週四）"
function getRelativeDayLabel(date, now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diff = Math.round((target - today) / 86400000);

  let relative;
  if (diff <= 0) relative = "今天";
  else if (diff === 1) relative = "明天";
  else if (diff === 2) relative = "後天";
  else relative = `${diff} 天後`;

  return `${relative}（週${WEEKDAY_NAMES[target.getDay()]}）`;
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

  const weekdayName = WEEKDAY_NAMES[serviceDate.getDay()];
  const nextLabel = getRelativeDayLabel(nextDate, now);

  return {
    isCollectionDay: false,
    weekdayName,
    nextLabel,
    message: `今天週${weekdayName}停收，下一次收運是${nextLabel}。`,
  };
}

// 解析「週一、週四收運」「週二、週五無收運」「每星期一、四收運」
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
  } catch (err) {
    console.error("Failed to load garbage data:", err);

    const info = document.getElementById("dataStatus");
    if (info) info.textContent = "資料載入失敗";

    showMessage("資料載入失敗，請稍後重新整理頁面。", "error");
  }
}

function normalizeStation(raw) {
  let lat = Number(raw.lat);
  let lng = Number(raw.lng);

  if (!isInTaipei(lat, lng)) {
    if (isInTaipei(lng, lat)) {
      [lat, lng] = [lng, lat];
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

  const updatedAt = data?.meta?.updatedAt ? new Date(data.meta.updatedAt) : null;

  const timeText =
    updatedAt && !Number.isNaN(updatedAt.getTime())
      ? updatedAt.toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "未知";

  info.textContent = `資料更新：${timeText}・${allStations.length} 個停靠點`;
}


// =========================
// 自動更新
// =========================
function startAutoRefresh() {
  setInterval(() => {
    if (!document.hidden) refreshRecommendation();
  }, AUTO_REFRESH_MS);

  // 從其他 App 切回來時立刻更新
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshRecommendation();
  });
}

function refreshRecommendation(manual = false) {
  if (!userPosition) return;

  const result = recommendCatchableTruck(userPosition, {
    fitMap: false,
    keepRoute: true,
  });

  if (manual) {
    showMessage(`已更新｜${result.text}`, result.type);
  }
}


// =========================
// 定位 / 地址搜尋
// =========================
// 使用者之前已允許定位，就自動定位
async function autoLocateIfPermitted() {
  if (DEV_MODE || !navigator.permissions?.query) return;

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" });
    if (permission.state === "granted") locateUser();
  } catch (e) {
    // 部分瀏覽器不支援，忽略
  }
}

function locateUser() {
  if (DEV_MODE && DEV_TEST_POSITION) {
    setUserPosition(DEV_TEST_POSITION, "🧪 測試座標");
    return;
  }

  if (!navigator.geolocation) {
    showMessage("此瀏覽器不支援定位，請改用地址搜尋。", "error");
    return;
  }

  const btn = document.getElementById("locateBtn");
  setButtonBusy(btn, true, "定位中…");
  showMessage("正在取得你的位置…");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setButtonBusy(btn, false);
      setUserPosition(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        "📍 你的位置"
      );
    },
    (err) => {
      setButtonBusy(btn, false);
      console.error(err);
      showMessage(getGeoErrorMessage(err), "error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );
}

function getGeoErrorMessage(err) {
  switch (err && err.code) {
    case 1:
      return "定位權限被拒絕。請點網址列左側的圖示開啟定位，或改用地址搜尋。";
    case 2:
      return "目前收不到定位訊號，請稍後再試，或改用地址搜尋。";
    case 3:
      return "定位逾時，請再按一次，或改用地址搜尋。";
    default:
      return "無法取得定位，請改用地址搜尋。";
  }
}

function setUserPosition(position, label) {
  if (!isInTaipei(position.lat, position.lng)) {
    showMessage("這個位置不在臺北市範圍內，請改用地址搜尋臺北市的地點。", "warn");
    return;
  }

  userPosition = position;
  showUserOnMap(position, label);

  const result = recommendCatchableTruck(position);
  showMessage(`${label}｜${result.text}`, result.type);
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
    showMessage("請輸入地址或地標。", "warn");
    input.focus();
    return;
  }

  if (typeof google === "undefined" || !google.maps) {
    showMessage("地圖服務還在載入中，請稍等幾秒再試。", "warn");
    return;
  }

  const btn = document.getElementById("addressSearchBtn");
  setButtonBusy(btn, true, "搜尋中");
  showMessage("正在搜尋地址…");

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
      showMessage("找不到這個地址，請試著輸入更完整的地址。", "warn");
      return;
    }

    const place = results[0];
    const position = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    const placeName = (place.formatted_address || keyword)
      .replace(/^\d+/, "")
      .replace(/^台灣/, "");

    input.blur(); // 手機收起鍵盤
    setUserPosition(position, `📍 ${placeName}`);
  } catch (err) {
    console.error("Address search failed:", err);

    if (err && err.code === "ZERO_RESULTS") {
      showMessage("找不到這個地址，請試著輸入更完整的地址。", "warn");
    } else {
      showMessage("地址搜尋失敗，請稍後再試。", "error");
    }
  } finally {
    setButtonBusy(btn, false);
  }
}

function showUserOnMap(position, label) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  userMarker = L.marker([position.lat, position.lng], {
    icon: createUserIcon(),
    zIndexOffset: 1000,
    keyboard: false,
  })
    .addTo(map)
    .bindPopup(escapeHtml(label));

  document.getElementById("recenterBtn")?.classList.add("is-visible");
}

function recenterMap() {
  if (!userPosition) return;

  const points = [
    [userPosition.lat, userPosition.lng],
    ...currentResults.map((item) => [item.station.lat, item.station.lng]),
  ];

  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 17 });
  } else {
    map.setView(points[0], 16);
  }
}


// =========================
// 推薦演算法
// =========================
// 回傳 { text, type }，讓呼叫端決定要不要顯示訊息
function recommendCatchableTruck(position, { fitMap = true, keepRoute = false } = {}) {
  const previousRouteKey = keepRoute ? currentRouteKey : null;
  clearTruckRoute();

  const now = getCurrentTime();
  const serviceDate = getServiceDate(now);
  const status = getCollectionStatus(serviceDate, now);
  const mode = TRAVEL_MODES[travelMode];

  // 停收日
  if (!status.isCollectionDay) {
    clearTruckMarkers();
    currentResults = [];
    renderNoCollectionDay(status, findUpcomingStations(position, serviceDate, mode, now));
    if (fitMap) map.setView([position.lat, position.lng], 15);
    return { text: status.message, type: "warn" };
  }

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
    if (minutesUntilLeave <= 0) continue;

    const travelMinutes = distanceM / mode.speedMPerMin;
    if (travelMinutes + ARRIVE_BUFFER_MIN > minutesUntilLeave) continue;

    candidates.push({
      station,
      distanceM,
      minutesUntilArrival,
      minutesUntilLeave,
      travelMinutes,
      doneMinutes: Math.max(travelMinutes, minutesUntilArrival),
      waitMinutes: Math.max(0, minutesUntilArrival - travelMinutes),
      slackMinutes: minutesUntilLeave - travelMinutes,
      isStoppedNow: minutesUntilArrival <= 0,
    });
  }

  candidates.sort((a, b) => a.doneMinutes - b.doneMinutes || a.distanceM - b.distanceM);

  // 同一地點只保留最好的一班
  const seen = new Set();
  const results = [];

  for (const item of candidates) {
    const key = `${item.station.lat.toFixed(5)},${item.station.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= MAX_RECOMMENDATIONS) break;
  }

  currentResults = results;

  // 沒有班次
  if (results.length === 0) {
    clearTruckMarkers();
    renderEmptyRecommendation(mode, findUpcomingStations(position, serviceDate, mode, now), now);
    if (fitMap) map.setView([position.lat, position.lng], 15);
    return { text: `${mode.label}範圍內暫時沒有趕得上的垃圾車。`, type: "warn" };
  }

  renderRecommendation(results, mode, now);
  showTrucksOnMap(results, position, fitMap);

  // 自動更新時，保留原本打開的路線
  if (previousRouteKey) {
    const index = results.findIndex((item) => getRouteKey(item.station) === previousRouteKey);
    if (index >= 0) {
      showTruckRoute(results[index], { fit: false });
      highlightCard(index, false);
    }
  }

  return { text: `找到 ${results.length} 個${mode.label}來得及的停靠點。`, type: "success" };
}

// 找下一個收運日，離使用者最近的幾個停靠點
function findUpcomingStations(position, serviceDate, mode, now) {
  for (let offset = 1; offset <= 7; offset++) {
    const date = new Date(serviceDate);
    date.setDate(date.getDate() + offset);

    if (!isRegularCollectionDay(date)) continue;

    const items = [];

    for (const station of allStations) {
      if (!isStationActiveOn(station, date)) continue;

      const arrival = parseScheduleTime(station.time, date);
      if (!arrival) continue;

      const distanceM = getDistanceMeters(position.lat, position.lng, station.lat, station.lng);
      if (distanceM > mode.maxDistanceM) continue;

      items.push({ station, arrival, distanceM });
    }

    if (items.length === 0) continue;

    items.sort((a, b) => a.distanceM - b.distanceM || a.arrival - b.arrival);

    const seen = new Set();
    const picked = [];

    for (const item of items) {
      const key = `${item.station.lat.toFixed(5)},${item.station.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(item);
      if (picked.length >= UPCOMING_SUGGESTIONS) break;
    }

    return { label: getRelativeDayLabel(date, now), items: picked };
  }

  return null;
}


// =========================
// 畫面：結果區
// =========================
function renderResultHeader(title, now) {
  return `
    <div class="result-header">
      <h2>${title}</h2>
      <button type="button" class="refresh-btn" data-action="refresh" title="重新計算">
        🔄 ${formatClock(now)}
      </button>
    </div>
  `;
}

function renderRecommendation(results, mode, now) {
  const box = document.getElementById("result");
  if (!box) return;

  box.innerHTML = `
    ${renderResultHeader("附近垃圾車", now)}
    <p class="result-hint">依「最快可以丟垃圾」排序・點卡片看路線</p>
    <div class="card-list">
      ${results.map((item, index) => renderCard(item, index, mode, now)).join("")}
    </div>
  `;
}

function renderCard(item, index, mode, now) {
  const station = item.station;
  const shortAddress = formatShortAddress(station.address);

  const navUrl =
    "https://www.google.com/maps/dir/?api=1" +
    `&destination=${station.lat},${station.lng}` +
    `&travelmode=${mode.googleMode}`;

  const doneAt = formatClock(new Date(now.getTime() + item.doneMinutes * 60000));
  const etaMain = item.doneMinutes < 1 ? "現在出發" : `${Math.ceil(item.doneMinutes)} 分鐘後`;
  const etaSub =
    item.waitMinutes >= 1
      ? `約 ${doneAt} 可以丟・到了等 ${Math.ceil(item.waitMinutes)} 分鐘`
      : `約 ${doneAt} 可以丟・到了不用等`;

  const statusText = item.isStoppedNow
    ? `🟢 正在停靠，約 ${Math.ceil(item.minutesUntilLeave)} 分鐘後離開`
    : `⏳ ${Math.ceil(item.minutesUntilArrival)} 分鐘後抵達，停到 ${formatScheduleTime(station.leaveTime)}`;

  const warning =
    item.slackMinutes < 3 ? `<p class="card-warning">⚠️ 時間很趕，建議馬上出發</p>` : "";

  const meta = [station.district, station.route].filter(Boolean).join("・");

  return `
    <article
      class="recommend-card${index === 0 ? " is-best" : ""}"
      data-action="select"
      data-index="${index}"
      tabindex="0"
      role="button"
      aria-pressed="false"
      aria-label="第 ${index + 1} 名：${escapeHtml(shortAddress)}，${etaMain}可以丟垃圾"
    >
      <div class="card-top">
        <span class="card-rank">${index + 1}</span>
        <div class="card-eta">
          <strong>${etaMain}</strong>
          <span>${etaSub}</span>
        </div>
        ${index === 0 ? '<span class="card-badge">最佳</span>' : ""}
      </div>

      ${warning}

      <p class="card-address">${escapeHtml(shortAddress)}</p>
      ${meta ? `<p class="card-meta">${escapeHtml(meta)}</p>` : ""}

      <div class="card-chips">
        <span class="chip">${mode.icon} ${Math.ceil(item.travelMinutes)} 分・${formatDistance(item.distanceM)}</span>
        <span class="chip">🕒 ${formatScheduleTime(station.time)}–${formatScheduleTime(station.leaveTime)}</span>
        <span class="chip">🚛 ${escapeHtml(station.truck)}</span>
      </div>

      <p class="card-status">${statusText}</p>

      <div class="card-actions">
        <a class="nav-btn" href="${navUrl}" target="_blank" rel="noopener noreferrer">🧭 Google 導航</a>
        <span class="route-hint">
          <span class="hint-show">🗺️ 看路線</span>
          <span class="hint-hide">收合路線</span>
        </span>
      </div>
    </article>
  `;
}

function renderUpcoming(upcoming) {
  if (!upcoming || upcoming.items.length === 0) return "";

  return `
    <div class="upcoming">
      <h3>${escapeHtml(upcoming.label)}離你最近的停靠點</h3>
      <ul>
        ${upcoming.items
          .map(
            (item) => `
              <li>
                <span class="upcoming-time">${formatScheduleTime(item.station.time)}</span>
                <span class="upcoming-place">${escapeHtml(formatShortAddress(item.station.address))}</span>
                <span class="upcoming-dist">${formatDistance(item.distanceM)}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    </div>
  `;
}

function renderEmptyRecommendation(mode, upcoming, now) {
  const box = document.getElementById("result");
  if (!box) return;

  const switchButton =
    travelMode === "walk"
      ? `<button type="button" class="secondary-btn" data-action="switch-ride">🛵 改用騎車搜尋 3 公里內</button>`
      : "";

  box.innerHTML = `
    ${renderResultHeader("附近垃圾車", now)}
    <div class="empty-state">
      <div class="empty-icon">🌙</div>
      <h3>附近暫時沒有趕得上的垃圾車</h3>
      <p>${escapeHtml(mode.label)}範圍（${formatDistance(mode.maxDistanceM)}）內，今天的班次已結束或來不及。</p>
      ${switchButton}
    </div>
    ${renderUpcoming(upcoming)}
  `;
}

function renderNoCollectionDay(status, upcoming) {
  const box = document.getElementById("result");
  if (!box) return;

  box.innerHTML = `
    <div class="no-collection-card">
      <div class="no-collection-icon">🛑</div>
      <div>
        <h2>今天暫停收運</h2>
        <p>今天是週${escapeHtml(status.weekdayName)}，臺北市週三、週日例行停收。</p>
        <p><strong>下一次收運：${escapeHtml(status.nextLabel)}</strong></p>
        <p class="no-collection-note">請勿將垃圾放置於路邊。</p>
      </div>
    </div>
    ${renderUpcoming(upcoming)}
  `;
}

function highlightCard(index, scroll) {
  document.querySelectorAll(".recommend-card").forEach((card) => {
    const active = Number(card.dataset.index) === index;
    card.classList.toggle("is-selected", active);
    card.setAttribute("aria-pressed", String(active));

    if (active && scroll) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}


// =========================
// 地圖：推薦標記
// =========================
function showTrucksOnMap(results, position, fitMap) {
  clearTruckMarkers();

  results.forEach((item, index) => {
    const station = item.station;

    const marker = L.marker([station.lat, station.lng], {
      icon: createRankIcon(index + 1, index === 0),
      zIndexOffset: 500 - index,
      title: formatShortAddress(station.address),
    })
      .addTo(map)
      .bindPopup(
        `
          <strong>#${index + 1} ${escapeHtml(formatShortAddress(station.address))}</strong><br>
          🕒 ${formatScheduleTime(station.time)}–${formatScheduleTime(station.leaveTime)}
        `,
        { autoPan: false }
      );

    marker.on("click", () => selectRecommendation(index, false));
    truckMarkers.push(marker);
  });

  if (fitMap) {
    const points = [
      [position.lat, position.lng],
      ...results.map((item) => [item.station.lat, item.station.lng]),
    ];
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 17 });
  }
}

function clearTruckMarkers() {
  truckMarkers.forEach((marker) => map.removeLayer(marker));
  truckMarkers = [];
}

// 點卡片或地圖標記：顯示路線；再點一次：收合
function selectRecommendation(index, fromCard) {
  const item = currentResults[index];
  if (!item) return;

  const marker = truckMarkers[index];

  if (currentRouteKey === getRouteKey(item.station)) {
    clearTruckRoute();
    marker?.closePopup();
    return;
  }

  showTruckRoute(item);
  highlightCard(index, !fromCard);
  marker?.openPopup();
}


// =========================
// 地圖：垃圾車後續路線
// =========================
function getRouteKey(station) {
  return `${station.truck}|${station.time}|${station.lat}|${station.lng}`;
}

function showTruckRoute(item, { fit = true } = {}) {
  clearTruckRoute();

  const routeKey = getRouteKey(item.station);
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

  const points = stops.map((x) => [x.station.lat, x.station.lng]);

  routeLine = L.polyline(points, {
    color: "#1976d2",
    weight: 5,
    opacity: 0.8,
    dashArray: "10,10",
  }).addTo(map);

  stops.forEach(({ station }) => {
    if (getRouteKey(station) === routeKey) return;

    const marker = L.marker([station.lat, station.lng], {
      icon: createTruckIcon(),
      zIndexOffset: 2000,
      keyboard: false,
    })
      .addTo(map)
      .bindPopup(`
        <strong>🚛 ${escapeHtml(station.truck)}</strong><br>
        🕒 ${formatScheduleTime(station.time)}–${formatScheduleTime(station.leaveTime)}<br>
        📍 ${escapeHtml(formatShortAddress(station.address))}
      `);

    routeMarkers.push(marker);
  });

  document.getElementById("hideRouteBtn")?.classList.add("is-visible");

  if (fit && points.length > 0) {
    const bounds = L.latLngBounds(points);
    if (userPosition) bounds.extend([userPosition.lat, userPosition.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
  }
}

function clearTruckRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }

  routeMarkers.forEach((marker) => map.removeLayer(marker));
  routeMarkers = [];

  currentRouteKey = null;
  document.getElementById("hideRouteBtn")?.classList.remove("is-visible");
  highlightCard(-1, false);
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
  return `${Math.round(meters / 10) * 10} 公尺`;
}

// "臺北市中山區農安街182號" → "農安街182號"
function formatShortAddress(address) {
  const short = String(address || "")
    .replace(/^臺?(臺|台)北市/, "")
    .replace(/^[\u4e00-\u9fff]{2}區/, "");
  return short || address || "未知地點";
}

function showMessage(text, type = "info") {
  const box = document.getElementById("message");
  if (!box) return;

  box.textContent = text;
  box.className = `message is-${type}`;
}

function setButtonBusy(btn, busy, busyText) {
  if (!btn) return;

  if (busy) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = busyText;
    btn.disabled = true;
    btn.classList.add("is-busy");
  } else {
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    delete btn.dataset.originalText;
    btn.disabled = false;
    btn.classList.remove("is-busy");
  }
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
    className: "user-icon",
    html: '<span class="user-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

function createTruckIcon() {
  return L.divIcon({
    className: "truck-icon",
    html: "🚛",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
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