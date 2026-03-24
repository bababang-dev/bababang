/** 高德 place/text POI (chat 검색·캐시용) */
export type AmapPoiItem = {
  name: string;
  address: string;
  tel: string;
  rating: string;
  cost: string;
  openTime: string;
  photos: string[];
  type: string;
  location: string;
  _score?: number;
};

export type AmapSearchOptions = {
  sortrule?: number;
  offset?: number;
  location?: string;
  types?: string;
};

function mapAmapPois(data: {
  pois?: Array<{
    name?: string;
    address?: string;
    tel?: string;
    rating?: string;
    location?: string;
    photos?: Array<{ url?: string } | string>;
    biz_ext?: { rating?: string; cost?: string; open_time?: string; meal_ordering?: string };
    type?: string;
  }>;
}): AmapPoiItem[] {
  return (data.pois || []).map((poi) => {
    const photos =
      poi.photos?.slice(0, 3).map((p) => (typeof p === "string" ? p : p?.url ?? "")).filter(Boolean) ?? [];
    return {
      name: poi.name ?? "",
      address: poi.address ?? "",
      tel: poi.tel ?? "",
      rating: poi.biz_ext?.rating || poi.rating || "",
      cost: poi.biz_ext?.cost || "",
      openTime: poi.biz_ext?.open_time || "",
      photos,
      type: poi.type ?? "",
      location: poi.location ?? "",
    };
  });
}

/**
 * 高德关键词搜索 (text)
 * 기본: sortrule=2 평점순, offset=20, extensions=all
 */
export async function amapSearch(
  keyword: string,
  city: string = "青岛",
  options?: AmapSearchOptions
): Promise<AmapPoiItem[]> {
  try {
    const key = process.env.AMAP_API_KEY;
    if (!key) return [];
    const hasLoc = Boolean(options?.location && String(options.location).trim() !== "");
    const sortrule = hasLoc ? String(options?.sortrule ?? 1) : String(options?.sortrule ?? 2);
    const params = new URLSearchParams({
      keywords: keyword,
      city,
      offset: String(options?.offset ?? 20),
      sortrule,
      extensions: "all",
      key,
      output: "json",
    });
    if (options?.location) {
      params.set("location", options.location);
    }
    if (options?.types) {
      params.set("types", options.types);
    }
    const url = `https://restapi.amap.com/v3/place/text?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as Parameters<typeof mapAmapPois>[0];
    console.log("=== 高德 [" + keyword + "]: " + (data.pois?.length || 0) + "개 ===");
    return mapAmapPois(data);
  } catch {
    return [];
  }
}
