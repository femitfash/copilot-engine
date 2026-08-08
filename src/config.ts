/**
 * Returns the API configuration from environment variables.
 * WordPress project: REST API at the WordPress site URL.
 */
export function getConfig() {
  const wpApiUrl = process.env.WP_API_URL || "http://localhost:8082";
  return {
    wpApiUrl,
    wpPatternsDir:
      process.env.WP_PATTERNS_DIR ||
      "../WordPress/wp-content/themes/twentytwentyfive/patterns",
    wpThemeUrl:
      process.env.WP_THEME_URL ||
      `${wpApiUrl}/wp-content/themes/twentytwentyfive`,
    fastgrcApiUrl:
      process.env.FASTGRC_API_URL || "https://www.fastgrc.ai",
  };
}
