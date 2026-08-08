/**
 * Pattern Engine — reads WordPress theme patterns and renders them
 * with custom content, enabling Lovable-style page assembly.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

export interface PatternSlot {
  type: "heading" | "paragraph" | "button" | "image";
  index: number;
  key: string; // e.g., "heading_1", "paragraph_2", "image_1"
  defaultValue: string;
}

export interface PatternInfo {
  slug: string;
  title: string;
  categories: string[];
  description: string;
  slots: PatternSlot[];
}

/**
 * Parse the PHP header block from a pattern file.
 */
function parsePatternHeader(content: string): {
  title: string;
  slug: string;
  categories: string[];
  description: string;
} | null {
  const titleMatch = content.match(/\*\s*Title:\s*(.+)/);
  const slugMatch = content.match(/\*\s*Slug:\s*(.+)/);
  const catMatch = content.match(/\*\s*Categories:\s*(.+)/);
  const descMatch = content.match(/\*\s*Description:\s*(.+)/);

  if (!titleMatch || !slugMatch) return null;

  return {
    title: titleMatch[1].trim(),
    slug: slugMatch[1].trim(),
    categories: catMatch
      ? catMatch[1].trim().split(",").map((c) => c.trim())
      : [],
    description: descMatch ? descMatch[1].trim() : "",
  };
}

/**
 * Strip PHP from a pattern file and return clean block markup.
 * Replaces PHP function calls with their string arguments.
 */
function stripPhp(content: string, themeUrl: string): string {
  // 1. Remove only the PHP header comment block (the first <?php ... ?> that contains the metadata)
  let markup = content.replace(
    /^<\?php\s*\/\*\*[\s\S]*?\*\/\s*\?>\s*/,
    ""
  );

  // 2. Replace get_template_directory_uri() calls with actual theme URL
  markup = markup.replace(
    /<\?php\s+echo\s+esc_url\(\s*get_template_directory_uri\(\)\s*\);\s*\?>/g,
    themeUrl
  );

  // 3. Replace esc_html_e('text', 'domain'), esc_html__('text', 'domain'), echo esc_html__()
  markup = markup.replace(
    /<\?php\s+(?:echo\s+)?esc_html(?:_[_e]|__)\(\s*'([^']*)'(?:\s*,\s*'[^']*')?\s*\);\s*\?>/g,
    "$1"
  );

  // 4. Replace esc_html_x('text', 'context', 'domain')
  markup = markup.replace(
    /<\?php\s+(?:echo\s+)?esc_html_x\(\s*'([^']*)'(?:\s*,\s*'[^']*')*\s*\);\s*\?>/g,
    "$1"
  );

  // 5. Replace esc_attr_e, esc_attr__, esc_attr_x (for alt text etc.)
  markup = markup.replace(
    /<\?php\s+(?:echo\s+)?esc_attr(?:_[_ex]|__)\(\s*'([^']*)'(?:\s*,\s*'[^']*')*\s*\);\s*\?>/g,
    "$1"
  );

  // 6. Clean up any remaining PHP tags
  markup = markup.replace(/<\?php[^?]*\?>/g, "");

  return markup.trim();
}

/**
 * Detect content slots in clean block markup.
 */
function detectSlots(markup: string): PatternSlot[] {
  const slots: PatternSlot[] = [];
  const headingCounts: Record<string, number> = {
    heading: 0,
    paragraph: 0,
    button: 0,
    image: 0,
  };

  // Find headings: text inside <hN> tags
  const headingRe = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g;
  let m;
  while ((m = headingRe.exec(markup)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    headingCounts.heading++;
    slots.push({
      type: "heading",
      index: headingCounts.heading,
      key: `heading_${headingCounts.heading}`,
      defaultValue: text,
    });
  }

  // Find paragraphs: text inside <p> tags
  const paraRe = /<p[^>]*>([^<]+)<\/p>/g;
  while ((m = paraRe.exec(markup)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    headingCounts.paragraph++;
    slots.push({
      type: "paragraph",
      index: headingCounts.paragraph,
      key: `paragraph_${headingCounts.paragraph}`,
      defaultValue: text,
    });
  }

  // Find button text inside <a> tags within wp:button blocks
  const btnRe = /wp-block-button__link[^>]*>([^<]+)<\/a>/g;
  while ((m = btnRe.exec(markup)) !== null) {
    const text = m[1].trim();
    if (!text) continue;
    headingCounts.button++;
    slots.push({
      type: "button",
      index: headingCounts.button,
      key: `button_${headingCounts.button}`,
      defaultValue: text,
    });
  }

  // Find images
  const imgRe = /<img[^>]+src="([^"]+)"/g;
  while ((m = imgRe.exec(markup)) !== null) {
    headingCounts.image++;
    slots.push({
      type: "image",
      index: headingCounts.image,
      key: `image_${headingCounts.image}`,
      defaultValue: m[1],
    });
  }

  return slots;
}

/**
 * Get the catalog of all available patterns in the theme.
 */
export function getPatternCatalog(
  patternsDir: string,
  themeUrl: string
): PatternInfo[] {
  const files = readdirSync(patternsDir).filter(
    (f) =>
      f.endsWith(".php") &&
      !f.startsWith("hidden-") &&
      !f.startsWith("template-") &&
      !f.startsWith("format-") &&
      !f.startsWith("binding-") &&
      f !== "comments.php"
  );

  const catalog: PatternInfo[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(patternsDir, file), "utf-8");
      const header = parsePatternHeader(raw);
      if (!header) continue;

      const markup = stripPhp(raw, themeUrl);
      const slots = detectSlots(markup);

      catalog.push({
        slug: header.slug,
        title: header.title,
        categories: header.categories,
        description: header.description,
        slots,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return catalog;
}

/**
 * Render a single pattern with content overrides.
 */
export function renderPattern(
  patternsDir: string,
  themeUrl: string,
  slug: string,
  overrides: Record<string, string> = {}
): string {
  // Find the pattern file by slug
  const files = readdirSync(patternsDir).filter((f) => f.endsWith(".php"));
  let patternFile: string | null = null;

  for (const file of files) {
    const raw = readFileSync(join(patternsDir, file), "utf-8");
    if (raw.includes(`Slug: ${slug}`)) {
      patternFile = file;
      break;
    }
  }

  if (!patternFile) {
    throw new Error(`Pattern not found: ${slug}`);
  }

  const raw = readFileSync(join(patternsDir, patternFile), "utf-8");
  let markup = stripPhp(raw, themeUrl);

  // Apply content overrides using slot detection
  const slots = detectSlots(markup);

  for (const slot of slots) {
    const override = overrides[slot.key];
    if (!override) continue;

    if (slot.type === "image") {
      // Replace image src
      markup = markup.replace(slot.defaultValue, override);
    } else {
      // Replace text content (only the first occurrence of this specific default)
      markup = markup.replace(slot.defaultValue, override);
    }
  }

  return markup;
}

/**
 * Assemble a full page from multiple patterns.
 */
export function assemblePage(
  patternsDir: string,
  themeUrl: string,
  sections: Array<{ pattern: string; content?: Record<string, string> }>
): string {
  const parts: string[] = [];

  for (const section of sections) {
    const rendered = renderPattern(
      patternsDir,
      themeUrl,
      section.pattern,
      section.content || {}
    );
    parts.push(rendered);
  }

  return parts.join("\n\n");
}
