from fastapi import APIRouter
import pandas as pd
import sqlite3
import os

router = APIRouter(prefix="/api/cmapss", tags=["Engine Prognostics"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'data', 'database', 'helixpert.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@router.get("/summary")
def get_cmapss_summary():
    conn = get_db_connection()
    try:
        count = conn.execute("SELECT COUNT(*) FROM cmapss_fd001_train").fetchone()[0]
        engines = conn.execute("SELECT COUNT(DISTINCT unit_number) FROM cmapss_fd001_train").fetchone()[0]
        summary = {
            "dataset": "NASA C-MAPSS FD001",
            "total_cycles": count,
            "total_engines": engines
        }
    except Exception:
        summary = {"dataset": "NASA C-MAPSS", "total_cycles": 0, "total_engines": 0}
    finally:
        conn.close()
    return summary

@router.get("/engine/{unit_number}")
def get_engine_data(unit_number: int):
    conn = get_db_connection()
    try:
        df = pd.read_sql_query("SELECT * FROM cmapss_fd001_train WHERE unit_number = ? ORDER BY time_in_cycles ASC", conn, params=(unit_number,))
        res = df.to_dict(orient="records")
    except Exception:
        res = []
    finally:
        conn.close()
    return res
