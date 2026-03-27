// app/modelsData.ts

export type ModelItem = {
  id: string;
  type: string;      // RING, PENDANT …
  title: string;
  meta: string;      // 짧은 설명
  price: number;     // 가격 (원)
  formats: string[]; // ["3DM", "STL"] 이런 식
  thumbUrl?: string; 
  images?: string[];
  objUrl?: string;
  downloadUrl?: string;
};


export const popularModels: ModelItem[] = [
  {
    id: "solitaire-ring",
    type: "RING",
    title: "솔리테어 다이아 링",
    meta: "링 · 3DM / STL · 고급 세팅",
    price: 55000,
    formats: ["3DM", "STL", "OBJ"],
    thumbUrl: "/thumbs/ring1.jpg",
    images: ["/thumbs/ring1.jpg", "/thumbs/ring1_2.png", "/thumbs/ring1_3.png"],
    objUrl: "/models/ring1.obj",
    downloadUrl: "/models/ring1.obj",
  },
  {
    id: "flower-pendant",
    type: "PENDANT",
    title: "플라워 팬던트",
    meta: "팬던트 · OBJ · 데일리용",
    price: 42000,
    formats: ["OBJ"],
    thumbUrl: "/thumbs/ring2.jpg",
  },
  {
    id: "twist-earring-set",
    type: "EARRING",
    title: "트위스트 이어링 세트",
    meta: "이어링 · 3DM · 세트 구성",
    price: 63000,
    formats: ["3DM"],
    thumbUrl: "/thumbs/ring3.jpg",    
  },
];

export const recentModels: ModelItem[] = [
  {
    id: "wedding-set",
    type: "SET",
    title: "웨딩 세트 (링+밴드)",
    meta: "세트 · 3DM / 렌더 포함",
    price: 88000,
    formats: ["3DM", "STL"],
    thumbUrl: "/thumbs/ring4.jpg",
  },
  {
    id: "chain-bracelet",
    type: "BRACELET",
    title: "체인 브레이슬릿",
    meta: "팔찌 · STEP · 커스텀 길이",
    price: 49000,
    formats: ["STEP"],
    thumbUrl: "/thumbs/ring5.jpg",
  },
];
