/**
 * Configuration for AegisAuth SDK initialization
 */
export interface AegisConfig {
  apiKey: string;
  baseUrl: string;
  appId: string;
  debug?: boolean;
  timeout?: number;
  retries?: number;
}

/**
 * Common signal payload for fingerprinting
 */
export interface SignalPayload {
  userAgent: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  timestamp: number;
}

/**
 * Authentication payloads
 */
export interface LoginPayload {
  email: string;
  password?: string;
  metadata?: Record<string, any>;
}

export interface SignupPayload extends LoginPayload {
  name?: string;
}

/**
 * Canonical Decisions
 */
export type DecisionType = "ALLOW" | "CHALLENGE" | "RESTRICT" | "BLOCK";

export interface DecisionAction {
  type: "MFA_REQUIRED" | "SESSION_TERMINATE" | "ACCESS_RESTRICT" | "NONE";
  payload?: Record<string, any>;
}

export interface Decision {
  type: DecisionType;
  required_actions: DecisionAction[];
  reason_codes: string[];
}

/**
 * Session Information
 */
export type SessionState = 
  | "NEW" 
  | "EVALUATING" 
  | "ACTIVE" 
  | "CHALLENGED" 
  | "RESTRICTED" 
  | "BLOCKED" 
  | "TERMINATED";

export interface Session {
  id: string;
  state: SessionState;
  correlationId: string;
  userId?: string;
  email?: string;
  riskScore?: number;
}

/**
 * SDK Responses
 */
export interface AegisResponse<T> {
  data: T;
  decision?: Decision;
  sessionId?: string;
  correlationId?: string;
}

export interface AuthResponse extends AegisResponse<{
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token: string;
}> {}

/**
 * Events
 */
export type AegisEventType = 
  | "SIGNAL_RECEIVED" 
  | "RISK_CALCULATED" 
  | "DECISION_MADE" 
  | "ACTION_DISPATCHED" 
  | "ACTION_EXECUTED" 
  | "STATE_TRANSITIONED"
  | "MFA_STARTED"
  | "MFA_VERIFIED";

/**
 * Errors
 */
export type AegisErrorCode = 
  | "AUTH_ERROR" 
  | "SESSION_EXPIRED" 
  | "ACCESS_DENIED" 
  | "NETWORK_ERROR"
  | "CONFIG_ERROR"
  | "MFA_REQUIRED";

export class AegisError extends Error {
  code: AegisErrorCode;
  details?: any;

  constructor(message: string, code: AegisErrorCode, details?: any) {
    super(message);
    this.name = "AegisError";
    this.code = code;
    this.details = details;
  }
}
