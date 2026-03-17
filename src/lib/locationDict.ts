export const locationDict: Record<
  string,
  { zh: string; type: string; lat: string; lng: string }
> = {
  // ═══ 행정구역 ═══
  // 市南区
  "시남": { zh: "市南区", type: "district", lat: "36.075", lng: "120.412" },
  "시남구": { zh: "市南区", type: "district", lat: "36.075", lng: "120.412" },
  "스난": { zh: "市南区", type: "district", lat: "36.075", lng: "120.412" },
  "스난구": { zh: "市南区", type: "district", lat: "36.075", lng: "120.412" },

  // 市北区
  "시북": { zh: "市北区", type: "district", lat: "36.087", lng: "120.374" },
  "시북구": { zh: "市北区", type: "district", lat: "36.087", lng: "120.374" },
  "스베이": { zh: "市北区", type: "district", lat: "36.087", lng: "120.374" },
  "스베이구": { zh: "市北区", type: "district", lat: "36.087", lng: "120.374" },

  // 城阳区
  "청양": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "청양구": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "성양": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "성양구": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "쳥양": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "쳥양구": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },
  "청양취": { zh: "城阳区", type: "district", lat: "36.307", lng: "120.396" },

  // 李沧区
  "이창": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },
  "이창구": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },
  "리창": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },
  "리창구": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },
  "리쌍": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },
  "리쌍구": { zh: "李沧区", type: "district", lat: "36.145", lng: "120.432" },

  // 崂山区
  "노산": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },
  "노산구": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },
  "라오산": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },
  "라오산구": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },
  "라오샨": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },
  "라오샨구": { zh: "崂山区", type: "district", lat: "36.107", lng: "120.468" },

  // 黄岛区 / 西海岸新区
  "황도": { zh: "黄岛区", type: "district", lat: "35.960", lng: "120.198" },
  "황도구": { zh: "黄岛区", type: "district", lat: "35.960", lng: "120.198" },
  "서해안": { zh: "西海岸新区", type: "district", lat: "35.960", lng: "120.198" },
  "서해안신구": { zh: "西海岸新区", type: "district", lat: "35.960", lng: "120.198" },
  "시하이안": { zh: "西海岸新区", type: "district", lat: "35.960", lng: "120.198" },
  "황따오": { zh: "黄岛区", type: "district", lat: "35.960", lng: "120.198" },

  // 即墨区
  "지모": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },
  "지모구": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },
  "즉묵": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },
  "즉묵구": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },
  "지모취": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },
  "즈모": { zh: "即墨区", type: "district", lat: "36.389", lng: "120.447" },

  // 胶州市
  "교주": { zh: "胶州市", type: "district", lat: "36.264", lng: "120.033" },
  "교주시": { zh: "胶州市", type: "district", lat: "36.264", lng: "120.033" },
  "자오저우": { zh: "胶州市", type: "district", lat: "36.264", lng: "120.033" },
  "쟈오저우": { zh: "胶州市", type: "district", lat: "36.264", lng: "120.033" },

  // 平度市
  "평도": { zh: "平度市", type: "district", lat: "36.776", lng: "119.988" },
  "평도시": { zh: "平度市", type: "district", lat: "36.776", lng: "119.988" },
  "핑두": { zh: "平度市", type: "district", lat: "36.776", lng: "119.988" },

  // 莱西市
  "래서": { zh: "莱西市", type: "district", lat: "36.889", lng: "120.517" },
  "래서시": { zh: "莱西市", type: "district", lat: "36.889", lng: "120.517" },
  "라이시": { zh: "莱西市", type: "district", lat: "36.889", lng: "120.517" },

  // ═══ 주요 도로 ═══
  // 中山路
  "중산로": { zh: "中山路", type: "road", lat: "36.066", lng: "120.318" },
  "중산루": { zh: "中山路", type: "road", lat: "36.066", lng: "120.318" },
  "쭝산루": { zh: "中山路", type: "road", lat: "36.066", lng: "120.318" },

  // 香港中路
  "향항중로": { zh: "香港中路", type: "road", lat: "36.068", lng: "120.395" },
  "향항중루": { zh: "香港中路", type: "road", lat: "36.068", lng: "120.395" },
  "홍콩중로": { zh: "香港中路", type: "road", lat: "36.068", lng: "120.395" },
  "샹강중루": { zh: "香港中路", type: "road", lat: "36.068", lng: "120.395" },

  // 正阳路
  "정양로": { zh: "正阳路", type: "road", lat: "36.304", lng: "120.391" },
  "정양루": { zh: "正阳路", type: "road", lat: "36.304", lng: "120.391" },
  "쩡양루": { zh: "正阳路", type: "road", lat: "36.304", lng: "120.391" },
  "쩡양로": { zh: "正阳路", type: "road", lat: "36.304", lng: "120.391" },
  "쩌양루": { zh: "正阳路", type: "road", lat: "36.304", lng: "120.391" },

  // 台东
  "타이동": { zh: "台东", type: "area", lat: "36.085", lng: "120.381" },
  "대동": { zh: "台东", type: "area", lat: "36.085", lng: "120.381" },
  "태동": { zh: "台东", type: "area", lat: "36.085", lng: "120.381" },
  "타이둥": { zh: "台东", type: "area", lat: "36.085", lng: "120.381" },

  // 登州路
  "등주로": { zh: "登州路", type: "road", lat: "36.083", lng: "120.352" },
  "등주루": { zh: "登州路", type: "road", lat: "36.083", lng: "120.352" },
  "덩저우루": { zh: "登州路", type: "road", lat: "36.083", lng: "120.352" },
  "맥주거리": { zh: "登州路啤酒街", type: "area", lat: "36.083", lng: "120.352" },
  "맥주 거리": { zh: "登州路啤酒街", type: "area", lat: "36.083", lng: "120.352" },

  // 南京路
  "남경로": { zh: "南京路", type: "road", lat: "36.084", lng: "120.393" },
  "남경루": { zh: "南京路", type: "road", lat: "36.084", lng: "120.393" },
  "난징루": { zh: "南京路", type: "road", lat: "36.084", lng: "120.393" },

  // 闽江路
  "민강로": { zh: "闽江路", type: "road", lat: "36.072", lng: "120.398" },
  "민강루": { zh: "闽江路", type: "road", lat: "36.072", lng: "120.398" },
  "민장루": { zh: "闽江路", type: "road", lat: "36.072", lng: "120.398" },

  // 漳州路
  "장주로": { zh: "漳州路", type: "road", lat: "36.073", lng: "120.393" },
  "장주루": { zh: "漳州路", type: "road", lat: "36.073", lng: "120.393" },
  "장저우루": { zh: "漳州路", type: "road", lat: "36.073", lng: "120.393" },

  // 海尔路
  "해이얼로": { zh: "海尔路", type: "road", lat: "36.085", lng: "120.440" },
  "하이얼로": { zh: "海尔路", type: "road", lat: "36.085", lng: "120.440" },
  "하이얼루": { zh: "海尔路", type: "road", lat: "36.085", lng: "120.440" },

  // 福州路
  "복주로": { zh: "福州路", type: "road", lat: "36.079", lng: "120.407" },
  "복주루": { zh: "福州路", type: "road", lat: "36.079", lng: "120.407" },
  "푸저우루": { zh: "福州路", type: "road", lat: "36.079", lng: "120.407" },

  // 延吉路
  "연길로": { zh: "延吉路", type: "road", lat: "36.086", lng: "120.399" },
  "연길루": { zh: "延吉路", type: "road", lat: "36.086", lng: "120.399" },
  "옌지루": { zh: "延吉路", type: "road", lat: "36.086", lng: "120.399" },

  // 重庆路
  "중경로": { zh: "重庆路", type: "road", lat: "36.098", lng: "120.371" },
  "충칭로": { zh: "重庆路", type: "road", lat: "36.098", lng: "120.371" },
  "충칭루": { zh: "重庆路", type: "road", lat: "36.098", lng: "120.371" },

  // 长江路
  "장강로": { zh: "长江路", type: "road", lat: "35.961", lng: "120.190" },
  "장강루": { zh: "长江路", type: "road", lat: "35.961", lng: "120.190" },
  "창장루": { zh: "长江路", type: "road", lat: "35.961", lng: "120.190" },

  // ═══ 쇼핑몰 / 상권 ═══
  "믹스몰": { zh: "万象城", type: "mall", lat: "36.072", lng: "120.384" },
  "완샹청": { zh: "万象城", type: "mall", lat: "36.072", lng: "120.384" },
  "완상성": { zh: "万象城", type: "mall", lat: "36.072", lng: "120.384" },
  "만상성": { zh: "万象城", type: "mall", lat: "36.072", lng: "120.384" },
  "인존몰": { zh: "印象城", type: "mall", lat: "36.099", lng: "120.371" },
  "인상성": { zh: "印象城", type: "mall", lat: "36.099", lng: "120.371" },
  "잉시앙청": { zh: "印象城", type: "mall", lat: "36.099", lng: "120.371" },
  "카이유에광장": { zh: "凯悦广场", type: "mall", lat: "36.084", lng: "120.380" },
  "카이웨광장": { zh: "凯悦广场", type: "mall", lat: "36.084", lng: "120.380" },
  "리군": { zh: "利群", type: "mall", lat: "36.066", lng: "120.319" },
  "리췬": { zh: "利群", type: "mall", lat: "36.066", lng: "120.319" },
  "이온몰": { zh: "永旺梦乐城", type: "mall", lat: "36.131", lng: "120.459" },
  "이온": { zh: "永旺梦乐城", type: "mall", lat: "36.131", lng: "120.459" },
  "하이신광장": { zh: "海信广场", type: "mall", lat: "36.069", lng: "120.394" },
  "해신광장": { zh: "海信广场", type: "mall", lat: "36.069", lng: "120.394" },
  "백리광장": { zh: "百丽广场", type: "mall", lat: "36.067", lng: "120.388" },
  "바이리광장": { zh: "百丽广场", type: "mall", lat: "36.067", lng: "120.388" },
  "따룬성": { zh: "大润发", type: "mall", lat: "36.087", lng: "120.374" },
  "다룬파": { zh: "大润发", type: "mall", lat: "36.087", lng: "120.374" },
  "까르푸": { zh: "家乐福", type: "mall", lat: "36.085", lng: "120.374" },
  "쟈러푸": { zh: "家乐福", type: "mall", lat: "36.085", lng: "120.374" },

  // ═══ 관광지 / 랜드마크 ═══
  "잔교": { zh: "栈桥", type: "landmark", lat: "36.063", lng: "120.316" },
  "첨교": { zh: "栈桥", type: "landmark", lat: "36.063", lng: "120.316" },
  "쟌차오": { zh: "栈桥", type: "landmark", lat: "36.063", lng: "120.316" },
  "오사광장": { zh: "五四广场", type: "landmark", lat: "36.062", lng: "120.388" },
  "54광장": { zh: "五四广场", type: "landmark", lat: "36.062", lng: "120.388" },
  "우쓰광장": { zh: "五四广场", type: "landmark", lat: "36.062", lng: "120.388" },
  "올림픽범선": { zh: "奥帆中心", type: "landmark", lat: "36.061", lng: "120.397" },
  "올림픽요트": { zh: "奥帆中心", type: "landmark", lat: "36.061", lng: "120.397" },
  "아오판중심": { zh: "奥帆中心", type: "landmark", lat: "36.061", lng: "120.397" },
  "팔대관": { zh: "八大关", type: "landmark", lat: "36.057", lng: "120.363" },
  "바따관": { zh: "八大关", type: "landmark", lat: "36.057", lng: "120.363" },
  "바다관": { zh: "八大关", type: "landmark", lat: "36.057", lng: "120.363" },
  "소어산": { zh: "小鱼山", type: "landmark", lat: "36.062", lng: "120.339" },
  "샤오위산": { zh: "小鱼山", type: "landmark", lat: "36.062", lng: "120.339" },
  "신호산": { zh: "信号山", type: "landmark", lat: "36.068", lng: "120.330" },
  "씬하오산": { zh: "信号山", type: "landmark", lat: "36.068", lng: "120.330" },
  "은어항": { zh: "银鱼巷", type: "area", lat: "36.064", lng: "120.322" },
  "인위샹": { zh: "银鱼巷", type: "area", lat: "36.064", lng: "120.322" },
  "맥주박물관": { zh: "青岛啤酒博物馆", type: "landmark", lat: "36.083", lng: "120.352" },
  "칭다오맥주박물관": { zh: "青岛啤酒博物馆", type: "landmark", lat: "36.083", lng: "120.352" },
  "해수욕장": { zh: "海水浴场", type: "landmark", lat: "36.060", lng: "120.342" },
  "제1해수욕장": { zh: "第一海水浴场", type: "landmark", lat: "36.060", lng: "120.342" },
  "제2해수욕장": { zh: "第二海水浴场", type: "landmark", lat: "36.056", lng: "120.367" },
  "제3해수욕장": { zh: "第三海水浴场", type: "landmark", lat: "36.055", lng: "120.375" },
  "석노인": { zh: "石老人", type: "landmark", lat: "36.079", lng: "120.488" },
  "스라오런": { zh: "石老人", type: "landmark", lat: "36.079", lng: "120.488" },
  "금사탄": { zh: "金沙滩", type: "landmark", lat: "35.943", lng: "120.163" },
  "진사탄": { zh: "金沙滩", type: "landmark", lat: "35.943", lng: "120.163" },

  // ═══ 교통 ═══
  "칭다오역": { zh: "青岛站", type: "transport", lat: "36.066", lng: "120.313" },
  "칭다오기차역": { zh: "青岛站", type: "transport", lat: "36.066", lng: "120.313" },
  "청도역": { zh: "青岛站", type: "transport", lat: "36.066", lng: "120.313" },
  "칭다오북역": { zh: "青岛北站", type: "transport", lat: "36.190", lng: "120.367" },
  "칭다오베이잔": { zh: "青岛北站", type: "transport", lat: "36.190", lng: "120.367" },
  "청도북역": { zh: "青岛北站", type: "transport", lat: "36.190", lng: "120.367" },
  "류팅공항": { zh: "青岛胶东国际机场", type: "transport", lat: "36.371", lng: "120.094" },
  "자오동공항": { zh: "青岛胶东国际机场", type: "transport", lat: "36.371", lng: "120.094" },
  "칭다오공항": { zh: "青岛胶东国际机场", type: "transport", lat: "36.371", lng: "120.094" },

  // ═══ 한인 밀집 지역 ═══
  "한인타운": { zh: "韩国城", type: "area", lat: "36.307", lng: "120.396" },
  "한국성": { zh: "韩国城", type: "area", lat: "36.307", lng: "120.396" },
  "한인촌": { zh: "韩国城", type: "area", lat: "36.307", lng: "120.396" },
  "한국거리": { zh: "韩国街", type: "area", lat: "36.307", lng: "120.396" },
  "류팅": { zh: "流亭", type: "area", lat: "36.260", lng: "120.374" },
  "홍탄": { zh: "红岛", type: "area", lat: "36.213", lng: "120.260" },
  "훙따오": { zh: "红岛", type: "area", lat: "36.213", lng: "120.260" },
  "춘양": { zh: "春阳", type: "area", lat: "36.304", lng: "120.384" },

  // ═══ 대학교 ═══
  "칭다오대학": { zh: "青岛大学", type: "university", lat: "36.091", lng: "120.445" },
  "청대": { zh: "青岛大学", type: "university", lat: "36.091", lng: "120.445" },
  "해양대학": { zh: "中国海洋大学", type: "university", lat: "36.068", lng: "120.337" },
  "해양대": { zh: "中国海洋大学", type: "university", lat: "36.068", lng: "120.337" },
  "칭다오과기대": { zh: "青岛科技大学", type: "university", lat: "36.088", lng: "120.376" },
  "청과대": { zh: "青岛科技大学", type: "university", lat: "36.088", lng: "120.376" },

  // ═══ 기타 자주 쓰는 표현 ═══
  "시내": { zh: "市中心", type: "area", lat: "36.075", lng: "120.380" },
  "시내중심": { zh: "市中心", type: "area", lat: "36.075", lng: "120.380" },
  "구시가지": { zh: "老城区", type: "area", lat: "36.066", lng: "120.318" },
  "올드타운": { zh: "老城区", type: "area", lat: "36.066", lng: "120.318" },
  "신시가지": { zh: "新城区", type: "area", lat: "36.085", lng: "120.440" },
};

// 긴 키워드부터 먼저 매칭 (정확도 높이기)
export const sortedLocationKeys = Object.keys(locationDict).sort(
  (a, b) => b.length - a.length
);

export function findLocation(message: string): {
  key: string;
  zh: string;
  type: string;
  lat: string;
  lng: string;
} | null {
  for (const key of sortedLocationKeys) {
    if (message.includes(key)) {
      const info = locationDict[key];
      return { key, ...info };
    }
  }
  return null;
}

export function replaceLocationToZh(message: string): string {
  let result = message;
  for (const key of sortedLocationKeys) {
    if (result.includes(key)) {
      result = result.replace(key, locationDict[key].zh);
    }
  }
  return result;
}
