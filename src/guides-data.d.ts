export interface Guide {
  slug: string; title: string; metaTitle: string; description: string; intro: string;
  sections: { h: string; p: string[] }[];
  links: [string, string][];
  faq: { q: string; a: string }[];
}
export const GUIDES: Guide[];
export function guideBySlug(slug: string): Guide | undefined;
