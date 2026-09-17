"""Quick test to verify the AI orchestrator works with real DB data."""
import sys
sys.path.insert(0, r'C:\Users\Janavipatel\OneDrive\Documents\HeliXpert')

from backend.ai.orchestrator import AiOrchestrator

orchestrator = AiOrchestrator()

test_queries = [
    "How many helicopters are in the database?",
    "Show all available helicopter models.",
    "What is the average MGT across all observations?",
    "How many observations are marked as faulty?",
]

for q in test_queries:
    print(f"\nQ: {q}")
    result = orchestrator.process_query(q)
    print(f"Intent: {result['intent']}")
    print(f"SQL: {result['sql']}")
    print(f"Explanation: {result['explanation'][:200]}")
    print(f"Rows: {result['queryResult']['row_count'] if result.get('queryResult') else 'N/A'}")
    print("-" * 60)
