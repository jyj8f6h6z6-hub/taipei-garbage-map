var map = L.map("map").setView([25.0330, 121.5654], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

var stations = [];

fetch("garbage.json")
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    if (Array.isArray(data)) {
      stations = data;
    } else if (data && Array.isArray(data.stations)) {
      stations = data.stations;
    } else {
      throw new Error("garbage.json 裡找不到 stations 陣列");
    }

    var dataStatus = document.getElementById("dataStatus");

    if (dataStatus) {
      var meta = data.meta || {};
      var total = meta.totalValid || stations.length;
      var updatedAt = meta.updatedAt;
      var updatedText = "未知";

      if (updatedAt) {
        updatedText = new Date(updatedAt).toLocaleString("zh-TW", {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      dataStatus.textContent =
        "資料最後更新：" + updatedText + "｜共 " + total + " 個停靠點";
    }

    stations.forEach(function (station) {
      L.marker([station.lat, station.lng])
        .addTo(map)
        .bindPopup(
          "<strong>" + station.name + "</strong><br>" +
          station.address + "<br>" +
          "垃圾車時間：" + station.time
        );
    });
  })
  .catch(function (error) {
    console.error("載入 garbage.json 失敗：", error);

    var dataStatus = document.getElementById("dataStatus");
    if (dataStatus) {
      dataStatus.textContent = "資料載入失敗，請稍後再試。";
    }
  });