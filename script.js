fetch("garbage.json")
  .then(response => response.json())
  .then(data => {
    if (Array.isArray(data)) {
      stations = data;
    } else if (Array.isArray(data.stations)) {
      stations = data.stations;
    } else {
      console.error("garbage.json 格式錯誤：", data);
      throw new Error("garbage.json 裡找不到 stations 陣列");
    }

    const dataStatus = document.getElementById("dataStatus");

    if (dataStatus) {
      const total = data.meta?.totalValid || stations.length;
      const updatedAt = data.meta?.updatedAt;

      let updatedText = "未知";

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

      dataStatus.textContent = `資料最後更新：${updatedText}｜共 ${total} 個停靠點`;
    }

    stations.forEach(station => {
      L.marker([station.lat, station.lng])
        .addTo(map)
        .bindPopup(`
          <strong>${station.name}</strong><br>
          ${station.address}<br>
          垃圾車時間：${station.time}
        `);
    });
  })
  .catch(error => {
    console.error("載入 garbage.json 失敗：", error);

    const dataStatus = document.getElementById("dataStatus");
    if (dataStatus) {
      dataStatus.textContent = "資料載入失敗，請稍後再試。";
    }
  });