// 高德地图 — 좌표 우선, 없으면 키워드 검색 (window.open)
export function openAmap(destLat: string, destLng: string, destName: string) {
  if (!destLat || !destLng) {
    const webUrl =
      "https://uri.amap.com/search?keyword=" + encodeURIComponent(destName) + "&city=青岛";
    window.open(webUrl, "_blank");
    return;
  }
  const webUrl =
    "https://uri.amap.com/navigation?to=" +
    destLng +
    "," +
    destLat +
    "," +
    encodeURIComponent(destName) +
    "&mode=car&callnative=1";
  window.open(webUrl, "_blank");
}

// 百度地图
export function openBaiduMap(destLat: string, destLng: string, destName: string) {
  if (!destLat || !destLng) {
    const webUrl =
      "https://api.map.baidu.com/place/search?query=" +
      encodeURIComponent(destName) +
      "&region=青岛&output=html";
    window.open(webUrl, "_blank");
    return;
  }
  const webUrl =
    "https://api.map.baidu.com/direction?destination=latlng:" +
    destLat +
    "," +
    destLng +
    "|name:" +
    encodeURIComponent(destName) +
    "&mode=driving&coord_type=gcj02&output=html";
  window.open(webUrl, "_blank");
}

// 嘀嘀 — H5 (좌표 없으면 일반 진입)
export function openDidi(destLat: string, destLng: string, destName: string) {
  if (!destLat || !destLng) {
    window.open("https://common.diditaxi.com.cn/general/webEntry?wx_app=normal&scene=1", "_blank");
    return;
  }
  const webUrl =
    "https://common.diditaxi.com.cn/general/webEntry?wx_app=normal&scene=1&lat=" +
    destLat +
    "&lng=" +
    destLng +
    "&daddr=" +
    encodeURIComponent(destName);
  window.open(webUrl, "_blank");
}

export function showMapOptions(
  destLat: string,
  destLng: string,
  destName: string
): Array<{ label: string; icon: string; action: () => void }> {
  return [
    {
      label: "高德地图으로 길찾기",
      icon: "🗺️",
      action: () => openAmap(destLat, destLng, destName),
    },
    {
      label: "百度地图으로 길찾기",
      icon: "📍",
      action: () => openBaiduMap(destLat, destLng, destName),
    },
  ];
}
