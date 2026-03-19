// 칭다오 한인들이 부르는 가게 별명 → 실제 중국어 이름 매핑
// PM이 직접 추가/수정할 수 있는 구조

export interface ShopEntry {
  zh: string; // 중국어 이름 (高德 검색용)
  koreanNames: string[]; // 한인들이 부르는 이름들
  category: string; // 카테고리
  district: string; // 지역 (중국어)
  description?: string; // 간단 설명
  address?: string; // 주소 (알면)
  tel?: string; // 전화 (알면)
  recommendMenu?: string;
  priceRange?: string;
  tip?: string;
}

export const shopDict: ShopEntry[] = [
  // ═══ 맛집 ═══
  {
    zh: "缸桶屋",
    koreanNames: ["깡통집", "깡통옥", "강통옥"],
    category: "맛집",
    district: "台东",
    description: "타이동 유명 고기집",
    recommendMenu: "삼겹살, 목살",
    priceRange: "1인당 80-120위안",
    tip: "저녁 피크 시간 전에 가면 웨이팅이 적어요.",
  },
  {
    zh: "鲁鱼",
    koreanNames: ["루위", "루이", "루위생선찜"],
    category: "맛집",
    district: "万象城",
    description: "생선찜 전문점, 믹스몰 5층",
    recommendMenu: "생선찜, 볶음요리",
    priceRange: "1인당 70-110위안",
  },
  {
    zh: "美达尔烧烤",
    koreanNames: ["메이다얼", "메이달", "미달"],
    category: "맛집",
    district: "中山路",
    description: "중산로 유명 양꼬치",
    recommendMenu: "양꼬치, 구운가지",
    priceRange: "1인당 60-100위안",
  },
  {
    zh: "大红门济南烧烤",
    koreanNames: ["대홍문", "따홍먼", "대홍문양꼬치"],
    category: "맛집",
    district: "台东",
    description: "현지인 양꼬치 맛집",
  },
  {
    zh: "木屋烧烤",
    koreanNames: ["무예슬거", "무옥소고", "목옥소고", "나무집양꼬치"],
    category: "맛집",
    district: "城阳区",
    description: "체인 양꼬치",
  },
  {
    zh: "海底捞",
    koreanNames: ["하이디라오", "해저로", "해저라오", "해저로훠궈"],
    category: "맛집",
    district: "多处",
    description: "유명 훠궈 체인",
    recommendMenu: "토마토탕, 버섯탕",
    priceRange: "1인당 100-180위안",
    tip: "앱 예약하면 대기 시간을 줄일 수 있어요.",
  },
  {
    zh: "外婆家",
    koreanNames: ["와이포지아", "외할머니집", "외파가"],
    category: "맛집",
    district: "多处",
    description: "가성비 중식 체인",
  },
  {
    zh: "明家点心",
    koreanNames: ["명가딤섬", "명가점심", "밍지아디엔신"],
    category: "맛집",
    district: "万象城",
    description: "딤섬 전문점",
    recommendMenu: "새우딤섬, 쇼마이",
    priceRange: "1인당 80-130위안",
  },
  {
    zh: "四方大酒店",
    koreanNames: ["사방대주점", "쓰팡호텔"],
    category: "맛집",
    district: "市北区",
    description: "사방구 한식 모임 장소",
  },
  {
    zh: "船歌鱼水饺",
    koreanNames: ["촨거위수이쟈오", "배노래만두", "선가어수교", "생선만두집"],
    category: "맛집",
    district: "多处",
    description: "칭다오 대표 생선 만두",
    recommendMenu: "생선만두, 해산물요리",
    priceRange: "1인당 50-90위안",
  },
  {
    zh: "上逸阁",
    koreanNames: ["샹이거", "상일각", "상이거"],
    category: "맛집",
    district: "市南区",
    description: "북경오리 전문점",
    recommendMenu: "북경오리, 볶음요리",
    priceRange: "1인당 120-200위안",
  },
  {
    zh: "85度C",
    koreanNames: ["85도씨", "팔십오도씨", "85도"],
    category: "카페",
    district: "多处",
    description: "대만 프랜차이즈 카페/베이커리",
    recommendMenu: "커피, 빵",
    priceRange: "1인당 20-40위안",
  },
  {
    zh: "茶百道",
    koreanNames: ["차바이다오", "차백도", "차100도"],
    category: "카페",
    district: "多处",
    description: "밀크티 프랜차이즈",
    recommendMenu: "과일차, 밀크티",
    priceRange: "1인당 15-30위안",
  },
  {
    zh: "蜜雪冰城",
    koreanNames: ["미쉐빙청", "밀설빙성", "꿀눈빙성"],
    category: "카페",
    district: "多处",
    description: "초저가 밀크티 체인",
  },
  {
    zh: "瑞幸咖啡",
    koreanNames: ["루이싱커피", "서행커피", "루이싱"],
    category: "카페",
    district: "多处",
    description: "중국 대표 커피 프랜차이즈",
  },

  // ═══ 마트/쇼핑 ═══
  {
    zh: "韩国超市",
    koreanNames: ["한국마트", "한마트", "한국슈퍼"],
    category: "마트",
    district: "城阳区",
    description: "한인타운 한국 식재료",
  },
  {
    zh: "大润发",
    koreanNames: ["따룬파", "대윤발", "다룬파"],
    category: "마트",
    district: "多处",
    description: "대형마트",
  },
  {
    zh: "永旺",
    koreanNames: ["이온", "이온몰", "영왕"],
    category: "마트",
    district: "崂山区",
    description: "일본계 대형마트",
  },
  {
    zh: "盒马鲜生",
    koreanNames: ["허마", "하마", "허마센셩", "하마선생"],
    category: "마트",
    district: "多处",
    description: "알리바바 신선식품 마트",
  },

  // ═══ 병원/의료 ═══
  {
    zh: "青岛市立医院",
    koreanNames: ["시립병원", "칭다오시립병원", "시립의원"],
    category: "병원",
    district: "市南区",
    description: "칭다오 대형 공립병원",
  },
  {
    zh: "青岛大学附属医院",
    koreanNames: ["청대병원", "칭대부속병원", "칭다오대학병원"],
    category: "병원",
    district: "崂山区",
    description: "대학 부속병원",
  },
];

// 검색 함수
export function findShop(message: string): ShopEntry | null {
  for (const shop of shopDict) {
    for (const name of shop.koreanNames) {
      if (message.includes(name)) {
        return shop;
      }
    }
  }
  return null;
}

// 한국어 별명을 중국어로 변환
export function replaceShopNames(message: string): string {
  let result = message;
  for (const shop of shopDict) {
    const sortedNames = [...shop.koreanNames].sort((a, b) => b.length - a.length);
    for (const name of sortedNames) {
      if (result.includes(name)) {
        result = result.replace(name, shop.zh);
        return result;
      }
    }
  }
  return result;
}
