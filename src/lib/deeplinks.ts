// 高德地图 길찾기
export function openAmap(destLat: string, destLng: string, destName: string) {
  // 高德 앱 딥링크 (좌표는 GCJ-02 좌표계)
  const appUrl = `amapuri://route/plan/?dlat=${destLat}&dlon=${destLng}&dname=${encodeURIComponent(destName)}&dev=0&t=0`;
  // 웹 폴백
  const webUrl = `https://uri.amap.com/navigation?to=${destLng},${destLat},${encodeURIComponent(destName)}&mode=car&callnative=1`;

  tryOpenApp(appUrl, webUrl);
}

// 百度地图 길찾기
export function openBaiduMap(destLat: string, destLng: string, destName: string) {
  // 百度 앱 딥링크
  const appUrl = `baidumap://map/direction?destination=latlng:${destLat},${destLng}|name:${encodeURIComponent(destName)}&coord_type=gcj02&mode=driving`;
  // 웹 폴백
  const webUrl = `https://api.map.baidu.com/direction?destination=latlng:${destLat},${destLng}|name:${encodeURIComponent(destName)}&mode=driving&coord_type=gcj02&output=html`;

  tryOpenApp(appUrl, webUrl);
}

// 嘀嘀打车 (위챗 미니프로그램으로 호출)
export function openDidi(destLat: string, destLng: string, destName: string) {
  // 디디 위챗 미니프로그램 링크
  const wechatUrl = `weixin://dl/business/?t=didi&dlat=${destLat}&dlng=${destLng}&dname=${encodeURIComponent(destName)}`;
  // 디디 앱 딥링크
  const appUrl = `didapinche://booking?flat=&flon=&flat_type=0&tlat=${destLat}&tlon=${destLng}&tname=${encodeURIComponent(destName)}`;
  // 웹 폴백 (디디 H5)
  const webUrl = `https://common.diditaxi.com.cn/general/webEntry?wx_app=normal&scene=1&lat=${destLat}&lng=${destLng}&daddr=${encodeURIComponent(destName)}`;

  try {
    window.location.href = wechatUrl;
    window.setTimeout(() => {
      tryOpenApp(appUrl, webUrl);
    }, 2000);
  } catch {
    tryOpenApp(appUrl, webUrl);
  }
}

// 앱 열기 시도, 실패시 웹으로
function tryOpenApp(appUrl: string, webUrl: string) {
  const start = Date.now();
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = appUrl;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    document.body.removeChild(iframe);
    if (Date.now() - start < 2500) {
      window.open(webUrl, "_blank");
    }
  }, 2000);
}

// 지도 선택 액션시트
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
