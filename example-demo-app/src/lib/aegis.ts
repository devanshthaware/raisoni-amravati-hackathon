import { initAegisAuth } from "@devanshthaware/aegis-auth";

/**
 * Initializes the AegisAuth SDK for use across the application.
 * Note: These environment variables must be provided in .env.local
 */
const aegisConfig = {
  apiKey: process.env.AEGIS_API_KEY || process.env.NEXT_PUBLIC_AEGIS_API_KEY || "aegis_master_key_2024",
  baseUrl: (process.env.AEGIS_BASE_URL || process.env.NEXT_PUBLIC_AEGIS_BASE_URL || "http://localhost:8000") + "/auth",
  appId: process.env.AEGIS_APP_ID || process.env.NEXT_PUBLIC_AEGIS_APP_ID || "app_ve0u0g",
  debug: true,
};

// Initialize the SDK once
if (typeof global !== 'undefined') {
    // Force initialization in node/server context
    (global as any)._aegisInitialized = true;
}
console.log("[Aegis Lib] Initializing SDK on", typeof window !== "undefined" ? "Client" : "Server", "with appId:", aegisConfig.appId);
initAegisAuth(aegisConfig);

export { aegisConfig };
