import { initAegisAuth } from "@devanshthaware/aegis-auth";

/**
 * Initializes the AegisAuth SDK for use across the application.
 * Note: These environment variables must be provided in .env.local
 */
const aegisConfig = {
  apiKey: process.env.NEXT_PUBLIC_AEGIS_API_KEY || "aegis_master_key_2024",
  baseUrl: process.env.NEXT_PUBLIC_AEGIS_BASE_URL || "http://localhost:8000",
  appId: process.env.NEXT_PUBLIC_AEGIS_APP_ID || "app_ve0u0g",
  debug: true,
};

// Initialize the SDK once
console.log("[Aegis Lib] Initializing SDK on", typeof window !== "undefined" ? "Client" : "Server", "with appId:", aegisConfig.appId);
initAegisAuth(aegisConfig);

export { aegisConfig };
