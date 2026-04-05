from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import os
from twilio.rest import Client
import google.generativeai as genai
from dotenv import load_dotenv
from convex import ConvexClient
from src.utils.logger import logger
from urllib.parse import urlparse

load_dotenv()
load_dotenv(".env.local") # Explicitly load .env.local if present
CONVEX_URL = os.getenv("NEXT_PUBLIC_CONVEX_URL", "mock_url")
convex_client = None


def _is_mock_convex_url(url: str) -> bool:
    # In this repo we treat any value containing "mock" as "no Convex available".
    return (not url) or ("mock" in url.lower())


def get_convex_client() -> ConvexClient | None:
    """
    Lazily create the Convex client so ML backend can start even when
    NEXT_PUBLIC_CONVEX_URL isn't a valid Convex HTTP(S) origin.
    """
    global convex_client

    if convex_client is not None:
        return convex_client

    if _is_mock_convex_url(CONVEX_URL):
        return None

    parsed = urlparse(CONVEX_URL)
    # Convex expects an absolute URL like: https://<name>-<id>.convex.cloud
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        logger.warning(
            "Invalid NEXT_PUBLIC_CONVEX_URL for Convex (expected absolute http(s) URL). Got: %r. Running without Convex.",
            CONVEX_URL,
        )
        return None

    try:
        convex_client = ConvexClient(CONVEX_URL)
        return convex_client
    except Exception:
        logger.exception("Failed to initialize ConvexClient; running without Convex.")
        return None

# Setup Router
router = APIRouter(prefix="/api/v1/support", tags=["Support Center"])

# Request Models
class CallRequest(BaseModel):
    user_id: str
    phone_number: str

class ChatRequest(BaseModel):
    ticket_id: str
    message: str
    user_id: str

# Config & Credentials
# ElevenLabs Unified Integration (Phone + AI handled by ElevenLabs)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "your_elevenlabs_api_key_here")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "your_elevenlabs_agent_id_here")
ELEVENLABS_PHONE_ID = os.getenv("ELEVENLABS_PHONE_ID", "your_elevenlabs_phone_number_id_here")
# THE HARDCODED NUMBER TO CALL (Include country code, e.g., +91 or +1)
HARDCODED_SUPPORT_RECEIVER = "+910000000000" 

import requests

def trigger_outbound_call(to_phone: str):
    """
    Triggers an outbound call directly via ElevenLabs using their Twilio integration API.
    """
    if "your_elevenlabs_api_key" in ELEVENLABS_API_KEY:
        logger.warning("ElevenLabs API Key not configured. Skipping outbound call.")
        return {"status": "unconfigured"}
        
    url = f"https://api.elevenlabs.io/v1/convai/twilio/outbound-call"
    
    payload = {
        "agent_id": ELEVENLABS_AGENT_ID,
        "agent_phone_number_id": ELEVENLABS_PHONE_ID,
        "to_number": to_phone
    }
    
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code != 200:
             logger.error(f"ElevenLabs error response ({response.status_code}): {response.text}")
             return {"status": "error", "message": response.text}
             
        logger.info(f"ElevenLabs outbound call initiated successfully. Full Response: {response.text}")
        return {"status": "success", "response_data": response.json()}
    except Exception as e:
        logger.error(f"ElevenLabs background task error: {str(e)}")
        return {"status": "error", "message": str(e)}


@router.post("/call")
async def trigger_voice_support(request: CallRequest, background_tasks: BackgroundTasks):
    """
    Initiates a voice call to the hardcoded number or the provided one.
    """
    try:
        # Use the hardcoded receiver provided by the user
        target_number = HARDCODED_SUPPORT_RECEIVER if HARDCODED_SUPPORT_RECEIVER != "+910000000000" else request.phone_number
        
        # Run Call in Background to avoid blocking the API response
        background_tasks.add_task(trigger_outbound_call, target_number)
        return {"status": "Call initiated", "phone": target_number}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Helper for Gemini Tools
def get_user_account_summary(user_id: str):
    """Fetches profile info and registered applications for the user."""
    try:
        logger.info(f"AI Tool Call: get_user_account_summary for {user_id}")
        client = get_convex_client()
        if client is None:
            return {"error": "Convex service unavailable"}
        return client.query("support:getUserContext", {"userId": user_id})
    except Exception as e:
        logger.error(f"Tool Error (get_user_account_summary): {e}")
        return {"error": str(e)}

def get_user_security_logs(user_id: str):
    """Fetches recent login attempts and security alerts for the user."""
    try:
        logger.info(f"AI Tool Call: get_user_security_logs for {user_id}")
        client = get_convex_client()
        if client is None:
            return {"error": "Convex service unavailable"}
        return client.query("support:getUserSecurityHistory", {"userId": user_id})
    except Exception as e:
        logger.error(f"Tool Error (get_user_security_logs): {e}")
        return {"error": str(e)}

def run_system_diagnostics():
    """Returns ML backend system info, loaded models, and simulated terminal diagnostic output."""
    try:
        logger.info("AI Tool Call: run_system_diagnostics")
        import sys, platform
        return {
            "system": platform.system(),
            "platform_release": platform.release(),
            "python_version": sys.version.split()[0],
            "models_active": ["login_v1", "session_v1", "device_trust", "baseline_anomaly", "global_threat"],
            "api_status": "healthy",
            "terminal_output": "[DIAGNOSTIC] Checking weights... OK\n[DIAGNOSTIC] Convex sync... ACTIVE\n[DIAGNOSTIC] Port 8000 listening... YES"
        }
    except Exception as e:
        logger.error(f"Tool Error (run_system_diagnostics): {e}")
        return {"error": str(e)}

# Re-configure to ensure API Key is picked up from load_dotenv
genai.configure(api_key=os.getenv("GEMINI_API_KEY", "mock_gemini_key"))

# Initialize Agentic Model
tools = [get_user_account_summary, get_user_security_logs, run_system_diagnostics]
model = genai.GenerativeModel(
    model_name='gemini-2.5-flash',
    tools=tools
)

@router.post("/ai-chat")
async def trigger_ai_chat(request: ChatRequest):
    """
    Generates an AI response for the user's support message using Gemini Agentic Tools.
    """
    try:
        with open("ai_debug.log", "a") as f:
            f.write(f"\n--- New Chat Request ---\nTicket: {request.ticket_id}\nUser: {request.user_id}\nMessage: {request.message}\n")
        
        chat = model.start_chat(enable_automatic_function_calling=True)
        
        system_instruction = f"""
        You are the highly professional AegisAuth Support Assistant (Agentic Version). 
        You have direct access to the system datastore and ML backend diagnostics via tools.
        
        CRITICAL RULES:
        1. ALWAYS use the provided tools to research the user's specific context before answering if they have an issue.
        2. The current user's ID is: {request.user_id}. Use this with your tools.
        3. If a user asks about their risk score or why they were blocked, use `get_user_security_logs`.
        4. If a user asks about system status, use `run_system_diagnostics`.
        5. Your response MUST be highly structured with **Markdown Bullet Points** and **Bold Keywords**.
        6. Acknowledge the user's message politely and be concise.
        """
        
        # User message
        prompt = f"User Message: {request.message}\nUser ID: {request.user_id}"
        full_msg = f"{system_instruction}\n\n{prompt}"
        
        with open("ai_debug.log", "a") as f:
            f.write("Sending message to Gemini...\n")
            
        response = chat.send_message(full_msg)
        ai_text = response.text
        
        with open("ai_debug.log", "a") as f:
            f.write(f"Gemini Response: {ai_text[:100]}...\n")
        
        # Write the response back to Convex DB.
        if not _is_mock_convex_url(CONVEX_URL):
            client = get_convex_client()
            if client is not None:
                with open("ai_debug.log", "a") as f:
                    f.write("Writing to Convex...\n")
                client.mutation("support:sendMessage", {
                    "ticketId": request.ticket_id,
                    "senderId": "system",
                    "senderRole": "ai",
                    "content": ai_text,
                    "isAiGenerated": True
                })
                with open("ai_debug.log", "a") as f:
                    f.write("Convex write success.\n")
        
        return {"status": "success", "response": ai_text}
    except Exception as e:
        logger.error(f"AI Chat Error: {str(e)}")
        import traceback
        err_msg = traceback.format_exc()
        logger.error(err_msg)
        with open("ai_debug.log", "a") as f:
            f.write(f"ERROR: {str(e)}\n{err_msg}\n")
        raise HTTPException(status_code=500, detail=str(e))

