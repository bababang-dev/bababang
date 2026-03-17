/**
 * 간단한 인메모리 벡터 스토어.
 * 청크 분할 + 키워드 매칭 기반 관련도 검색 (TF-IDF 유사).
 */

export interface ChunkMeta {
  source: string;
  category?: string;
  date?: string;
}

export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMeta;
}

const CHUNK_SIZE = 500;
const store: Chunk[] = [];
let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `chunk_${idCounter}`;
}

/** HTML 태그 제거 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** 텍스트를 CHUNK_SIZE 단위로 분할 */
function splitIntoChunks(text: string, meta: ChunkMeta): Chunk[] {
  const cleaned = stripHtml(text).trim();
  if (!cleaned) return [];
  const chunks: Chunk[] = [];
  for (let i = 0; i < cleaned.length; i += CHUNK_SIZE) {
    const slice = cleaned.slice(i, i + CHUNK_SIZE).trim();
    if (slice.length > 0) {
      chunks.push({
        id: nextId(),
        text: slice,
        metadata: { ...meta },
      });
    }
  }
  return chunks;
}

/** 문서 목록을 청크로 나눠 스토어에 추가 */
export function addDocuments(
  documents: Array<{ text: string; source: string; category?: string; date?: string }>
): number {
  let added = 0;
  for (const doc of documents) {
    const meta: ChunkMeta = {
      source: doc.source,
      category: doc.category,
      date: doc.date,
    };
    const chunks = splitIntoChunks(doc.text, meta);
    for (const c of chunks) {
      store.push(c);
      added += 1;
    }
  }
  return added;
}

/** 스토어 비우기 */
export function clearStore(): void {
  store.length = 0;
}

/** 스토어 청크 개수 */
export function getStoreSize(): number {
  return store.length;
}

/** 간단한 키워드 토큰화 (한글/영어/숫자) */
function tokenize(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9가-힣\u4e00-\u9fff\s]/g, " ")
    .split(/\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/** TF: term frequency in document */
function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

/** IDF 유사: 전체 문서 수 / (단어가 포함된 문서 수 + 1) */
function idfLike(term: string): number {
  const docsWithTerm = store.filter((chunk) =>
    chunk.text.toLowerCase().includes(term.toLowerCase())
  ).length;
  return Math.log((store.length + 1) / (docsWithTerm + 1) + 1);
}

/** 쿼리와 관련도 높은 청크 topK개 반환 */
export function searchRelevant(query: string, topK: number): Chunk[] {
  if (store.length === 0) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return store.slice(0, topK);

  const scored = store.map((chunk) => {
    const chunkTokens = tokenize(chunk.text);
    const chunkTf = termFreq(chunkTokens);
    let score = 0;
    for (const q of queryTokens) {
      const tf = chunkTf.get(q) ?? 0;
      const idf = idfLike(q);
      score += tf * idf;
      if (chunk.text.toLowerCase().includes(q)) score += idf * 2;
    }
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map((s) => s.chunk);
}
