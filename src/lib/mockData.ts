import type { Post, Place, User, ChatMessage } from "@/types";

// 게시글 5개 (한/중 필드)
export const mockPosts: Post[] = [
  {
    id: "p1",
    category: "생활정보",
    categoryZh: "生活信息",
    title: "칭다오 겨울철 난방비 절약 팁",
    titleZh: "青岛冬季取暖费节省小贴士",
    author: "칭다오살이",
    avatar: "/avatars/1.jpg",
    time: "2시간 전",
    timeZh: "2小时前",
    views: 234,
    comments: 12,
    likes: 45,
    content:
      "겨울에 난방 전기세 부담 되시는 분들 많으시죠. 에어컨 대신 전기장판 + 담요 조합으로 한 달에 5만원 절약했어요.",
    contentZh:
      "冬天取暖电费负担大的人很多吧。用电热毯+毯子代替空调，一个月能省5万韩元。",
    tags: ["난방", "절약", "생활"],
    tagsZh: ["取暖", "节省", "生活"],
  },
  {
    id: "p2",
    category: "맛집",
    categoryZh: "美食",
    title: "시청 근처 한국식 냉면 맛집 추천",
    titleZh: "市政府附近韩式冷面店推荐",
    author: "맛집탐방",
    avatar: "/avatars/2.jpg",
    time: "5시간 전",
    timeZh: "5小时前",
    views: 512,
    comments: 28,
    likes: 89,
    content:
      "칭다오에서 냉면이 그리우시다면 여기 강력 추천. 물냉/비냉 둘 다 맛있고 양도 푸짐해요.",
    contentZh: "在青岛想吃冷面的话强烈推荐这里。水冷面拌冷面都好吃，量也足。",
    tags: ["냉면", "한식", "시청"],
    tagsZh: ["冷面", "韩餐", "市政府"],
  },
  {
    id: "p3",
    category: "비자",
    categoryZh: "签证",
    title: "L비자 연장 절차 (2024 최신)",
    titleZh: "L签证延期流程（2024最新）",
    author: "비자정보통",
    avatar: "/avatars/3.jpg",
    time: "1일 전",
    timeZh: "1天前",
    views: 1203,
    comments: 56,
    likes: 201,
    content:
      "L비자 30일 연장 받으려면 출입경 대청도 서비스센터 가셔야 해요. 준비물과 예약 방법 정리했습니다.",
    contentZh:
      "L签证延期30天要去出入境大港服务中心。整理了所需材料和预约方法。",
    tags: ["비자", "연장", "L비자"],
    tagsZh: ["签证", "延期", "L签证"],
  },
  {
    id: "p4",
    category: "육아",
    categoryZh: "育儿",
    title: "칭다오 국제학교 입학 후기",
    titleZh: "青岛国际学校入学经验分享",
    author: "맘스칭다오",
    avatar: "/avatars/4.jpg",
    time: "2일 전",
    timeZh: "2天前",
    views: 678,
    comments: 34,
    likes: 72,
    content:
      "아이를 국제학교에 보내기로 했는데, 지원부터 면접까지 경험담 공유합니다. 중국어 준비는 이렇게 하세요.",
    contentZh:
      "决定送孩子上国际学校，分享从申请到面试的经验。中文准备可以这样做。",
    tags: ["국제학교", "육아", "입학"],
    tagsZh: ["国际学校", "育儿", "入学"],
  },
  {
    id: "p5",
    category: "비즈니스",
    categoryZh: "商务",
    title: "중한 무역 소규모 수입 시 유의사항",
    titleZh: "中韩贸易小规模进口注意事项",
    author: "무역왕",
    avatar: "/avatars/5.jpg",
    time: "3일 전",
    timeZh: "3天前",
    views: 445,
    comments: 19,
    likes: 38,
    content:
      "칭다오 항에서 소량 수입하실 때 관세·통관·물류 비용 계산 팁과 대행사 선택 요령입니다.",
    contentZh: "从青岛港小量进口时的关税、清关、物流费用计算及代理选择要点。",
    tags: ["무역", "수입", "통관"],
    tagsZh: ["贸易", "进口", "清关"],
  },
];

// 장소 6개 (한/중 필드)
export const mockPlaces: Place[] = [
  {
    id: "pl1",
    name: "청도맥주박물관",
    nameZh: "青岛啤酒博物馆",
    category: "관광",
    categoryZh: "旅游",
    rating: 4.8,
    reviews: 12500,
    image: "/places/beer-museum.jpg",
    address: "시북구 덕현로 56호",
    addressZh: "青岛市市北区登州路56号",
    tags: ["맥주", "박물관", "가족"],
    tagsZh: ["啤酒", "博物馆", "家庭"],
    description:
      "칭다오 맥주 역사와 제조 과정을 체험할 수 있는 대표 관광지.",
    descriptionZh: "可体验青岛啤酒历史与酿造过程的代表性景点。",
  },
  {
    id: "pl2",
    name: "오사산공원",
    nameZh: "崂山风景区",
    category: "자연",
    categoryZh: "自然",
    rating: 4.7,
    reviews: 8900,
    image: "/places/laoshan.jpg",
    address: "라오산구",
    addressZh: "崂山区",
    tags: ["등산", "풍경", "사찰"],
    tagsZh: ["登山", "风景", "寺庙"],
    description:
      "칭다오의 대표 명산. 케이블카와 하이킹 코스가 잘 갖춰져 있음.",
    descriptionZh: "青岛代表名山。缆车与徒步路线完善。",
  },
  {
    id: "pl3",
    name: "한국거리",
    nameZh: "韩国街",
    category: "쇼핑·음식",
    categoryZh: "购物·美食",
    rating: 4.5,
    reviews: 3200,
    image: "/places/korea-street.jpg",
    address: "시남구 홍산로 일대",
    addressZh: "市南区香港中路一带",
    tags: ["한국식품", "맛집", "쇼핑"],
    tagsZh: ["韩国食品", "美食", "购物"],
    description:
      "한국 식료품·음식점이 모여 있는 거리. 김치·라면 구매하기 좋음.",
    descriptionZh: "韩国食品与餐厅聚集的街道。适合购买泡面、泡菜等。",
  },
  {
    id: "pl4",
    name: "지모온천",
    nameZh: "即墨温泉",
    category: "휴양",
    categoryZh: "休闲",
    rating: 4.6,
    reviews: 5600,
    image: "/places/jimo-onsen.jpg",
    address: "지모시 온천진",
    addressZh: "即墨区温泉镇",
    tags: ["온천", "힐링", "주말"],
    tagsZh: ["温泉", "疗愈", "周末"],
    description:
      "칭다오 근교 대표 온천. 가족·커플 데이트로 인기.",
    descriptionZh: "青岛近郊代表温泉。适合家庭、情侣出游。",
  },
  {
    id: "pl5",
    name: "만상성쇼핑몰",
    nameZh: "万象城",
    category: "쇼핑",
    categoryZh: "购物",
    rating: 4.5,
    reviews: 9800,
    image: "/places/mixc.jpg",
    address: "시남구 산동로 10호",
    addressZh: "市南区山东路10号",
    tags: ["쇼핑몰", "맛집", "영화"],
    tagsZh: ["商场", "美食", "电影"],
    description:
      "대형 쇼핑몰. 브랜드샵·푸드코트·영화관 모두 갖춤.",
    descriptionZh: "大型购物中心。品牌店、美食广场、影院齐全。",
  },
  {
    id: "pl6",
    name: "해운한의원",
    nameZh: "海云中医诊所",
    category: "의료",
    categoryZh: "医疗",
    rating: 4.7,
    reviews: 420,
    image: "/places/haeun-clinic.jpg",
    address: "시남구 해운로 88호",
    addressZh: "市南区海云路88号",
    tags: ["한의원", "침술", "한국어"],
    tagsZh: ["中医", "针灸", "韩语"],
    description:
      "한국어 가능 한의원. 침·부항·한약 치료 가능.",
    descriptionZh: "可韩语交流的中医诊所。提供针灸、拔罐、中药治疗。",
  },
];

// 유저 1명
export const mockUser: User = {
  name: "김칭다오",
  nameZh: "金青岛",
  email: "kim@example.com",
  avatar: "/avatars/me.jpg",
  plan: "premium",
  tokens: 847,
  joined: "2024-01-15",
  stats: {
    posts: 12,
    bookmarks: 28,
  },
};

// AI 채팅 목 응답 (한국어)
export const mockAiResponses: string[] = [
  "칭다오에서 L비자 연장은 출입경관리대 청도서비스센터에서 하실 수 있어요. 방문 전에 WeChat으로 '국가이민관리국' 공식 계정에서 예약하시면 편합니다. 준비물은 여권, 현재 비자, 체류지 등록증, 사진이에요.",
  "시청 근처 한국 냉면은 **한국거리** 쪽 '진향냉면'이 유명해요. 물냉면·비냉면 둘 다 있고, 인근에 한국마트도 있어서 식재료 사기 좋습니다.",
  "오사산(崂山) 가실 때는 아침 일찍 출발하시는 걸 추천해요. 케이블카는 대청궁 구간이 인기 많아서 오후에는 대기 시간이 길어질 수 있어요. 산 위에는 간이 식당도 있지만 비싸니 도시락 챙기시면 좋아요.",
  "칭다오 겨울 난방은 에어컨(제습·난방) 쓰시는 분이 많은데, 전기장판을 침대에 깔고 잠자리에 들기 30분만 켜두시면 전기료를 꽤 아낄 수 있어요. 창문 틈 막는 것도 효과 좋습니다.",
];

// AI 채팅 목 응답 (중국어)
export const mockAiResponsesZh: string[] = [
  "在青岛办理L签证延期可到出入境管理局青岛服务中心。建议提前通过微信「国家移民管理局」公众号预约。需准备护照、当前签证、住宿登记、照片。",
  "市政府附近的韩式冷面推荐韩国街的「真香冷面」。水冷面、拌冷面都有，附近还有韩国超市，买食材方便。",
  "去崂山建议一早出发。太清宫段缆车下午排队久。山上简餐较贵，可自带便当。",
  "青岛冬天很多人用空调取暖。睡前半小时开电热毯再关掉，能省不少电费。封好窗户缝隙也很有效。",
];

// 채팅용 샘플 메시지 (테스트)
export const mockChatMessages: ChatMessage[] = [
  { role: "user", text: "L비자 연장 어디서 해요?" },
  { role: "ai", text: mockAiResponses[0] },
  { role: "user", text: "냉면 맛집 추천해주세요" },
  { role: "ai", text: mockAiResponses[1] },
];
