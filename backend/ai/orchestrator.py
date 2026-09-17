# -*- coding: utf-8 -*-
"""
HeliXpert AI Orchestrator
Works fully offline without requiring Ollama.
Uses a rule-based intent classifier + SQL generator against real SQLite data.
Ollama is used optionally for richer explanations if it is running.
"""
import re
import json
import sqlite3
import pandas as pd
import os
import logging
from backend.ai.sql_agent import execute_safe_sql, is_safe_query
from backend.ai.schema_metadata import get_schema_summary

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'data', 'database', 'helixpert.db')

# ---- Intent + SQL mapping rules ----
INTENT_RULES = [
    {
        "keywords": ["how many helicopter", "count helicopter", "total helicopter", "number of helicopter"],
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


def detect_intent(query: str):
    q_lower = query.lower()
    for rule in INTENT_RULES:
        for kw in rule["keywords"]:
            if kw in q_lower:
                return rule
    return None


class AiOrchestrator:
    def __init__(self):
        self.schema = get_schema_summary()
        # Try to connect to Ollama optionally
        self._ollama_available = self._check_ollama()

    def _check_ollama(self):
        try:
            import requests
            r = requests.get("http://localhost:11434/api/tags", timeout=2)
            return r.status_code == 200
        except:
            return False

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

    def process_query(self, user_query: str):
        rule = detect_intent(user_query)

        if rule:
            # Execute rule-based SQL
            result = execute_safe_sql(rule["sql"])
            data = result.get("data", [])

            # Build explanation
            base_explanation = rule["explain"](data) if data else "No matching records found for this query."

            # Optionally enhance with Ollama
            if self._ollama_available and data:
                enhanced = self._ollama_explain(user_query, rule["sql"], json.dumps(data[:5]))
                explanation = enhanced if enhanced else base_explanation
            else:
                explanation = base_explanation

            chart_type = rule.get("chart", "none")
            # For bar chart, ensure keys are named for the chart component
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
                "isDatasetPending": False
            }
        else:
            # No rule matched — try a generic fallback with a direct DB summary
            conn = sqlite3.connect(DB_PATH)
            heli_count = conn.execute("SELECT COUNT(*) FROM helicopters").fetchone()[0]
            maint_count = conn.execute("SELECT COUNT(*) FROM maintenance_records").fetchone()[0]
            sensor_count = conn.execute("SELECT COUNT(*) FROM sensor_parameters").fetchone()[0]
            conn.close()

            explanation = (
                f"I couldn't find a specific query rule for your question. "
                f"Here's what's available in the HeliXpert database:\n\n"
                f"- **Helicopters**: {heli_count} records\n"
                f"- **Sensor Observations** (PHM Turboshaft): {sensor_count:,} records\n"
                f"- **Maintenance Records**: {maint_count:,} records\n\n"
                f"Try asking: *'Show all helicopters'*, *'What is the average MGT?'*, "
                f"*'How many faulty observations?'*, or *'Show maintenance records'*."
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
                "isDatasetPending": False
            }
