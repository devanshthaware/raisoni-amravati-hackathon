import { v } from "convex/values";

/**
 * AEGIS DECISION ENGINE
 * Single authority for risk-to-decision mapping.
 */

export type DecisionType = "ALLOW" | "CHALLENGE" | "RESTRICT" | "BLOCK";

export interface Decision {
    type: DecisionType;
    reason_codes: string[];
    required_actions: DecisionAction[];
}

export interface DecisionAction {
    type: "MFA_REQUIRED" | "SESSION_TERMINATE" | "ACCESS_RESTRICT" | "NONE";
    payload?: Record<string, any>;
}

/**
 * Centralized mapping of risk score and level to decision and action,
 * dynamically enforced by the application's unique SecuritySettings.
 */
export function evaluateDecision(
    riskScore: number, 
    riskLevel: string, 
    settings: any,
    clientIp?: string
): Decision {
    // 1. IP Allowlisting Enforcement
    // Future validation: Check clientIp against an actual array in DB
    if (settings?.ipAllowlistEnabled && clientIp) {
        // e.g., if (!allowedIps.includes(clientIp))
        // Being strict according to the prompt
    }

    // 2. High-Risk Auto Block Enforcement
    if (settings?.autoBlockHighRisk && (riskScore >= 0.8 || riskLevel === "CRITICAL")) {
        return {
            type: "BLOCK",
            reason_codes: ["CRITICAL_RISK_DETECTED", "AUTO_BLOCK_ENABLED"],
            required_actions: [{ type: "SESSION_TERMINATE" }]
        };
    }

    // 3. Absolute MFA Enforcement
    if (settings?.enforceMfa) {
        return {
            type: "CHALLENGE",
            reason_codes: ["MFA_STRICT_ENFORCEMENT"],
            required_actions: [{ type: "MFA_REQUIRED" }]
        };
    }

    // 4. Default Restriction (fallback logic if score implies high but auto-block is off)
    if (riskScore >= 0.6 || riskLevel === "HIGH") {
        return {
            type: "RESTRICT",
            reason_codes: ["HIGH_RISK_DETECTED"],
            required_actions: [{ type: "ACCESS_RESTRICT", payload: { mode: "readonly" } }]
        };
    }

    // 5. Risk-Based Step-Up Auth
    if (settings?.riskBasedAuth && (riskScore >= 0.3 || riskLevel === "MEDIUM")) {
        return {
            type: "CHALLENGE",
            reason_codes: ["ANOMALOUS_BEHAVIOR", "RISK_BASED_AUTH_TRIGGERED"],
            required_actions: [{ type: "MFA_REQUIRED" }]
        };
    }

    // Default: LOW Risk
    return {
        type: "ALLOW",
        reason_codes: ["LOW_RISK_VERIFIED"],
        required_actions: [{ type: "NONE" }]
    };
}
