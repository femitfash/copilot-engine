/**
 * Returns the API configuration from environment variables.
 * AISOAR project: single backend API at localhost:5000.
 */
export function getConfig() {
  return {
    aisoarApiUrl: process.env.AISOAR_API_URL || "http://localhost:5000",
    settingsApiUrl: process.env.SettingsApiUrl || "",
    healthCheckApiUrl: process.env.HealthCheckApiUrl || "",
    mlApiBaseUrl: process.env.MlAPINewBaseUrl || "",
    ragApiBaseUrl: process.env.MlAPIRagBaseUrl || "",
    historyApiUrl: process.env.HistoryApiUrl || "",
    gatewayUrl: process.env.GatewayHost || "",
    identityDomain: process.env.IdentityDomain || "",
    notificationUrl: process.env.NotificationAPIBaseUrl || "",
  };
}
