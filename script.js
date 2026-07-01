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
    console.error(error);

    var dataStatus = document.getElementById("dataStatus");

    if (dataStatus) {
        dataStatus.innerHTML =
            "錯誤：<br>" +
            error.name + "<br>" +
            error.message;
    }

    alert(error.name + "\n" + error.message);
});
var userMarker = null;

var locateBtn = document.getElementById("locateBtn");

if (locateBtn) {
  locateBtn.addEventListener("click", function () {
    alert("已按下使用我的位置");

    if (!navigator.geolocation) {
      alert("你的瀏覽器不支援定位功能。");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      function (position) {
        alert("定位成功");

        var userLat = position.coords.latitude;
        var userLng = position.coords.longitude;

        if (userMarker) {
          map.removeLayer(userMarker);
        }

        userMarker = L.marker([userLat, userLng])
          .addTo(map)
          .bindPopup("你的位置")
          .openPopup();

        map.setView([userLat, userLng], 16);
      },
      function (error) {
        alert("定位失敗：" + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
} else {
  alert("找不到 locateBtn 按鈕");
}