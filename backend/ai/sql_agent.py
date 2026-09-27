import sqlite3
import pandas as pd
import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'data', 'database', 'helixpert.db')

def is_safe_query(query: str) -> bool:
    """Validates that the SQL is strictly read-only."""
    # Basic safety checks
    disallowed_keywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'ATTACH', 'DETACH', 'PRAGMA', 'REPLACE']
    q_upper = query.upper()
    
    # Must start with SELECT or WITH
    q_stripped = q_upper.strip()
    if not (q_stripped.startswith('SELECT') or q_stripped.startswith('WITH')):
        return False
        
    for kw in disallowed_keywords:
        if re.search(rf'\b{kw}\b', q_upper):
            return False
            
    # Block multiple statements
    if ';' in query.strip().strip(';'):
        return False
        
    return True

def execute_safe_sql(query: str):
    """Executes a validated read-only SQL query against the database using Pandas."""
    if not is_safe_query(query):
        return {"success": False, "error": "Query validation failed. Only SELECT statements are allowed."}
        
    try:
        conn = sqlite3.connect(DB_PATH)
        # Apply a limit if not present to prevent massive data loads
        if 'LIMIT' not in query.upper():
            query = f"{query} LIMIT 100"
            
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        return {
            "success": True,
            "data": df.to_dict(orient="records"),
            "columns": df.columns.tolist(),
            "row_count": len(df),
            "sql": query
        }
    except Exception as e:
        return {"success": False, "error": str(e), "sql": query}
