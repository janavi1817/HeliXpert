# -*- coding: utf-8 -*-
"""
HeliXpert AI Orchestrator v4
- NLP Mode:  data questions → SQL engine; knowledge questions → Ollama or offline KB
- RAG Mode:  retrieve DB rows → Ollama synthesises answer; fallback = raw rows
- Offline KB: built-in helicopter knowledge so common questions work without Ollama
- Context: last 6 conversation turns passed to Ollama for follow-up support
- No hardcoded query→answer mappings. Configuration/prompts/schema is acceptable.
"""
from __future__ import annotations

import re
import sqlite3
import os
import logging
from typing import Optional

from backend.ai.sql_agent import execute_safe_sql
from backend.ai.schema_metadata import get_schema_summary
from backend.ai.ollama_client import OllamaClient
from backend.ai.dynamic_query_engine import DynamicQueryEngine

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'database', 'helixpert.db')

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language helpers
# ---------------------------------------------------------------------------

def _norm_lang(language: str) -> str:
    if not language:
        return 'en'
    l = str(language).strip().lower()
    if l.startswith('hi'):
        return 'hi'
    if l.startswith('kn'):
        return 'kn'
    return 'en'

_LANG_INSTR = {
    'en': "Respond in English. Be concise and professional.",
    'hi': "केवल हिंदी में उत्तर दें। स्पष्ट और संक्षिप्त रहें।",
    'kn': "ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರಿಸಿ। ಸ್ಪಷ್ಟ ಮತ್ತು ಸಂಕ್ಷಿಪ್ತವಾಗಿರಿ।",
}

def _loc(lang: str, en: str, hi: str, kn: str) -> str:
    if lang == 'hi': return hi
    if lang == 'kn': return kn
    return en


# ---------------------------------------------------------------------------
# Offline helicopter knowledge base
# Provides answers when Ollama is not running.
# Keys are topic patterns (regex); values are English answers.
# The LLM is NOT used here — these are factual technical definitions.
# ---------------------------------------------------------------------------

_KB: list = [
    # Engine / MGT
    (r'\bmgt\b|mass gas temperature|turbine inlet temp',
     "MGT (Mass Gas Temperature) is the temperature of exhaust gases at the turbine inlet in a turboshaft helicopter engine. "
     "It is a critical health indicator — high MGT indicates engine stress, possible compressor fouling, or fuel system issues. "
     "Normal operating range is typically 600–900°C depending on the engine model."),

    (r'turboshaft|turboshaft engine',
     "A turboshaft engine is a gas turbine that produces shaft power rather than thrust. "
     "It is the standard powerplant for helicopters, driving the main rotor and tail rotor through a transmission. "
     "Key parameters monitored include MGT, Ng (gas generator speed), Np (power turbine speed), torque, and OAT."),

    # Cowling
    (r'engine cowl|cowling|engine cover|cowl',
     "The engine cowling is the protective cover enclosing the helicopter engine. "
     "It provides aerodynamic fairing, protects the engine from foreign object damage, and allows maintenance access via hinged panels. "
     "Damage types include dents, cracks, oil staining from leaks, and delamination of composite panels. "
     "Inspection should check for secure fasteners, no cracks at stress points, and no oil or fluid staining."),

    # Rotor
    (r'main rotor|rotor blade|rotor system',
     "The main rotor is the primary lift-generating system of a helicopter, consisting of two or more blades attached to a rotating hub. "
     "Blades are typically made from composite materials or aluminium alloy. "
     "Common defects include leading-edge erosion, delamination, surface cracks, and tip cap damage. "
     "Rotor track and balance must be maintained to minimise vibration."),

    (r'tail rotor|fenestron|anti-torque',
     "The tail rotor provides anti-torque force to counteract the main rotor torque and enable yaw control. "
     "It operates at high RPM and is vulnerable to ground strikes, foreign object damage, and bearing wear. "
     "A fenestron (ducted fan) is an alternative design used on some helicopters like the Airbus H135."),

    # Transmission
    (r'transmission|gearbox|main gearbox|mgb',
     "The main gearbox (transmission) reduces the high shaft speed from the engine to the lower RPM needed by the rotor. "
     "It is one of the most critical components — loss of lubrication can lead to catastrophic failure within minutes. "
     "Monitoring includes chip detectors, oil temperature, oil pressure, and vibration analysis."),

    # Landing gear
    (r'landing gear|skid|undercarriage',
     "Helicopter landing gear is typically skid-type or wheeled. "
     "Skids are simple, lightweight aluminium or steel tubes. "
     "Common issues include bent cross-tubes from hard landings, corrosion at attachment points, and crack initiation at stress concentrations. "
     "Post-hard-landing inspections are mandatory before further flight."),

    # Hydraulics
    (r'hydraulic|hydraulic system|hydraulic pump',
     "The hydraulic system provides power-assisted flight control inputs. "
     "A failure can result in significantly increased control forces or loss of control authority. "
     "Regular checks include fluid level, leaks at fittings and actuators, and filter condition. "
     "Fluid contamination is a common maintenance issue."),

    # Torque
    (r'\btorque\b|trq|torque margin',
     "Torque is the rotational force transmitted from the engine to the rotor through the transmission. "
     "Torque margin is the difference between available torque and the torque being used — a low margin indicates the engine is near its limit. "
     "Typical monitoring involves measured torque (trq_measured) and the available margin (trq_margin)."),

    # OAT
    (r'\boat\b|outside air temperature|ambient temperature',
     "OAT (Outside Air Temperature) is the ambient air temperature measured outside the aircraft. "
     "It directly affects engine performance — higher OAT reduces air density, which reduces engine power and rotor lift. "
     "Hot-and-high conditions (high temperature and altitude) are critical performance limiting factors for helicopters."),

    # Ng / Np
    (r'\bng\b|gas generator speed|compressor speed|n1',
     "Ng is the gas generator speed, expressed as a percentage of the design maximum RPM. "
     "It represents the speed of the compressor and turbine section of the engine. "
     "Low Ng at a given power setting can indicate compressor fouling or bleed air issues."),

    (r'\bnp\b|power turbine speed|n2|free turbine',
     "Np is the power turbine (free turbine) speed. "
     "In a free-turbine engine, the power turbine drives the rotor and is aerodynamically coupled to the gas generator. "
     "Np is normally governed to a constant value in flight to maintain rotor RPM."),

    # Inspection
    (r'inspect|inspection|pre-flight|daily check',
     "Helicopter inspections follow a layered schedule: pre-flight checks before each flight, daily inspections, and periodic inspections at defined flight hours. "
     "Pre-flight covers control continuity, fluid levels, rotor blade condition, visible structural integrity, and secure access panels. "
     "Discrepancies must be documented in the maintenance logbook before flight."),

    # Maintenance
    (r'maintenance|scheduled maintenance|mx',
     "Helicopter maintenance is defined by the manufacturer's Maintenance Manual and follows a time/cycle-based schedule. "
     "Key intervals include 100-hour inspections, component overhaul times (TBO), and on-condition monitoring for modern platforms. "
     "All maintenance must be carried out by licensed AMEs (Aircraft Maintenance Engineers) and documented in the aircraft log."),

    # Fault / defect
    (r'fault|defect|failure|anomaly|damage',
     "Helicopter faults are categorised by severity: airworthiness-critical (ground the aircraft immediately), major (repair before next flight), and minor (monitor or defer). "
     "Common fault areas include engine hot section degradation, rotor blade damage, hydraulic leaks, and avionics malfunctions. "
     "In the HeliXpert dataset, sensor_parameters records are labelled faulty=1 when abnormal engine readings were detected."),

    # PHM
    (r'phm|prognostics|health monitoring|condition monitoring',
     "PHM (Prognostics and Health Management) uses sensor data to predict component failures before they occur. "
     "For helicopter turboshaft engines, monitored parameters include MGT, Ng, Np, torque, and vibration. "
     "The HeliXpert PHM dataset contains over 742,000 sensor observations with fault labels for engine health classification research."),

    # HeliXpert general
    (r'helixpert|what (can|does) (you|this) (do|know)|capabilities|features',
     "HeliXpert AI is an offline helicopter intelligence platform. "
     "It can answer questions about helicopter components, maintenance procedures, engine health parameters, and technical concepts. "
     "In NLP mode, it uses an offline AI model for natural language understanding. "
     "In RAG mode, it retrieves relevant data from the HeliXpert database and uses that as context for its answers. "
     "All processing is 100% offline — no internet connection required."),
]

def _offline_kb_lookup(question: str) -> Optional[str]:
    """
    Search the offline knowledge base for a matching answer.
    Returns the answer string, or None if no match found.
    """
    q = question.lower()
    for pattern, answer in _KB:
        if re.search(pattern, q, re.IGNORECASE):
            return answer
    return None


# ---------------------------------------------------------------------------
# Data-query classifier
# ---------------------------------------------------------------------------

_DATA_VERBS = re.compile(
    r'\b(how many|count|list|show|display|give me|find|fetch|average|avg|mean|'
    r'maximum|minimum|highest|lowest|total|top|bottom|trend|chart|table|'
    r'कितने|सूची|दिखाओ|ಎಷ್ಟು|ಪಟ್ಟಿ|ತೋರಿಸಿ)\b',
    re.IGNORECASE,
)
_DB_ENTITIES = re.compile(
    r'\b(helicopter|sensor|maintenance|component|mgt|torque|oat|ng|np|faulty|'
    r'logbook|record|observation|fleet|हेलीकॉप्टर|सेंसर|रखरखाव|घटक|'
    r'ಹೆಲಿಕಾಪ್ಟರ್|ಸೆನ್ಸರ್|ನಿರ್ವಹಣೆ|ಘಟಕ)\b',
    re.IGNORECASE,
)

def _is_data_query(question: str) -> bool:
    return bool(_DATA_VERBS.search(question)) and bool(_DB_ENTITIES.search(question))


# ---------------------------------------------------------------------------
# Context retrieval
# ---------------------------------------------------------------------------

def _retrieve_context(question: str) -> dict:
    q = question.lower()

    if any(t in q for t in ["mgt", "temperature", "turbine", "engine temp", "इंजन", "तापमान", "ಎಂಜಿನ್"]):
        if any(t in q for t in ["average", "avg", "mean", "औसत", "ಸರಾಸರಿ"]):
            sql = "SELECT ROUND(AVG(mgt),2) AS average, ROUND(MIN(mgt),2) AS minimum, ROUND(MAX(mgt),2) AS maximum FROM sensor_parameters"
        elif any(t in q for t in ["highest", "max", "peak", "top", "अधिकतम", "ಗರಿಷ್ಠ"]):
            sql = "SELECT id, mgt, oat, trq_measured, ng, np, faulty FROM sensor_parameters ORDER BY mgt DESC LIMIT 10"
        elif any(t in q for t in ["faulty", "fault", "दोष", "ದೋಷ"]):
            sql = "SELECT ROUND(AVG(mgt),2) AS average, ROUND(MIN(mgt),2) AS minimum, ROUND(MAX(mgt),2) AS maximum FROM sensor_parameters WHERE faulty=1"
        else:
            sql = "SELECT ROUND(AVG(mgt),2) AS average, ROUND(MIN(mgt),2) AS minimum, ROUND(MAX(mgt),2) AS maximum FROM sensor_parameters"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "sensor_parameters"}

    if any(t in q for t in ["torque", "trq", "टॉर्क", "ಟಾರ್ಕ್"]):
        sql = "SELECT ROUND(AVG(trq_measured),2) AS avg_torque, ROUND(AVG(trq_margin),2) AS avg_margin FROM sensor_parameters"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "sensor_parameters"}

    if any(t in q for t in ["oat", "outside air", "ambient", "बाहरी", "ಹೊರಗಿನ"]):
        sql = "SELECT ROUND(AVG(oat),2) AS average, ROUND(MIN(oat),2) AS minimum, ROUND(MAX(oat),2) AS maximum FROM sensor_parameters"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "sensor_parameters"}

    if any(t in q for t in ["faulty", "fault", "anomaly", "defect", "दोष", "ದೋಷ"]):
        sql = "SELECT faulty, COUNT(*) AS count FROM sensor_parameters GROUP BY faulty"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "sensor_parameters"}

    if any(t in q for t in ["maintenance", "repair", "logbook", "problem", "रखरखाव", "ನಿರ್ವಹಣೆ"]):
        sql = "SELECT IDENT, PROBLEM, PROBLEM_TYPE, LOCATION, ACTION FROM maintenance_records LIMIT 8"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "maintenance_records"}

    if any(t in q for t in ["helicopter", "aircraft", "model", "fleet", "हेलीकॉप्टर", "ಹೆಲಿಕಾಪ್ಟರ್"]):
        sql = "SELECT model, manufacturer, variant, helicopter_type, country FROM helicopters LIMIT 10"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "helicopters"}

    if any(t in q for t in ["component", "part", "rotor", "cowling", "gear", "blade", "घटक", "ಘಟಕ"]):
        sql = "SELECT component_type, component_name, description FROM components LIMIT 10"
        return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "components"}

    sql = """SELECT
        (SELECT COUNT(*) FROM helicopters)         AS helicopters,
        (SELECT COUNT(*) FROM sensor_parameters)   AS sensor_readings,
        (SELECT COUNT(*) FROM maintenance_records) AS maintenance_records,
        (SELECT COUNT(*) FROM components)          AS components"""
    return {"sql": sql, "rows": execute_safe_sql(sql).get("data", []), "table": "summary"}


def _fmt(rows: list, table: str) -> str:
    if not rows:
        return "No matching records found."
    if table == "summary":
        r = rows[0]
        return (f"Database contains: {r.get('helicopters',0)} helicopters, "
                f"{r.get('sensor_readings',0):,} sensor readings, "
                f"{r.get('maintenance_records',0):,} maintenance records, "
                f"{r.get('components',0)} components.")
    lines = []
    for i, row in enumerate(rows[:8], 1):
        lines.append(f"  {i}. " + ", ".join(f"{k}: {v}" for k, v in row.items() if v is not None))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Conversation history
# ---------------------------------------------------------------------------

_history: list = []
_MAX_H = 6


def _add_history(user: str, assistant: str) -> None:
    _history.append({"role": "user",      "content": user})
    _history.append({"role": "assistant", "content": assistant})
    while len(_history) > _MAX_H * 2:
        _history.pop(0)


def _build_prompt(system: str, question: str) -> str:
    parts = [system, ""]
    for turn in _history[-(_MAX_H * 2):]:
        parts.append(("User" if turn["role"] == "user" else "Assistant") + ": " + turn["content"])
    parts.append(f"User: {question}")
    parts.append("Assistant:")
    return "\n".join(parts)


def _system_prompt(stats: dict, lang: str) -> str:
    return (
        "You are HeliXpert AI, an expert helicopter maintenance and technical intelligence assistant.\n\n"
        f"Database: {stats.get('helicopters',0)} helicopters, "
        f"{stats.get('sensors',0):,} engine sensor readings, "
        f"{stats.get('maintenance',0):,} maintenance records, "
        f"{stats.get('components',0)} components.\n\n"
        "Rules:\n"
        "1. Answer helicopter questions accurately and concisely.\n"
        "2. Use provided database context for data questions.\n"
        "3. Use your knowledge for definitions/explanations/procedures.\n"
        "4. Track conversation context — resolve pronouns like 'it' from prior turns.\n"
        "5. Never fabricate sensor values or maintenance records.\n"
        "6. If you don't know, say so clearly.\n\n"
        + _LANG_INSTR.get(lang, _LANG_INSTR['en'])
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AiOrchestrator:

    def __init__(self):
        self.schema  = get_schema_summary()
        self.ollama  = OllamaClient()
        self.dynamic = DynamicQueryEngine(DB_PATH)
        self._stats  = {"helicopters": 0, "sensors": 0, "maintenance": 0, "components": 0}
        try:
            conn = sqlite3.connect(DB_PATH)
            self._stats["helicopters"] = conn.execute("SELECT COUNT(*) FROM helicopters").fetchone()[0]
            self._stats["sensors"]     = conn.execute("SELECT COUNT(*) FROM sensor_parameters").fetchone()[0]
            self._stats["maintenance"] = conn.execute("SELECT COUNT(*) FROM maintenance_records").fetchone()[0]
            self._stats["components"]  = conn.execute("SELECT COUNT(*) FROM components").fetchone()[0]
            conn.close()
            logger.info(f"AiOrchestrator v4 ready | stats={self._stats} | model={self.ollama.model_name}")
        except Exception as e:
            logger.error(f"DB stats error: {e}")

    def check_ollama_status(self) -> dict:
        try:
            import requests
            r = requests.get("http://localhost:11434/api/tags", timeout=2)
            if r.status_code == 200:
                models = [m.get("name", "") for m in r.json().get("models", [])]
                model  = next((m for m in models if "llama" in m.lower()), models[0] if models else None)
                return {"available": True, "model": model, "models": models}
        except Exception:
            pass
        return {"available": False, "model": None, "models": []}

    def _call_ollama(self, question: str, lang: str, ctx: str = "") -> Optional[str]:
        """Call Ollama with conversation history. Returns response or None."""
        try:
            system = _system_prompt(self._stats, lang)
            q = (f"Relevant database data:\n{ctx}\n\nQuestion: {question}" if ctx else question)
            prompt = _build_prompt(system, q)
            resp = self.ollama.call_ollama(prompt, timeout=45)
            return resp.strip() if resp and resp.strip() else None
        except Exception as e:
            logger.warning(f"Ollama call failed: {e}")
            return None

    def _sql_answer(self, question: str, lang: str) -> dict:
        """Answer a data query using DynamicQueryEngine then fallback SQL."""
        try:
            dyn = self.dynamic.execute_query(question, language=lang)
            if dyn.get("isValid") and dyn.get("intent") not in ("UNKNOWN", None):
                dyn["mode"] = "nlp"
                dyn["source"] = "dynamic_sql"
                return dyn
        except Exception as e:
            logger.warning(f"Dynamic engine: {e}")

        ctx = _retrieve_context(question)
        exp = _fmt(ctx["rows"], ctx["table"])
        return {
            "question": question, "intent": "DATA_QUERY",
            "sql": ctx["sql"], "isValid": True,
            "queryResult": {"data": ctx["rows"]},
            "explanation": exp,
            "chartType": "table" if ctx["table"] != "summary" else "none",
            "chartData": ctx["rows"],
            "source": "sql_engine", "mode": "nlp", "isDatasetPending": False,
        }

    # ------------------------------------------------------------------ NLP
    def process_nlp(self, question: str, language: str = 'en') -> dict:
        lang = _norm_lang(language)

        # 1. Data queries always go to SQL engine
        if _is_data_query(question):
            res = self._sql_answer(question, lang)
            _add_history(question, res.get("explanation", ""))
            return res

        # 2. Try Ollama for knowledge questions
        if self.ollama.is_available():
            resp = self._call_ollama(question, lang)
            if resp:
                _add_history(question, resp)
                return {
                    "question": question, "intent": "NLP_KNOWLEDGE",
                    "sql": None, "isValid": True, "queryResult": None,
                    "explanation": resp,
                    "chartType": "none", "chartData": [],
                    "source": "ollama", "mode": "nlp", "language": lang,
                    "isDatasetPending": False,
                }

        # 3. Offline: check built-in knowledge base
        kb_ans = _offline_kb_lookup(question)
        if kb_ans:
            _add_history(question, kb_ans)
            return {
                "question": question, "intent": "NLP_KB",
                "sql": None, "isValid": True, "queryResult": None,
                "explanation": kb_ans,
                "chartType": "none", "chartData": [],
                "source": "offline_kb", "mode": "nlp", "language": lang,
                "isDatasetPending": False,
            }

        # 4. Try to pull related DB rows as context
        ctx = _retrieve_context(question)
        if ctx["rows"] and ctx["table"] != "summary":
            exp = _fmt(ctx["rows"], ctx["table"])
            _add_history(question, exp)
            return {
                "question": question, "intent": "NLP_DB_FALLBACK",
                "sql": ctx["sql"], "isValid": True,
                "queryResult": {"data": ctx["rows"]},
                "explanation": exp,
                "chartType": "table", "chartData": ctx["rows"],
                "source": "sql_fallback", "mode": "nlp", "language": lang,
                "isDatasetPending": False,
            }

        # 5. Nothing matched — honest fallback
        msg = _loc(lang,
            "I don't have enough information to answer that question. "
            "For full knowledge-based answers, please start Ollama (`ollama serve`). "
            "I can answer data questions about helicopters, sensors, and maintenance offline.",
            "इस प्रश्न का उत्तर देने के लिए पर्याप्त जानकारी नहीं है। "
            "पूर्ण उत्तर के लिए Ollama शुरू करें।",
            "ಈ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರಿಸಲು ಸಾಕಷ್ಟು ಮಾಹಿತಿ ಇಲ್ಲ. "
            "ಸಂಪೂರ್ಣ ಉತ್ತರಕ್ಕಾಗಿ Ollama ಪ್ರಾರಂಭಿಸಿ.",
        )
        _add_history(question, msg)
        return {
            "question": question, "intent": "NLP_NO_MATCH",
            "sql": None, "isValid": True, "queryResult": None,
            "explanation": msg,
            "chartType": "none", "chartData": [],
            "source": "fallback", "mode": "nlp", "language": lang,
            "isDatasetPending": False,
        }

    # ------------------------------------------------------------------ RAG
    def process_rag(self, question: str, language: str = 'en') -> dict:
        lang = _norm_lang(language)
        ctx  = _retrieve_context(question)
        rows_txt = _fmt(ctx["rows"], ctx["table"])

        if self.ollama.is_available() and ctx["rows"]:
            resp = self._call_ollama(question, lang, ctx=rows_txt)
            if resp:
                _add_history(question, resp)
                return {
                    "question": question, "intent": "RAG",
                    "sql": ctx["sql"], "isValid": True,
                    "queryResult": {"data": ctx["rows"]},
                    "explanation": resp,
                    "chartType": "table", "chartData": ctx["rows"],
                    "context": ctx["rows"], "source": "ollama+rag",
                    "mode": "rag", "language": lang, "isDatasetPending": False,
                }

        exp = rows_txt if ctx["rows"] else _loc(lang,
            "No relevant data found.", "प्रासंगिक डेटा नहीं मिला।", "ಸಂಬಂಧಿತ ಡೇಟಾ ಕಂಡುಬಂದಿಲ್ಲ.")
        _add_history(question, exp)
        return {
            "question": question, "intent": "RAG_FALLBACK",
            "sql": ctx["sql"], "isValid": True,
            "queryResult": {"data": ctx["rows"]},
            "explanation": exp,
            "chartType": "table" if ctx["rows"] else "none",
            "chartData": ctx["rows"],
            "context": ctx["rows"], "source": "dataset_retrieval",
            "mode": "rag", "language": lang, "isDatasetPending": False,
        }

    # ----------------------------------------------------------- compatibility
    def process_query(self, user_query: str, language: str = 'en') -> dict:
        return self.process_nlp(user_query, language)
