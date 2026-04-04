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
        client = get_convex_client()
        if client and api_key:
            app = client.query("applications:getByApiKey", {"apiKey": api_key})
            if app:
                client.mutation("sessions:createSession", {
                    "applicationId": app["_id"],
                    "userEmail": payload.email,
                    "device": "SDK-Device",
                    "browser": request.headers.get("user-agent", "Unknown"),
                    "location": "Unknown",
                    "ip": request.client.host if request.client else "127.0.0.1",
                    "score": 0.0,
                    "initialState": "ACTIVE"
                })
    except Exception as e:
        logger.warning(f"Failed to report signup session to Convex: {e}")
    
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
    
    # In a real scenario, we'd extract features from the request/metadata
    # Here we simulate features for the ML model
    mock_features = {
        "login_hour": time.localtime().tm_hour,
        "device_known": 1,
        "country_changed": 0,
        "login_velocity": 1.0,
        "ip_reputation_score": 0.9,
        "asn_changed": 0,
        "failed_attempts": 0,
        "mfa_failures": 0,
    }
    
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
            client = get_convex_client()
            if client and api_key:
                app = client.query("applications:getByApiKey", {"apiKey": api_key})
                if app:
                    # Map decision to Convex state
                    state_map = {
                        "ALLOW": "ACTIVE",
                        "CHALLENGE": "CHALLENGED",
                        "BLOCK": "BLOCKED"
                    }
                    client.mutation("sessions:createSession", {
                        "applicationId": app["_id"],
                        "userEmail": payload.email,
                        "device": "SDK-Device",
                        "browser": request.headers.get("user-agent", "Unknown"),
                        "location": "Unknown",
                        "ip": request.client.host if request.client else "127.0.0.1",
                        "score": score,
                        "initialState": state_map.get(decision_type, "EVALUATING")
                    })
        except Exception as e:
            logger.warning(f"Failed to report login session to Convex: {e}")

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
