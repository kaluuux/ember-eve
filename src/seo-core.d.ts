export interface SeoMeta {
  status: number; title: string; description: string; canonical: string; robots: string; image: string; type: string;
  jsonld: Record<string, unknown>[]; shop: string; lang: string;
}
export const PRIVATE_PAGES: string[];
export function startingPrice(p: unknown): number;
export function metaFor(a: { path: string; query?: Record<string, string>; origin: string; data?: { products?: unknown[]; categories?: unknown[]; seasons?: unknown[]; reviews?: unknown[]; settings?: unknown } | null }): SeoMeta;
export function renderTags(m: SeoMeta): string;
export function injectHead(html: string, m: SeoMeta): string;
export function sitemapXml(origin: string, data?: unknown): string;
export function robotsTxt(origin: string): string;
