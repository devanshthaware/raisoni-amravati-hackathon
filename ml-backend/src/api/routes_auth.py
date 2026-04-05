from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, List, Optional
import uuid
import time
from pydantic import BaseModel, Field

from src.api.schemas import LoginRequest, ModelPredictionResponse
from src.inference.login_predictor import predict_login_anomaly
from src.utils.logger import logger
from src.utils.convex import get_convex_client

router = APIRouter(prefix="/auth", tags=["Auth Bridge"])

# --- SDK Compatible Schemas ---

class DecisionAction(BaseModel):
    type: str # MFA_REQUIRED, SESSION_TERMINATE, ACCESS_RESTRICT, NONE
    payload: Optional[Dict[str, Any]] = None

class Decision(BaseModel):
    type: str # ALLOW, CHALLENGE, RESTRICT, BLOCK
    required_actions: List[DecisionAction] = []
    reason_codes: List[str] = []

class UserData(BaseModel):
    id: str
    email: str
    name: Optional[str] = None

class AuthResponseData(BaseModel):
    user: UserData
    token: str

class AuthResponse(BaseModel):
    data: AuthResponseData
    decision: Decision
    sessionId: str
    correlationId: str

class LoginPayload(BaseModel):
    email: str
    password: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SignupPayload(LoginPayload):
    name: Optional[str] = None

# --- Routes ---

@router.post("/signup", response_model=AuthResponse)
async def signup(payload: SignupPayload, request: Request):
    """
    Handle user signup and return initial decision.
    """
    logger.info(f"Signup bridge request for: {payload.email}")
    
    # Generate mock session and correlation IDs
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    correlation_id = f"corr_{uuid.uuid4().hex[:12]}"
    
    # For signup, we usually ALLOW but we could run a quick profile check
    decision = Decision(
        type="ALLOW",
        required_actions=[DecisionAction(type="NONE")],
        reason_codes=["NEW_USER_REGISTRATION"]
    )

    # --- Convex Integration ---
    try:
        api_key = request.headers.get("x-api-key")
        app_id = request.headers.get("x-app-id")
        client = get_convex_client()
        if client and api_key:
            app = client.query("applications:getByApiKey", {"apiKey": api_key, "appId": app_id})
            if app:

                sessionId = client.mutation("sessions:createSession", {
                    "applicationId": app["_id"],
                    "userEmail": payload.email,
                    "device": "SDK-Device",
                    "browser": request.headers.get("user-agent", "Unknown"),
                    "location": "Unknown",
                    "ip": request.client.host if request.client else "127.0.0.1",
                    "score": 0.0,
                    "initialState": "ACTIVE"
                })
                
                # Sync ML results for signup
                client.mutation("ml:syncMLResults", {
                    "sessionId": sessionId,
                    "correlationId": f"corr_{uuid.uuid4().hex[:12]}",
                    "score": 0.0,
                    "factors": {
                        "ipRisk": 0.0,
                        "deviceTrust": 1.0,
                        "geoAnomaly": 0.0
                    },
                    "modelVersion": "v1-bridge",
                    "state": "ACTIVE",
                    "decisionType": "ALLOW",
                    "riskResult": {
                        "risk_score": 0.0,
                        "risk_level": "LOW",
                        "components": {}
                    }
                })
    except Exception as e:
            logger.error(f"Failed to report signup session to Convex: {e}")
            logger.error(traceback.format_exc())

    
    return AuthResponse(
        data=AuthResponseData(
            user=UserData(id=f"user_{uuid.uuid4().hex[:8]}", email=payload.email, name=payload.name),
            token=f"jwt_{uuid.uuid4().hex}"
        ),
        decision=decision,
        sessionId=session_id,
        correlationId=correlation_id
    )

@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginPayload, request: Request):
    """
    Handle user login, run ML risk assessment, and return decision.
    """
    logger.info(f"Login bridge request for: {payload.email}")
    
    # Extract features from metadata if provided, fallback to defaults
    metadata = payload.metadata or {}
    
    mock_features = {
        "login_hour": metadata.get("login_hour", time.localtime().tm_hour),
        "device_known": metadata.get("device_known", 1),
        "country_changed": metadata.get("country_changed", 0),
        "login_velocity": metadata.get("login_velocity", 1.0),
        "ip_reputation_score": metadata.get("ip_reputation_score", 0.9),
        "asn_changed": metadata.get("asn_changed", 0),
        "failed_attempts": metadata.get("failed_attempts", 0),
        "mfa_failures": metadata.get("mfa_failures", 0),
    }
    
    # Ensure all features are integers or floats as expected by the model
    mock_features = {k: float(v) if isinstance(v, (int, float)) else 0.0 for k, v in mock_features.items()}
    # Special cases for int features
    for k in ["login_hour", "device_known", "country_changed", "asn_changed", "failed_attempts", "mfa_failures"]:
        mock_features[k] = int(mock_features[k])
    
    try:
        # Run ML prediction
        prediction = predict_login_anomaly(mock_features)
        score = prediction["score"]
        
        # Mapping Score to Decision
        decision_type = "ALLOW"
        actions = [DecisionAction(type="NONE")]
        
        if score > 0.8:
            decision_type = "BLOCK"
            actions = [DecisionAction(type="SESSION_TERMINATE")]
        elif score > 0.5:
            decision_type = "CHALLENGE"
            actions = [DecisionAction(type="MFA_REQUIRED")]
            
        decision = Decision(
            type=decision_type,
            required_actions=actions,
            reason_codes=[f"RISK_SCORE_{score:.2f}"]
        )
        
        # --- Convex Integration ---
        try:
            api_key = request.headers.get("x-api-key")
            app_id = request.headers.get("x-app-id")
            client = get_convex_client()
            if client and api_key:
                app = client.query("applications:getByApiKey", {"apiKey": api_key, "appId": app_id})
                if app:

                    # Map decision to Convex state
                    state_map = {
                        "ALLOW": "ACTIVE",
                        "CHALLENGE": "CHALLENGED",
                        "BLOCK": "BLOCKED"
                    }
                    sessionId = client.mutation("sessions:createSession", {
                        "applicationId": app["_id"],
                        "userEmail": payload.email,
                        "device": "SDK-Device",
                        "browser": request.headers.get("user-agent", "Unknown"),
                        "location": "Unknown",
                        "ip": request.client.host if request.client else "127.0.0.1",
                        "score": score,
                        "initialState": state_map.get(decision_type, "EVALUATING")
                    })
                    
                    # Sync ML results to mlScores and activities
                    client.mutation("ml:syncMLResults", {
                        "sessionId": sessionId,
                        "correlationId": f"corr_{uuid.uuid4().hex[:12]}",
                        "score": score,
                        "factors": {
                            "ipRisk": score, # Using login score as ipRisk
                            "deviceTrust": 0.9, # Mocked
                            "geoAnomaly": 0.1 # Mocked
                        },
                        "modelVersion": "v1-bridge",
                        "state": state_map.get(decision_type, "ACTIVE"),
                        "decisionType": decision_type,
                        "riskResult": {
                            "risk_score": score,
                            "risk_level": decision_type,
                            "components": mock_features
                        }
                    })
        except Exception as e:
            logger.error(f"Failed to report login session to Convex: {e}")
            logger.error(traceback.format_exc())


        session_id = f"sess_{uuid.uuid4().hex[:12]}"

        correlation_id = f"corr_{uuid.uuid4().hex[:12]}"
        
        return AuthResponse(
            data=AuthResponseData(
                user=UserData(id=f"user_{uuid.uuid4().hex[:8]}", email=payload.email),
                token=f"jwt_{uuid.uuid4().hex}"
            ),
            decision=decision,
            sessionId=session_id,
            correlationId=correlation_id
        )
        
    except Exception as e:
        logger.error(f"Error in login bridge: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
async def logout(request: Request):
    return {"success": True}

@router.get("/me")
async def me():
    # This is a mock since the ML backend doesn't manage users
    return {"id": "mock_user", "email": "mock@example.com"}
