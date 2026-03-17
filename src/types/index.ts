// 탭 키: 하단 네비게이션
export type TabKey = "home" | "community" | "recommend" | "bookmark" | "my";

// 언어
export type Lang = "ko" | "zh";

// 테마 (페이지별 다크/라이트)
export type Theme = "dark" | "light";

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
  };
}

// AI 채팅 메시지
export interface ChatMessage {
  role: "ai" | "user";
  text: string;
  sources?: Array<{ title: string; link: string }>;
}
