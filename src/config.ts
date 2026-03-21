/**
 * Returns the API configuration from environment variables.
 * Each project should set these in .env to match their API endpoints.
 */
export function getConfig() {
  return {
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
