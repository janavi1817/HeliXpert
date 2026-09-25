# -*- coding: utf-8 -*-
"""
HeliXpert AI Orchestrator - Enhanced with NLP and RAG Modes
Works fully offline without requiring Ollama.
Uses a rule-based intent classifier + SQL generator against real SQLite data.
Ollama is used for NLP/RAG modes when available.
"""
import re
import json
import sqlite3
import pandas as pd
import os
import logging
from backend.ai.sql_agent import execute_safe_sql, is_safe_query
from backend.ai.schema_metadata import get_schema_summary
from backend.ai.ollama_client import OllamaClient
from backend.ai.dynamic_query_engine import DynamicQueryEngine

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'data', 'database', 'helixpert.db')

# ---- Intent + SQL mapping rules ----
INTENT_RULES = [
    {
        "keywords": ["how many helicopter", "count helicopter", "total helicopter", "number of helicopter", "कितने हेलीकॉप्टर", "ಎಷ್ಟು ಹೆಲಿಕಾಪ್ಟರ್"],
        "intent": "COUNT_HELICOPTERS",
        "sql": "SELECT COUNT(*) AS total_helicopters FROM helicopters",
        "explain": lambda d: f"There are **{d[0]['total_helicopters']} helicopters** in the HeliXpert database."
    },
    {
        "keywords": ["show all helicopter", "list helicopter", "all helicopter", "helicopter model", "available helicopter"],
        "intent": "LIST_HELICOPTERS",
        "sql": "SELECT model, manufacturer, variant, helicopter_type, country FROM helicopters LIMIT 20",
        "explain": lambda d: f"Found **{len(d)} helicopter records** in the database.",
        "chart": "table"
    },
    {
        "keywords": ["airbus"],
        "intent": "FILTER_HELICOPTERS_AIRBUS",
        "sql": "SELECT model, manufacturer, variant, helicopter_type, country FROM helicopters WHERE manufacturer LIKE '%Airbus%' LIMIT 20",
        "explain": lambda d: f"Found **{len(d)} Airbus helicopter(s)** in the database.",
        "chart": "table"
    },
    {
        "keywords": ["average mgt", "avg mgt", "mean mgt"],
        "intent": "AVG_MGT",
        "sql": "SELECT ROUND(AVG(mgt),2) AS avg_mgt, ROUND(MIN(mgt),2) AS min_mgt, ROUND(MAX(mgt),2) AS max_mgt FROM sensor_parameters",
        "explain": lambda d: f"Across all {742625:,} sensor observations, the **average MGT is {d[0]['avg_mgt']} C** (min: {d[0]['min_mgt']} C, max: {d[0]['max_mgt']} C)."
    },
    {
        "keywords": ["highest mgt", "top mgt", "maximum mgt", "max mgt"],
        "intent": "MAX_MGT",
        "sql": "SELECT id, mgt, oat, trq_measured, faulty FROM sensor_parameters ORDER BY mgt DESC LIMIT 10",
        "explain": lambda d: f"The **highest recorded MGT is {d[0]['mgt']} C** (observation ID: {d[0]['id']}, faulty: {'Yes' if d[0]['faulty'] else 'No'}).",
        "chart": "table"
    },
    {
        "keywords": ["faulty observation", "fault observation", "how many faulty", "faulty count", "faulty sensor", "marked as faulty"],
        "intent": "COUNT_FAULTY",
        "sql": "SELECT faulty, COUNT(*) AS count FROM sensor_parameters GROUP BY faulty",
        "explain": lambda d: _explain_faulty(d),
        "chart": "bar"
    },
    {
        "keywords": ["average torque", "avg torque", "torque margin", "average trq"],
        "intent": "AVG_TORQUE",
        "sql": "SELECT ROUND(AVG(trq_measured),2) AS avg_torque, ROUND(AVG(trq_margin),2) AS avg_margin FROM sensor_parameters",
        "explain": lambda d: f"The **average measured torque is {d[0]['avg_torque']}** and the **average torque margin is {d[0]['avg_margin']}**."
    },
    {
        "keywords": ["mgt trend", "trend of mgt", "mgt over time", "mgt chart"],
        "intent": "MGT_TREND",
        "sql": "SELECT id, mgt FROM sensor_parameters WHERE mgt IS NOT NULL ORDER BY id ASC LIMIT 200",
        "explain": lambda d: f"Showing **MGT trend** over {len(d)} sampled observations from the sensor_parameters dataset.",
        "chart": "line"
    },
    {
        "keywords": ["maintenance", "logbook", "maintenance record"],
        "intent": "LIST_MAINTENANCE",
        "sql": "SELECT IDENT, PROBLEM, PROBLEM_TYPE, LOCATION, ACTION FROM maintenance_records LIMIT 20",
        "explain": lambda d: f"Showing **{len(d)} maintenance records** from the annotated logbook (6,169 total records).",
        "chart": "table"
    },
    {
        "keywords": ["component", "list component", "show component"],
        "intent": "LIST_COMPONENTS",
        "sql": "SELECT component_type, component_name, description FROM components LIMIT 20",
        "explain": lambda d: f"Found **{len(d)} components** in the reference taxonomy.",
        "chart": "table"
    },
    {
        "keywords": ["oat", "outside air temp", "ambient temp"],
        "intent": "AVG_OAT",
        "sql": "SELECT ROUND(AVG(oat),2) AS avg_oat, ROUND(MIN(oat),2) AS min_oat, ROUND(MAX(oat),2) AS max_oat FROM sensor_parameters",
        "explain": lambda d: f"Average OAT: **{d[0]['avg_oat']} C** (min: {d[0]['min_oat']}, max: {d[0]['max_oat']})."
    },
    {
        "keywords": ["compressor speed", "ng", "gas generator"],
        "intent": "AVG_NG",
        "sql": "SELECT ROUND(AVG(ng),2) AS avg_ng, ROUND(MIN(ng),2) AS min_ng, ROUND(MAX(ng),2) AS max_ng FROM sensor_parameters",
        "explain": lambda d: f"Average Gas Generator Speed (Ng): **{d[0]['avg_ng']} %** (min: {d[0]['min_ng']}, max: {d[0]['max_ng']})."
    },
    {
        "keywords": ["power", "np", "net power", "turbine speed"],
        "intent": "AVG_NP",
        "sql": "SELECT ROUND(AVG(np),2) AS avg_np, ROUND(MIN(np),2) AS min_np, ROUND(MAX(np),2) AS max_np FROM sensor_parameters",
        "explain": lambda d: f"Average Power Turbine Speed (Np): **{d[0]['avg_np']} %** (min: {d[0]['min_np']}, max: {d[0]['max_np']})."
    },
]

def _explain_faulty(data):
    total = sum(r['count'] for r in data)
    faulty_rows = [r for r in data if r['faulty'] == 1]
    faulty_count = faulty_rows[0]['count'] if faulty_rows else 0
    pct = round(faulty_count / total * 100, 1) if total > 0 else 0
    return f"Out of **{total:,} sensor observations**, **{faulty_count:,} ({pct}%) are marked as faulty**."


def _normalize_language(language: str) -> str:
    if not language:
        return 'en'
    lang = str(language).strip().lower()
    if lang in {'hi', 'hindi', 'hin'} or lang.startswith('hi-'):
        return 'hi'
    if lang in {'kn', 'kannada', 'kan'} or lang.startswith('kn-'):
        return 'kn'
    return 'en'


def _localize_message(language: str, en: str, hi: str, kn: str) -> str:
    lang = _normalize_language(language)
    if lang == 'hi':
        return hi
    if lang == 'kn':
        return kn
    return en


def _localize_rule_explanation(intent: str, data: list, language: str = 'en') -> str:
    if not data:
        return _localize_message(language,
            'No matching records found for this query.',
            'इस प्रश्न के लिए कोई मिलान रिकॉर्ड नहीं मिला।',
            'ಈ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.')

    if intent == 'COUNT_HELICOPTERS':
        total = data[0].get('total_helicopters', 0)
        return _localize_message(language,
            f'There are **{total} helicopters** in the HeliXpert database.',
            f'HeliXpert डेटाबेस में **{total} हेलीकॉप्टर** हैं।',
            f'HeliXpert ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ **{total} ಹೆಲಿಕಾಪ್ಟರ್‌ಗಳು** ಇವೆ.')
    if intent == 'LIST_HELICOPTERS':
        return _localize_message(language,
            f'Found **{len(data)} helicopter records** in the database.',
            f'डेटाबेस में **{len(data)} हेलीकॉप्टर रिकॉर्ड** मिले हैं।',
            f'ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ **{len(data)} ಹೆಲಿಕಾಪ್ಟರ್ ದಾಖಲೆಗಳು** ಕಂಡುಬಂದಿವೆ.')
    if intent == 'AVG_MGT':
        row = data[0]
        return _localize_message(language,
            f'Across all sensor observations, the **average MGT is {row["avg_mgt"]} C** (min: {row["min_mgt"]} C, max: {row["max_mgt"]} C).',
            f'सभी सेंसर अवलोकनों में **औसत एमजीटी {row["avg_mgt"]} C** है (न्यूनतम: {row["min_mgt"]} C, अधिकतम: {row["max_mgt"]} C)।',
            f'ಎಲ್ಲಾ ಸೆನ್ಸರ್ ಅವಲೋಕನಗಳಲ್ಲಿ **ಸರಾಸರಿ ಎಂ.ಜಿ.ಟಿ. {row["avg_mgt"]} C** ಆಗಿದೆ (ಕನಿಷ್ಠ: {row["min_mgt"]} C, ಗರಿಷ್ಠ: {row["max_mgt"]} C)।')
    if intent == 'COUNT_FAULTY':
        total = sum(r['count'] for r in data)
        faulty_rows = [r for r in data if r['faulty'] == 1]
        faulty_count = faulty_rows[0]['count'] if faulty_rows else 0
        pct = round(faulty_count / total * 100, 1) if total > 0 else 0
        return _localize_message(language,
            f'Out of **{total:,} sensor observations**, **{faulty_count:,} ({pct}%) are marked as faulty**.',
            f'**{total:,}** सेंसर अवलोकनों में से **{faulty_count:,} ({pct}%)** दोषपूर्ण चिह्नित हैं।',
            f'**{total:,}** ಸೆನ್ಸರ್ ಅವಲೋಕನಗಳಲ್ಲಿ **{faulty_count:,} ({pct}%)** ದೋಷಪೂರಿತ ಎಂದು ಗುರುತಿಸಲಾಗಿದೆ.')
    if intent == 'AVG_TORQUE':
        row = data[0]
        return _localize_message(language,
            f'The **average measured torque is {row["avg_torque"]}** and the **average torque margin is {row["avg_margin"]}**.',
            f'**औसत मापा टॉर्क {row["avg_torque"]}** है और **औसत टॉर्क मार्जिन {row["avg_margin"]}** है।',
            f'**ಸರಾಸರಿ ಮಾಪಿಸಿದ ಟಾರ್ಕ್ {row["avg_torque"]}** ಆಗಿದೆ ಮತ್ತು **ಸರಾಸರಿ ಟಾರ್ಕ್ ಮಾರ್ಜಿನ್ {row["avg_margin"]}** ಆಗಿದೆ.')
    if intent == 'LIST_MAINTENANCE':
        return _localize_message(language,
            f'Showing **{len(data)} maintenance records** from the annotated logbook.',
            f'एनोटेटेड लॉगबुक से **{len(data)} रखरखाव रिकॉर्ड** दिखाए जा रहे हैं।',
            f'ಅನೋಟ್‌ಮೆಂಟ್ ಲಾಗ್ಬುಕ್‌ನಿಂದ **{len(data)} ನಿರ್ವಹಣಾ ದಾಖಲೆಗಳು** ತೋರಿಸಲಾಗುತ್ತಿವೆ.')
    if intent == 'LIST_COMPONENTS':
        return _localize_message(language,
            f'Found **{len(data)} components** in the reference taxonomy.',
            f'रेफरेंस टैक्सोनॉमी में **{len(data)} घटक** मिले हैं।',
            f'ರೀಫರೆನ್ಸ್ ಟ್ಯಾಕ್ಸಾನಮಿಯಲ್ಲಿ **{len(data)} ഘಟಕಗಳು** ಕಂಡುಬಂದಿವೆ.')
    return _localize_message(language,
        f'I found **{len(data)} matching records** in the database.',
        f'डेटाबेस में **{len(data)} मिलान रिकॉर्ड** मिले हैं।',
        f'ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ **{len(data)} ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳು** ಕಂಡುಬಂದಿವೆ.')


def detect_intent(query: str):
    q_lower = (query or '').lower()
    for rule in INTENT_RULES:
        for kw in rule["keywords"]:
            k = kw.lower()
            is_match = (re.search(rf"\b{re.escape(k)}\b", q_lower) is not None
                        if len(k) <= 2 else k in q_lower)
            if is_match:
                return rule
    return None

class AiOrchestrator:
    def __init__(self):
        self.schema = get_schema_summary()

        # Initialize Ollama client (REQ-6.2)
        self.ollama_client = OllamaClient()
        self._ollama_available = self.ollama_client.is_available()

        # Initialize Dynamic Query Engine
        self.dynamic_engine = DynamicQueryEngine(DB_PATH)
        logging.info("Dynamic Query Engine initialized")

        # Cache DB stats for prompt context (REQ-6.2)
        conn = sqlite3.connect(DB_PATH)
        try:
            self.heli_count = conn.execute("SELECT COUNT(*) FROM helicopters").fetchone()[0]
            self.sensor_count = conn.execute("SELECT COUNT(*) FROM sensor_parameters").fetchone()[0]
            self.maint_count = conn.execute("SELECT COUNT(*) FROM maintenance_records").fetchone()[0]
            logging.info(f"AiOrchestrator initialized: {self.heli_count} helicopters, {self.sensor_count} sensors, {self.maint_count} maintenance records")
        except Exception as e:
            logging.error(f"Error caching DB stats: {e}")
            self.heli_count = 0
            self.sensor_count = 0
            self.maint_count = 0
        finally:
            conn.close()

    def check_ollama_status(self):
        """
        Check Ollama availability and return status with model information.
        Returns: {"available": bool, "model": str, "models": list}
        """
        try:
            import requests
            r = requests.get("http://localhost:11434/api/tags", timeout=2)
            if r.status_code == 200:
                data = r.json()
                models_list = [model.get("name", "") for model in data.get("models", [])]
                # Default model is llama3:8b, but return first available if it doesn't exist
                default_model = "llama3:8b"
                current_model = default_model if default_model in models_list else (models_list[0] if models_list else None)
                return {
                    "available": True,
                    "model": current_model,
                    "models": models_list
                }
            else:
                return {
                    "available": False,
                    "model": None,
                    "models": []
                }
        except Exception as e:
            logging.debug(f"Ollama status check failed: {e}")
            return {
                "available": False,
                "model": None,
                "models": []
            }

    def _ollama_explain(self, question, sql, data_summary):
        """Use Ollama for a richer explanation if available."""
        try:
            import requests
            prompt = f"""You are HeliXpert AI, a helicopter technical intelligence assistant.
The user asked: "{question}"
I queried the database and got this result:
{data_summary}

Give a concise, professional technical answer. Do not mention SQL. Do not fabricate data."""
            r = requests.post(
                "http://localhost:11434/api/generate",
                json={"model": "llama3:8b", "prompt": prompt, "stream": False},
                timeout=30
            )
            return r.json().get("response", "")
        except:
            return None

    def process_query(self, user_query: str, language: str = 'en'):
        """
        Enhanced query processing using Dynamic Query Engine.
        Falls back to legacy rule-based system if dynamic engine doesn't match.
        """
        lang = _normalize_language(language)
        
        # Try dynamic query engine first
        try:
            logging.info(f"Trying dynamic query engine for: {user_query[:50]}...")
            dynamic_result = self.dynamic_engine.execute_query(user_query, language=lang)
            
            # If dynamic engine successfully processed the query
            if dynamic_result.get('isValid') and dynamic_result.get('intent') != 'UNKNOWN':
                logging.info(f"Dynamic engine SUCCESS: intent={dynamic_result.get('intent')}")
                dynamic_result['isDatasetPending'] = False
                dynamic_result['mode'] = 'dynamic'
                return dynamic_result
            else:
                logging.info(f"Dynamic engine returned UNKNOWN intent, trying legacy rules...")
        except Exception as e:
            logging.warning(f"Dynamic query engine failed: {e}, falling back to legacy rules")
        
        # Fallback to legacy rule-based system
        rule = detect_intent(user_query)

        if rule:
            result = execute_safe_sql(rule["sql"])
            data = result.get("data", [])

            base_explanation = _localize_rule_explanation(rule["intent"], data, lang)
            if not data and hasattr(rule, 'get'):
                base_explanation = _localize_message(lang, 'No matching records found for this query.', 'इस प्रश्न के लिए कोई मिलान रिकॉर्ड नहीं मिला।', 'ಈ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.')

            if self._ollama_available and data:
                enhanced = self._ollama_explain(user_query, rule["sql"], json.dumps(data[:5]))
                explanation = enhanced if enhanced else base_explanation
            else:
                explanation = base_explanation

            chart_type = rule.get("chart", "none")
            chart_data = data

            return {
                "question": user_query,
                "intent": rule["intent"],
                "sql": rule["sql"],
                "isValid": True,
                "queryResult": result,
                "explanation": explanation,
                "chartType": chart_type,
                "chartData": chart_data,
                "isDatasetPending": False,
                "mode": "legacy_rules"
            }
        else:
            # No rule matched
            explanation = _localize_message(
                lang,
                f"I couldn't find a specific query rule for your question. Here's what's available in the HeliXpert database:\n\n- **Helicopters**: {self.heli_count} records\n- **Sensor Observations** (PHM Turboshaft): {self.sensor_count:,} records\n- **Maintenance Records**: {self.maint_count:,} records\n\nTry asking: *'Show all helicopters'*, *'What is the average MGT?'*, *'How many faulty observations?'*, or *'Show maintenance records'*.",
                f"मुझे आपके प्रश्न के लिए कोई विशिष्ट क्वेरी नियम नहीं मिला। HeliXpert डेटाबेस में उपलब्ध जानकारी:\n\n- **हेलीकॉप्टर**: {self.heli_count} रिकॉर्ड\n- **सेंसर अवलोकन** (PHM Turboshaft): {self.sensor_count:,} रिकॉर्ड\n- **रखरखाव रिकॉर्ड**: {self.maint_count:,} रिकॉर्ड\n\nप्रश्न पूछें: *'सभी हेलीकॉप्टर दिखाओ'* , *'औसत एमजीटी क्या है?'*, *'कितने दोषपूर्ण अवलोकन हैं?'*, या *'रखरखाव रिकॉर्ड दिखाओ'*।",
                f"ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ನಿರ್ದಿಷ್ಟ ಕ್ವೆರಿ ನಿಯಮ ಕಂಡುಬಂದಿಲ್ಲ. HeliXpert ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಲಭ್ಯವಿರುವ ಮಾಹಿತಿ:\n\n- **ಹೆಲಿಕಾಪ್ಟರ್‌ಗಳು**: {self.heli_count} ದಾಖಲೆಗಳು\n- **ಸೆನ್ಸರ್ ಅವಲೋಕನಗಳು** (PHM Turboshaft): {self.sensor_count:,} ದಾಖಲೆಗಳು\n- **ನಿರ್ವಹಣಾ ದಾಖಲೆಗಳು**: {self.maint_count:,} ದಾಖಲೆಗಳು\n\nಪ್ರಶ್ನೆ ಕೇಳಿ: *'ಎಲ್ಲಾ ಹೆಲಿಕಾಪ್ಟರ್‌ಗಳನ್ನು ತೋರಿಸಿ'* , *'ಸರಾಸರಿ ಎಂ.ಜಿ.ಟಿ. ಯಾವುದು?'*, *'ಎಷ್ಟು ದೋಷಪೂರಿತ ಅವಲೋಕನಗಳಿವೆ?'*, ಅಥವಾ *'ನಿರ್ವಹಣಾ ದಾಖಲೆಗಳನ್ನು ತೋರಿಸಿ'*।"
            )

            return {
                "question": user_query,
                "intent": "GENERAL",
                "sql": None,
                "isValid": True,
                "queryResult": None,
                "explanation": explanation,
                "chartType": "none",
                "chartData": [],
                "isDatasetPending": False,
                "mode": "fallback"
            }

    # ==================== NEW METHODS FOR AI UPGRADE ====================

    def _get_language_instruction(self, language: str) -> str:
        """
        Get language instruction for Ollama prompt.
        Requirements: REQ-4.4, REQ-6.6
        """
        instructions = {
            'en': "Respond in English only. Be clear and professional.",
            'hi': "केवल हिंदी में जवाब दें। देवनागरी लिपि का उपयोग करें। स्पष्ट और पेशेवर बनें।",
            'kn': "ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರಿಸಿ। ಕನ್ನಡ ಲಿಪಿಯನ್ನು ಬಳಸಿ। ಸ್ಪಷ್ಟ ಮತ್ತು ವೃತ್ತಿಪರವಾಗಿರಿ।"
        }
        return instructions.get(language, instructions['en'])

    def _retrieve_context(self, question: str) -> dict:
        """
        Retrieve relevant context from database for RAG mode.
        Requirements: REQ-6.4

        Returns: {"sql": str, "rows": list, "table": str}
        """
        q_lower = question.lower()

        # Keyword-based SQL generation
        if any(kw in q_lower for kw in ["engine", "mgt", "temperature", "hot", "vibration", "इंजन", "तापमान", "ಎಂಜಿನ್", "ತಾಪಮಾನ"]):
            sql = "SELECT id, mgt, oat, trq_measured, ng, np, faulty FROM sensor_parameters ORDER BY mgt DESC LIMIT 10"
            table = "sensor_parameters"
        elif any(kw in q_lower for kw in ["maintenance", "repair", "problem", "logbook", "रखरखाव", "मरम्मत", "ನಿರ್ವಹಣೆ", "ದುರಸ್ತಿ"]):
            sql = "SELECT IDENT, PROBLEM, PROBLEM_TYPE, LOCATION, ACTION FROM maintenance_records LIMIT 5"
            table = "maintenance_records"
        elif any(kw in q_lower for kw in ["helicopter", "aircraft", "model", "fleet", "हेलीकॉप्टर", "विमान", "ಹೆಲಿಕಾಪ್ಟರ್", "ವಿಮಾನ"]):
            sql = "SELECT model, manufacturer, variant, helicopter_type, country FROM helicopters LIMIT 5"
            table = "helicopters"
        elif any(kw in q_lower for kw in ["component", "part", "rotor", "gear", "घटक", "भाग", "ಘಟಕ", "ಭಾಗ"]):
            sql = "SELECT component_type, component_name, description FROM components LIMIT 5"
            table = "components"
        else:
            # No match → summary counts
            sql = """SELECT
                       (SELECT COUNT(*) FROM helicopters) as helicopters,
                       (SELECT COUNT(*) FROM sensor_parameters) as sensors,
                       (SELECT COUNT(*) FROM maintenance_records) as maintenance,
                       (SELECT COUNT(*) FROM components) as components"""
            table = "summary"

        result = execute_safe_sql(sql)
        return {
            "sql": sql,
            "rows": result.get("data", []),
            "table": table
        }

    def _retrieve_precise_context(self, question: str) -> dict:
        """Retrieve records tailored to the requested metric before broad fallback."""
        q_lower = question.lower()
        metric_terms = {
            "mgt": ("mgt", ["mgt", "temperature", "hot", "एमजीटी", "तापमान", "इंजन तापमान", "ಎಂಜಿಟಿ", "ತಾಪಮಾನ", "ಎಂಜಿನ್ ತಾಪಮಾನ"]),
            "oat": ("oat", ["oat", "outside air", "ambient", "बाहरी तापमान", "वातावरण", "ಹೊರಗಿನ ತಾಪಮಾನ", "ವಾತಾವರಣ"]),
            "trq_measured": ("trq_measured", ["torque", "trq", "टॉर्क", "टार्क", "ಟಾರ್ಕ್"]),
            "ng": ("ng", ["gas generator", "compressor speed", "गैस जनरेटर", "कंप्रेसर गति", "ಗ್ಯಾಸ್ ಜನರೇಟರ್", "ಕಂಪ್ರೆಸರ್ ವೇಗ"]),
            "np": ("np", ["power turbine", "turbine speed", "पावर टर्बाइन", "टर्बाइन गति", "ಪವರ್ ಟರ್ಬೈನ್", "ಟರ್ಬೈನ್ ವೇಗ"]),
        }
        metric = next((column for column, (_, terms) in metric_terms.items()
                       if any(term in q_lower for term in terms)), None)

        if any(term in q_lower for term in ["fault", "faulty", "खराब", "दोष", "फॉल्ट", "ದೋಷ", "ತಪ್ಪು"]):
            sql = "SELECT faulty, COUNT(*) AS observations FROM sensor_parameters GROUP BY faulty"
            table = "sensor_parameters"
        elif metric and any(term in q_lower for term in ["average", "avg", "mean", "औसत", "माध्य", "ಸರಾಸರಿ"]):
            sql = f"SELECT ROUND(AVG({metric}), 2) AS average, ROUND(MIN({metric}), 2) AS minimum, ROUND(MAX({metric}), 2) AS maximum FROM sensor_parameters"
            table = "sensor_parameters"
        elif metric and any(term in q_lower for term in ["highest", "maximum", "peak", "अधिकतम", "सबसे अधिक", "ಗರಿಷ್ಠ", "ಅತಿ ಹೆಚ್ಚು"]):
            sql = f"SELECT id, {metric}, oat, trq_measured, ng, np, faulty FROM sensor_parameters WHERE {metric} IS NOT NULL ORDER BY {metric} DESC LIMIT 10"
            table = "sensor_parameters"
        elif metric:
            sql = f"SELECT id, {metric}, oat, trq_measured, ng, np, faulty FROM sensor_parameters WHERE {metric} IS NOT NULL ORDER BY id DESC LIMIT 10"
            table = "sensor_parameters"
        else:
            return self._retrieve_context(question)

        result = execute_safe_sql(sql)
        return {"sql": sql, "rows": result.get("data", []), "table": table}

    def _format_retrieved_context(self, context_data: dict, language: str = 'en') -> str:
        """Produce an offline, natural-language summary using only retrieved rows."""
        rows, table = context_data["rows"], context_data["table"]
        def message(en: str, hi: str, kn: str) -> str:
            return hi if language == 'hi' else kn if language == 'kn' else en

        if not rows:
            return message("No matching records were found in the dataset.",
                           "डेटासेट में कोई मिलान रिकॉर्ड नहीं मिला।",
                           "ಡೇಟಾಸೆಟ್‌ನಲ್ಲಿ ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.")
        if table == "helicopters":
            examples = "; ".join(f"{r.get('model', 'Unknown')} ({r.get('manufacturer', 'unknown')})" for r in rows[:5])
            return message(f"I found {len(rows)} matching helicopter record(s): {examples}.",
                           f"मुझे {len(rows)} मिलते-जुलते हेलीकॉप्टर रिकॉर्ड मिले: {examples}।",
                           f"ನನಗೆ ಹೊಂದಾಣಿಕೆಯಾಗುವ {len(rows)} ಹೆಲಿಕಾಪ್ಟರ್ ದಾಖಲೆಗಳು ದೊರೆತಿವೆ: {examples}.")
        if table == "maintenance_records":
            examples = "; ".join(f"{r.get('IDENT', 'record')}: {r.get('PROBLEM', 'no description')}" for r in rows[:5])
            return message(f"I retrieved {len(rows)} maintenance record(s): {examples}.",
                           f"मुझे {len(rows)} रखरखाव रिकॉर्ड मिले: {examples}।",
                           f"ನನಗೆ {len(rows)} ನಿರ್ವಹಣೆ ದಾಖಲೆಗಳು ದೊರೆತಿವೆ: {examples}.")
        if table == "components":
            examples = "; ".join(f"{r.get('component_name', 'unnamed')} ({r.get('component_type', 'component')})" for r in rows[:5])
            return message(f"I found {len(rows)} component record(s): {examples}.",
                           f"मुझे {len(rows)} घटक रिकॉर्ड मिले: {examples}।",
                           f"ನನಗೆ {len(rows)} ಘಟಕ ದಾಖಲೆಗಳು ದೊರೆತಿವೆ: {examples}.")
        if table == "sensor_parameters":
            first = rows[0]
            if "average" in first:
                return message(
                    f"From the sensor dataset, the average is {first['average']} (minimum {first['minimum']}, maximum {first['maximum']}).",
                    f"सेंसर डेटासेट के अनुसार औसत {first['average']} है (न्यूनतम {first['minimum']}, अधिकतम {first['maximum']})।",
                    f"ಸೆನ್ಸರ್ ಡೇಟಾಸೆಟ್‌ನ ಪ್ರಕಾರ ಸರಾಸರಿ {first['average']} ಆಗಿದೆ (ಕನಿಷ್ಠ {first['minimum']}, ಗರಿಷ್ಠ {first['maximum']}).")
            if "observations" in first:
                counts = "; ".join(f"{'faulty' if r.get('faulty') else 'not faulty'}: {r.get('observations', 0)}" for r in rows)
                return message(f"Sensor fault status counts: {counts}.",
                               f"सेंसर फॉल्ट स्थिति की संख्या: {counts}।",
                               f"ಸೆನ್ಸರ್ ದೋಷ ಸ್ಥಿತಿಯ ಎಣಿಕೆ: {counts}.")
            fields = ", ".join(f"{key} {first[key]}" for key in ("mgt", "oat", "trq_measured", "ng", "np") if first.get(key) is not None)
            return message(
                f"I retrieved {len(rows)} sensor record(s). The first matching record (ID {first.get('id')}) has {fields}.",
                f"मुझे {len(rows)} सेंसर रिकॉर्ड मिले। पहले मिलते रिकॉर्ड (ID {first.get('id')}) में {fields} है।",
                f"ನನಗೆ {len(rows)} ಸೆನ್ಸರ್ ದಾಖಲೆಗಳು ದೊರೆತಿವೆ. ಮೊದಲ ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆ (ID {first.get('id')}) ನಲ್ಲಿ {fields} ಇದೆ.")
        if table == "summary":
            stats = rows[0]
            return message(
                f"The dataset contains {stats['helicopters']} helicopters, {stats['sensors']:,} sensor readings, {stats['maintenance']:,} maintenance records, and {stats['components']} components.",
                f"डेटासेट में {stats['helicopters']} हेलीकॉप्टर, {stats['sensors']:,} सेंसर रीडिंग, {stats['maintenance']:,} रखरखाव रिकॉर्ड और {stats['components']} घटक हैं।",
                f"ಡೇಟಾಸೆಟ್‌ನಲ್ಲಿ {stats['helicopters']} ಹೆಲಿಕಾಪ್ಟರ್‌ಗಳು, {stats['sensors']:,} ಸೆನ್ಸರ್ ಓದುಗಳು, {stats['maintenance']:,} ನಿರ್ವಹಣೆ ದಾಖಲೆಗಳು ಮತ್ತು {stats['components']} ಘಟಕಗಳಿವೆ.")
        return message(f"I retrieved {len(rows)} relevant record(s) from the dataset.",
                       f"मुझे डेटासेट से {len(rows)} प्रासंगिक रिकॉर्ड मिले।",
                       f"ಡೇಟಾಸೆಟ್‌ನಿಂದ {len(rows)} ಸಂಬಂಧಿತ ದಾಖಲೆಗಳು ದೊರೆತಿವೆ.")

    def process_nlp(self, question: str, language: str = 'en') -> dict:
        """
        NLP Mode: Direct natural language to Ollama with domain context.
        Fallback to rule-based engine if Ollama unavailable.
        Requirements: REQ-2.3, REQ-6.5
        """
        # Try rule-based first for quick responses
        rule = detect_intent(question)

        if rule:
            # Keep deterministic dataset answers available in all languages.
            logging.info(f"NLP mode: using deterministic dataset answer for language={language}")
            result = self.process_query(question, language=language)
            result["source"] = "rule_engine"
            result["mode"] = "nlp"
            return result

        # For dataset subjects, prefer an immediate natural-language summary of
        # the retrieved evidence over a potentially slow model completion.
        context_data = self._retrieve_precise_context(question)
        if context_data["table"] != "summary":
            return {
                "question": question,
                "intent": "NLP_RETRIEVAL",
                "sql": context_data["sql"],
                "isValid": True,
                "queryResult": {"data": context_data["rows"]},
                "explanation": self._format_retrieved_context(context_data, language),
                "chartType": "table",
                "chartData": context_data["rows"],
                "source": "offline_nlp_retrieval",
                "mode": "nlp",
                "language": language,
                "isDatasetPending": False
            }

        # Do not send non-English questions to a slow model as a fallback.
        # The localized dataset summary is more useful and remains available
        # completely offline.
        if language != 'en':
            return {
                "question": question,
                "intent": "NLP_RETRIEVAL",
                "sql": context_data["sql"],
                "isValid": True,
                "queryResult": {"data": context_data["rows"]},
                "explanation": self._format_retrieved_context(context_data, language),
                "chartType": "none",
                "chartData": context_data["rows"],
                "source": "offline_nlp_retrieval",
                "mode": "nlp",
                "language": language,
                "isDatasetPending": False
            }

        if self._ollama_available:
            # Build domain-aware system prompt
            lang_instruction = self._get_language_instruction(language)

            # Create language-specific prompt
            if language == 'hi':
                user_prompt = f"प्रश्न: {question}\n\nकृपया केवल हिंदी में उत्तर दें।"
            elif language == 'kn':
                user_prompt = f"ಪ್ರಶ್ನೆ: {question}\n\nದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಮಾತ್ರ ಉತ್ತರಿಸಿ।"
            else:
                user_prompt = f"Question: {question}"

            system_prompt = f"""You are HeliXpert AI, an expert helicopter maintenance and diagnostics assistant.

Database information:
- {self.heli_count} helicopters in fleet
- {self.sensor_count:,} engine sensor readings
- {self.maint_count:,} maintenance records

{lang_instruction}

Be concise and technical. Do not fabricate sensor values or maintenance data.
If you don't know something, say so clearly.

{user_prompt}"""

            try:
                logging.info(f"NLP mode: Calling Ollama (language: {language})")
                response = self.ollama_client.call_ollama(system_prompt, timeout=30)

                return {
                    "question": question,
                    "intent": "NLP",
                    "sql": None,
                    "isValid": True,
                    "queryResult": None,
                    "explanation": response,
                    "chartType": "none",
                    "chartData": [],
                    "source": "ollama",
                    "mode": "nlp",
                    "language": language,
                    "isDatasetPending": False
                }
            except Exception as e:
                logging.warning(f"Ollama NLP failed: {e}")

        # Final fallback to rule-based
        if rule:
            result = self.process_query(question)
            result["source"] = "rule_engine_fallback"
            result["mode"] = "nlp"
            return result
        else:
            # No fixed generic reply: retrieve dataset context and phrase it as a
            # natural-language answer when no local LLM is available.
            context_data = self._retrieve_precise_context(question)
            return {
                "question": question,
                "intent": "NLP_RETRIEVAL",
                "sql": context_data["sql"],
                "isValid": True,
                "queryResult": {"data": context_data["rows"]},
                "explanation": self._format_retrieved_context(context_data, language),
                "chartType": "table" if context_data["table"] != "summary" else "none",
                "chartData": context_data["rows"],
                "source": "offline_nlp_retrieval",
                "mode": "nlp",
                "isDatasetPending": False
            }

    def process_rag(self, question: str, language: str = 'en') -> dict:
        """
        RAG Mode: Retrieve relevant data from DB, then use Ollama for explanation.
        Fallback to formatted SQL results if Ollama unavailable.
        Requirements: REQ-2.4, REQ-6.6
        """
        # Step 1: Retrieve context
        logging.info(f"RAG mode: Retrieving context for question: {question[:50]}...")
        context_data = self._retrieve_precise_context(question)

        if not context_data["rows"]:
            return {
                "question": question,
                "intent": "RAG_NO_MATCH",
                "sql": None,
                "isValid": True,
                "queryResult": None,
                "explanation": "No relevant data found for your query." if language == 'en'
                             else "आपके प्रश्न के लिए कोई प्रासंगिक डेटा नहीं मिला।" if language == 'hi'
                             else "ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ಸಂಬಂಧಿತ ಡೇಟಾ ಕಂಡುಬಂದಿಲ್ಲ।",
                "chartType": "none",
                "chartData": [],
                "context": [],
                "source": "rule_engine",
                "mode": "rag",
                "isDatasetPending": False
            }

        # RAG's contract is to expose relevant dataset evidence. Return that
        # evidence directly so the answer stays fast, factual and distinct even
        # when a local LLM is slow or unavailable.
        # Set HELIXPERT_RAG_MODEL_SUMMARY=true only when a responsive local
        # model is desired to rewrite the retrieved evidence.
        use_model_summary = os.getenv("HELIXPERT_RAG_MODEL_SUMMARY", "false").lower() == "true"
        if not use_model_summary:
            return {
                "question": question,
                "intent": "RAG_RETRIEVAL",
                "sql": context_data["sql"],
                "isValid": True,
                "queryResult": {"data": context_data["rows"]},
                "explanation": self._format_retrieved_context(context_data, language),
                "chartType": "table",
                "chartData": context_data["rows"],
                "context": context_data["rows"],
                "source": "dataset_retrieval",
                "mode": "rag",
                "language": language,
                "isDatasetPending": False
            }

        # Step 2: If Ollama available, generate explanation
        if self._ollama_available:
            try:
                lang_instruction = self._get_language_instruction(language)
                context_str = json.dumps(context_data["rows"], indent=2)

                if language == 'hi':
                    rag_prompt = f"""आप HeliXpert AI हैं। केवल नीचे दिए गए डेटा के आधार पर उत्तर दें।

प्राप्त डेटा:
{context_str}

{lang_instruction}

प्रश्न: {question}

कृपया हिंदी में संक्षिप्त उत्तर दें और डेटा से विशिष्ट मान उद्धृत करें।"""
                elif language == 'kn':
                    rag_prompt = f"""ನೀವು HeliXpert AI. ಕೆಳಗಿನ ಡೇಟಾದ ಆಧಾರದ ಮೇಲೆ ಮಾತ್ರ ಉತ್ತರಿಸಿ।

ಪಡೆದ ಡೇಟಾ:
{context_str}

{lang_instruction}

ಪ್ರಶ್ನೆ: {question}

ದಯವಿಟ್ಟು ಕನ್ನಡದಲ್ಲಿ ಸಂಕ್ಷಿಪ್ತ ಉತ್ತರವನ್ನು ನೀಡಿ ಮತ್ತು ಡೇಟಾದಿಂದ ನಿರ್ದಿಷ್ಟ ಮೌಲ್ಯಗಳನ್ನು ಉಲ್ಲೇಖಿಸಿ।"""
                else:
                    rag_prompt = f"""You are HeliXpert AI. Answer ONLY based on the retrieved data below.

Retrieved data:
{context_str}

{lang_instruction}

User question: {question}

Be concise and cite specific values from the context."""

                logging.info(f"RAG mode: Calling Ollama with context from {context_data['table']} (language: {language})")
                response = self.ollama_client.call_ollama(rag_prompt, timeout=30)

                return {
                    "question": question,
                    "intent": "RAG",
                    "sql": context_data["sql"],
                    "isValid": True,
                    "queryResult": {"data": context_data["rows"]},
                    "explanation": response,
                    "chartType": "table",
                    "chartData": context_data["rows"],
                    "context": context_data["rows"],
                    "source": "ollama+rag",
                    "mode": "rag",
                    "language": language,
                    "isDatasetPending": False
                }
            except Exception as e:
                logging.warning(f"Ollama RAG failed: {e}, returning raw context")

        # Fallback: Return formatted SQL results without Ollama explanation
        explanation = self._format_retrieved_context(context_data, language)

        return {
            "question": question,
            "intent": "RAG_FALLBACK",
            "sql": context_data["sql"],
            "isValid": True,
            "queryResult": {"data": context_data["rows"]},
            "explanation": explanation,
            "chartType": "table",
            "chartData": context_data["rows"],
            "context": context_data["rows"],
            "source": "rule_engine",
            "mode": "rag",
            "isDatasetPending": False
        }
