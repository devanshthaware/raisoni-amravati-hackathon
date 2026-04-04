import { api } from "../api/client";
import { getCurrentSession } from "../session/session";
import { AegisEventType, AegisResponse, SignalPayload } from "../types";

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Step 8: Signal Collection
 * Collect device results and send to the backend for risk evaluation.
 * Payload includes session_id, correlation_id, api_key (via headers).
 */
export async function collectSignal(type: AegisEventType, payload: any): Promise<AegisResponse<any>> {
    const session = getCurrentSession();
    const tracking = {
        sessionId: session?.id,
        correlationId: session?.correlationId,
        type,
        payload: {
            ...payload,
            fingerprint: getDeviceFingerprint()
        }
    };

    return await api.post<AegisResponse<any>>("/signals", tracking);
}

/**
 * Step 9: Continuous Monitoring
 * Start a worker that sends periodic signals for risk evaluation.
 */
export function startMonitoring(intervalMs: number = 30000): void {
    if (monitorInterval) return;

    console.log("[Aegis Monitoring] Continuous session monitoring started");
    monitorInterval = setInterval(async () => {
        try {
            const session = getCurrentSession();
            if (session && session.state === "ACTIVE") {
                await collectSignal("SIGNAL_RECEIVED", { context: "continuous_monitoring" });
            }
        } catch (error) {
            console.error("[Aegis Monitoring] Verification check failed:", error);
        }
    }, intervalMs);
}

/**
 * Stop continuous monitoring
 */
export function stopMonitoring(): void {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log("[Aegis Monitoring] Continuous session monitoring stopped");
    }
}

/**
 * Internal device fingerprinting
 */
function getDeviceFingerprint(): SignalPayload {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    timestamp: Date.now(),
  };
}
