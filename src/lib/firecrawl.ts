export async function firecrawlScrape(url: string): Promise<string> {
  try {
    const res = await fetch(
      "http://8.218.238.203:8081/?url=" + encodeURIComponent(url),
      {
        signal: AbortSignal.timeout(25000),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; text?: string };
      if (data.ok && data.text) {
        return data.text;
      }
    }
  } catch {
    /* Crawl4AI 실패 → Firecrawl 폴백 */
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) return "";
    const data = (await res.json()) as { data?: { markdown?: string } };
    const markdown = data.data?.markdown || "";

    console.log(
      "=== Firecrawl 크롤링 성공: " + url.slice(0, 50) + " (" + markdown.length + "자) ==="
    );
    return markdown.slice(0, 3000);
  } catch {
    console.log("=== Firecrawl 실패: " + url.slice(0, 50) + " ===");
    return "";
  }
}
