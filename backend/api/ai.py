from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.ai.orchestrator import AiOrchestrator

router = APIRouter(prefix="/api/analyst", tags=["AI Analyst"])
orchestrator = AiOrchestrator()

class AnalystQuery(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None  # Accept both field names for compatibility

@router.post("/query")
def process_query(request: AnalystQuery):
    # Accept either 'query' or 'question' field
    user_input = request.query or request.question
    if not user_input or not user_input.strip():
        raise HTTPException(status_code=400, detail="Query/question field is required")
    try:
        result = orchestrator.process_query(user_input)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
def get_ai_status():
    try:
        is_up = orchestrator._check_ollama()
        return {
            "status": "ready",
            "ollama_available": is_up,
            "mode": "ollama" if is_up else "rule_based_offline",
            "description": "Ollama LLM available" if is_up else "Running in offline rule-based mode"
        }
    except Exception as e:
        return {
            "status": "ready",
            "ollama_available": False,
            "mode": "rule_based_offline",
            "description": "Offline rule-based mode"
        }
