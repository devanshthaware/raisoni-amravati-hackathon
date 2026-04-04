"""
Risk aggregator that combines outputs from all ML models using weighted hybrid formula.
"""
from typing import Dict, Any, Optional

from src.config.settings import RISK_WEIGHTS, RISK_THRESHOLDS
from src.utils.logger import logger


def aggregate_risk(
    login_result: Dict[str, Any],
    session_result: Dict[str, Any],
    device_result: Dict[str, Any],
    baseline_result: Dict[str, Any],
    global_result: Dict[str, Any],
    rule_based_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Aggregate risk scores from all models using weighted hybrid formula.
    
    Risk Formula:
    Risk = (0.20 × Login) + (0.20 × Session) + (0.15 × DeviceTrustInverse) +
           (0.15 × Baseline) + (0.10 × GlobalThreat) + (0.20 × RuleBasedPlaceholder)
    
    Normalized to 0.0-1.0 scale.
    
    Args:
        login_result: Result from login predictor
        session_result: Result from session predictor
        device_result: Result from device predictor
        baseline_result: Result from baseline predictor
        global_result: Result from global predictor
        rule_based_score: Optional rule-based score (0-1), defaults to 0.0
    
    Returns:
        Dictionary containing:
        - risk_score: Aggregated risk score (0.0-1.0)
        - risk_level: Risk level (LOW, MEDIUM, HIGH, CRITICAL)
        - components: Individual component scores
    """
    try:
        # Extract scores (all should be 0-1)
        login_score = login_result.get("score", 0.0)
        session_score = session_result.get("score", 0.0)
        device_score = device_result.get("score", 0.0)  # Low trust probability
        baseline_score = baseline_result.get("score", 0.0)
        global_score = global_result.get("score", 0.0)
        rule_score = rule_based_score if rule_based_score is not None else 0.0
        
        # Device trust is inverse: low trust = high risk
        # So we use device_score directly (it's already probability of low trust)
        device_risk = device_score
        
        # Calculate weighted risk (0-1 scale)
        weighted_risk = (
            RISK_WEIGHTS["login"] * login_score
            + RISK_WEIGHTS["session"] * session_score
            + RISK_WEIGHTS["device"] * device_risk
            + RISK_WEIGHTS["baseline"] * baseline_score
            + RISK_WEIGHTS["global"] * global_score
            + RISK_WEIGHTS["rule_based"] * rule_score
        )
        
        # Normalized to 0-1 scale for SDK compatibility
        risk_score = round(weighted_risk, 4)
        
        # Clamp to [0, 1]
        risk_score = max(0.0, min(1.0, risk_score))
        
        # Determine risk level
        risk_level = _classify_risk_level(risk_score)
        
        # Prepare flat component breakdown for SDK compatibility
        components = {
            "login": login_score,
            "session": session_score,
            "device": device_score,
            "baseline": baseline_score,
            "global": global_score,
            "rule_based": rule_score,
        }
        
        logger.info(
            f"Risk aggregation - Score: {risk_score:.4f}, Level: {risk_level}, "
            f"Components: Login={login_score:.3f}, Session={session_score:.3f}, "
            f"Device={device_score:.3f}, Baseline={baseline_score:.3f}, "
            f"Global={global_score:.3f}"
        )
        
        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "components": components,
        }
    
    except Exception as e:
        logger.error(f"Error in risk aggregation: {e}")
        raise


def _classify_risk_level(risk_score: float) -> str:
    """
    Classify risk score into risk level.
    
    Args:
        risk_score: Risk score (0.0-1.0)
    
    Returns:
        Risk level string (LOW, MEDIUM, HIGH, CRITICAL)
    """
    if risk_score <= RISK_THRESHOLDS["LOW"][1]:
        return "LOW"
    elif risk_score <= RISK_THRESHOLDS["MEDIUM"][1]:
        return "MEDIUM"
    elif risk_score <= RISK_THRESHOLDS["HIGH"][1]:
        return "HIGH"
    else:
        return "CRITICAL"
