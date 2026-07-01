const map = L.map("map").setView([25.0330, 121.5654], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

let stations = [];
let userMarker = null;

fetch("garbage.json")
  .then(response => response.json())
  .then(data => {
    stations = data;

    stations.forEach(station => {
      L.marker([station.lat, station.lng])
        .addTo(map)
        .bindPopup(`
          <strong>${station.name}</strong><br>
          ${station.address}<br>
          垃圾車時間：${station.time}
        `);
    });
  });
document.getElementById("locateBtn").addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(
    position => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      if (userMarker) {
        map.removeLayer(userMarker);
      }

      userMarker = L.marker([userLat, userLng])
        .addTo(map)
        .bindPopup("你的位置")
        .openPopup();

      map.setView([userLat, userLng], 16);
      findBestStation(userLat, userLng);
    },
    error => {
      alert("無法取得定位，請確認瀏覽器定位權限已開啟。");
    }
  );
});
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = Math.PI / 180;

  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getMinutesUntil(timeText) {
  const now = new Date();
  const [hour, minute] = timeText.split(":").map(Number);

  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  return Math.round((target - now) / 1000 / 60);
}

function findBestStation(userLat, userLng) {
  const walkingSpeedMetersPerMinute = 70;

  const candidates = stations
    .map(station => {
      const distance = getDistanceMeters(
        userLat,
        userLng,
        station.lat,
        station.lng
      );

      const walkMinutes = Math.ceil(distance / walkingSpeedMetersPerMinute);
      const minutesUntil = getMinutesUntil(station.time);

      return {
        ...station,
        distance,
        walkMinutes,
        minutesUntil
      };
    })
    .filter(station => {
      return station.minutesUntil >= station.walkMinutes;
    })
    .sort((a, b) => {
      return a.minutesUntil - b.minutesUntil;
    });

  const result = document.getElementById("result");

  if (candidates.length === 0) {
    result.innerHTML = "目前附近沒有可趕上的垃圾車。";
    return;
  }

  const best = candidates[0];

  result.innerHTML = `
    <h2>最快可趕上的垃圾車</h2>
    <p><strong>${best.name}</strong></p>
    <p>${best.address}</p>
    <p>距離：約 ${Math.round(best.distance)} 公尺</p>
    <p>步行：約 ${best.walkMinutes} 分鐘</p>
    <p>垃圾車約 ${best.minutesUntil} 分鐘後到</p>
    <a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lng}">
      開啟 Google 地圖導航
    </a>
  `;
}