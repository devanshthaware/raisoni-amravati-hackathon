import { Decision, AegisError } from "../types";
import { executeAction } from "../actions/actions";
import { updateSessionState } from "../session/session";

/**
 * Handle a canonical decision from the backend.
 * Mapping Decision.type:
 * ALLOW → activate session
 * CHALLENGE → trigger MFA
 * RESTRICT → apply restrictions
 * BLOCK → terminate session
 */
export async function handleDecision(decision: Decision): Promise<void> {
    const { type, required_actions } = decision;

    switch (type) {
        case "ALLOW":
            updateSessionState("ACTIVE");
            break;
        case "CHALLENGE":
            updateSessionState("CHALLENGED");
            // If the decision requires MFA, start it
            if (required_actions.some(a => a.type === "MFA_REQUIRED")) {
                await executeAction({ type: "MFA_REQUIRED", payload: {} });
                throw new AegisError("MFA Verification Required", "MFA_REQUIRED");
            }
            break;

        case "RESTRICT":
            updateSessionState("RESTRICTED");
            await executeAction({ type: "ACCESS_RESTRICT", payload: {} });
            break;

        case "BLOCK":
            updateSessionState("BLOCKED");
            await executeAction({ type: "SESSION_TERMINATE", payload: {} });
            throw new AegisError("Access blocked due to high security risk", "ACCESS_DENIED");

        default:
            throw new AegisError(`Unsupported decision type: ${type}`, "CONFIG_ERROR");
    }
}
