// 탭 키: 하단 네비게이션
export type TabKey =
  | "home"
  | "community"
  | "recommend"
  | "bookmark"
  | "my"
  | "admin";

// 언어
export type Lang = "ko" | "zh";

// 테마 (페이지별 다크/라이트)
export type Theme = "dark" | "light";

/** posts.extra_data JSON (중고거래 / 구인구직 등) */
export type PostExtraData = {
  price?: string;
  tradeType?: string;
  region?: string;
  condition?: string;
  jobType?: string;
  industry?: string;
  salary?: string;
  workRegion?: string;
  visaReq?: string;
};

// 게시글
export interface Post {
  id: string;
  category: string;
  categoryZh: string;
  title: string;
  titleZh: string;
  author: string;
  avatar: string;
  time: string;
  timeZh: string;
  views: number;
  comments: number;
  likes: number;
  content: string;
  contentZh: string;
  tags: string[];
  tagsZh: string[];
  /** 쉼표로 구분된 이미지/영상 URL (OSS) */
  images?: string;
  extraData?: PostExtraData | null;
}

// 장소
export interface Place {
  id: string;
  name: string;
  nameZh: string;
  category: string;
  categoryZh: string;
  rating: number;
  reviews: number;
  image: string;
  address: string;
  addressZh: string;
  tags: string[];
  tagsZh: string[];
  description: string;
  descriptionZh: string;
}

// 유저
export interface User {
  name: string;
  nameZh: string;
  email: string;
  avatar: string;
  plan: "free" | "premium";
  tokens: number;
  joined: string;
  stats: {
    posts: number;
    bookmarks: number;
    comments: number;
    likes: number;
  };
}

// AI 채팅 메시지
export interface ChatMessage {
  role: "ai" | "user";
  text: string;
  sources?: Array<{ title: string; link: string }>;
  /** 高德 실시간 검색 + AI 답변 매칭 결과 */
  recommendedShops?: Array<{
    name: string;
    koreanName?: string;
    address: string;
    tel: string;
    rating: string;
    cost: string;
    openTime?: string;
    photos?: string[];
    lat: string;
    lng: string;
  }>;
}
