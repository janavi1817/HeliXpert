# -*- coding: utf-8 -*-
"""
HeliXpert Dynamic Query Engine
Parses natural language questions into SQL queries dynamically.
No hardcoded answers - all results come from the dataset.
"""
import re
import sqlite3
import logging
from typing import Dict, List, Optional, Any
from backend.ai.sql_agent import execute_safe_sql

class DynamicQueryEngine:
    """
    Dynamic query engine that parses natural language questions into SQL queries.
    Supports: COUNT, LIST, AVERAGE, MAX, MIN, FILTER, GROUP_BY, DESCRIBE operations.
    """
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        
        # Entity mapping - maps keywords to database tables
        self.entity_map = {
            'helicopters': {
                'keywords': ['helicopter', 'aircraft', 'model', 'fleet', 'हेलीकॉप्टर', 'विमान', 'ಹೆಲಿಕಾಪ್ಟರ್', 'ವಿಮಾನ'],
                'table': 'helicopters',
                'columns': ['model', 'manufacturer', 'variant', 'helicopter_type', 'country']
            },
            'components': {
                'keywords': ['component', 'part', 'rotor', 'engine', 'transmission', 'gear', 'घटक', 'भाग', 'ಘಟಕ', 'ಭಾಗ'],
                'table': 'components',
                'columns': ['component_type', 'component_name', 'description']
            },
            'sensors': {
                'keywords': ['sensor', 'mgt', 'temperature', 'torque', 'oat', 'ng', 'np', 'faulty', 'observation', 'सेंसर', 'तापमान', 'ಸೆನ್ಸರ್', 'ತಾಪಮಾನ'],
                'table': 'sensor_parameters',
                'columns': ['id', 'mgt', 'oat', 'trq_measured', 'trq_margin', 'ng', 'np', 'faulty']
            },
            'maintenance': {
                'keywords': ['maintenance', 'repair', 'logbook', 'problem', 'action', 'रखरखाव', 'मरम्मत', 'ನಿರ್ವಹಣೆ', 'ದುರಸ್ತಿ'],
                'table': 'maintenance_records',
                'columns': ['IDENT', 'PROBLEM', 'PROBLEM_TYPE', 'LOCATION', 'ACTION']
            }
        }
        
        # Operation detection patterns
        self.operation_patterns = {
            'COUNT': ['how many', 'count', 'number of', 'total', 'कितने', 'संख्या', 'ಎಷ್ಟು', 'ಸಂಖ್ಯೆ'],
            'LIST': ['list', 'show', 'display', 'what are', 'give me', 'सूची', 'दिखाओ', 'ಪಟ್ಟಿ', 'ತೋರಿಸಿ'],
            'AVERAGE': ['average', 'avg', 'mean', 'औसत', 'माध्य', 'ಸರಾಸರಿ'],
            'MAX': ['maximum', 'max', 'highest', 'top', 'peak', 'अधिकतम', 'सबसे', 'ಗರಿಷ್ಠ', 'ಅತಿ'],
            'MIN': ['minimum', 'min', 'lowest', 'bottom', 'न्यूनतम', 'कम', 'ಕನಿಷ್ಠ', 'ಕಡಿಮೆ'],
            'GROUP_BY': ['by category', 'by type', 'each', 'per', 'group', 'प्रकार से', 'श्रेणी', 'ಪ್ರಕಾರ', 'ವರ್ಗ'],
            'DESCRIBE': ['description', 'what is', 'tell me about', 'describe', 'विवरण', 'बताओ', 'ವಿವರಣೆ', 'ಹೇಳಿ']
        }
        
        # Field-specific patterns for components
        self.component_type_patterns = {
            'Rotor System': ['rotor', 'main rotor', 'tail rotor', 'रोटर', 'ರೋಟರ್'],
            'Propulsion': ['propulsion', 'engine', 'turboshaft', 'प्रणोदन', 'इंजन', 'ಪ್ರೊಪಲ್ಷನ್', 'ಎಂಜಿನ್'],
            'Transmission': ['transmission', 'gearbox', 'ट्रांसमिशन', 'गियर', 'ಟ್ರಾನ್ಸ್‌ಮಿಷನ್'],
            'Fuel System': ['fuel', 'ईंधन', 'ಇಂಧನ'],
            'Hydraulic System': ['hydraulic', 'हाइड्रोलिक', 'ಹೈಡ್ರಾಲಿಕ್'],
            'Avionics': ['avionics', 'electronics', 'एवियोनिक्स', 'ಏವಿಯಾನಿಕ್ಸ್'],
            'Airframe': ['airframe', 'fuselage', 'एयरफ्रेम', 'ಏರ್‌ಫ್ರೇಮ್']
        }
        
        # Sensor metric mapping
        self.sensor_metrics = {
            'mgt': ['mgt', 'temperature', 'hot', 'एमजीटी', 'तापमान', 'इंजन तापमान', 'ಎಂಜಿಟಿ', 'ತಾಪಮಾನ'],
            'oat': ['oat', 'outside air', 'ambient', 'बाहरी तापमान', 'वातावरण', 'ಹೊರಗಿನ ತಾಪಮಾನ'],
            'trq_measured': ['torque', 'trq', 'टॉर्क', 'ಟಾರ್ಕ್'],
            'ng': ['ng', 'gas generator', 'compressor', 'गैस जनरेटर', 'ಗ್ಯಾಸ್ ಜನರೇಟರ್'],
            'np': ['np', 'power turbine', 'turbine speed', 'पावर टर्बाइन', 'ಪವರ್ ಟರ್ಬೈನ್']
        }
    
    def _normalize_query(self, question: str) -> str:
        """Normalize query for easier pattern matching."""
        return question.lower().strip()
    
    def _detect_operation(self, query: str) -> str:
        """Detect the operation type from the query."""
        for operation, patterns in self.operation_patterns.items():
            for pattern in patterns:
                if pattern in query:
                    # GROUP_BY should be checked specifically
                    if operation == 'GROUP_BY':
                        # Only return GROUP_BY if not a simple count
                        if not any(p in query for p in self.operation_patterns['COUNT']):
                            continue
                    return operation
        
        # Default to LIST if no specific operation detected
        return 'LIST'
    
    def _detect_entity(self, query: str) -> Optional[Dict[str, Any]]:
        """Detect which entity (table) the query is about."""
        # Priority order: check more specific keywords first
        for entity_name, entity_info in self.entity_map.items():
            for keyword in entity_info['keywords']:
                if keyword in query:
                    return {
                        'name': entity_name,
                        'table': entity_info['table'],
                        'columns': entity_info['columns']
                    }
        return None
    
    def _extract_filters(self, query: str, entity_name: str) -> List[Dict[str, str]]:
        """Extract filter conditions from the query."""
        filters = []
        
        # Component type filtering
        if entity_name == 'components':
            for component_type, patterns in self.component_type_patterns.items():
                for pattern in patterns:
                    if pattern in query:
                        filters.append({
                            'field': 'component_type',
                            'operator': 'LIKE',
                            'value': f'%{component_type}%'
                        })
                        break
                if filters:
                    break
        
        # Sensor metric filtering
        if entity_name == 'sensors':
            # Check for faulty condition
            if any(term in query for term in ['fault', 'faulty', 'खराब', 'दोष', 'ದೋಷ']):
                filters.append({
                    'field': 'faulty',
                    'operator': '=',
                    'value': '1'
                })
        
        # Manufacturer filtering for helicopters
        if entity_name == 'helicopters':
            manufacturers = ['airbus', 'boeing', 'sikorsky', 'bell', 'eurocopter', 'एयरबस', 'ಏರ್‌ಬಸ್']
            for mfr in manufacturers:
                if mfr in query:
                    filters.append({
                        'field': 'manufacturer',
                        'operator': 'LIKE',
                        'value': f'%{mfr}%'
                    })
                    break
        
        return filters
    
    def _detect_metric(self, query: str) -> Optional[str]:
        """Detect which sensor metric to query."""
        for metric, patterns in self.sensor_metrics.items():
            for pattern in patterns:
                if pattern in query:
                    return metric
        return None
    
    def _detect_group_by(self, query: str, entity: Dict[str, Any]) -> Optional[str]:
        """Detect if query requires GROUP BY and which field."""
        query_lower = query
        
        if entity['name'] == 'components':
            if any(term in query_lower for term in ['category', 'type', 'each', 'per', 'group', 'प्रकार', 'श्रेणी', 'ಪ್ರಕಾರ']):
                return 'component_type'
        
        if entity['name'] == 'sensors':
            if any(term in query_lower for term in ['faulty', 'fault status', 'दोष', 'ದೋಷ']):
                return 'faulty'
        
        if entity['name'] == 'helicopters':
            if any(term in query_lower for term in ['manufacturer', 'maker', 'निर्माता', 'ತಯಾರಕ']):
                return 'manufacturer'
            if any(term in query_lower for term in ['type', 'category', 'प्रकार', 'ಪ್ರಕಾರ']):
                return 'helicopter_type'
        
        return None
    
    def parse_query(self, question: str) -> Dict[str, Any]:
        """
        Parse a natural language question into structured query components.
        
        Returns:
            dict: {
                "operation": "COUNT|LIST|AVERAGE|MAX|MIN|GROUP_BY|DESCRIBE",
                "entity": {...},
                "filters": [{"field": "...", "operator": "...", "value": "..."}],
                "metric": "mgt|oat|trq_measured|ng|np",  # for sensor queries
                "group_by": "field_name"  # if applicable
            }
        """
        query = self._normalize_query(question)
        
        # Detect entity first
        entity = self._detect_entity(query)
        if not entity:
            return {
                'operation': 'UNKNOWN',
                'entity': None,
                'filters': [],
                'metric': None,
                'group_by': None,
                'error': 'Could not identify the subject of your query'
            }
        
        # Detect operation
        operation = self._detect_operation(query)
        
        # Extract filters
        filters = self._extract_filters(query, entity['name'])
        
        # Detect metric (for sensor queries)
        metric = self._detect_metric(query) if entity['name'] == 'sensors' else None
        
        # Detect GROUP BY
        group_by = self._detect_group_by(query, entity)
        
        # If GROUP BY detected, override operation
        if group_by and operation == 'COUNT':
            operation = 'GROUP_BY'
        
        return {
            'operation': operation,
            'entity': entity,
            'filters': filters,
            'metric': metric,
            'group_by': group_by
        }
    
    def generate_sql(self, parsed_query: Dict[str, Any]) -> str:
        """
        Generate SQL query from parsed query structure.
        
        Critical: Filters MUST be applied BEFORE aggregation operations.
        """
        operation = parsed_query['operation']
        entity = parsed_query['entity']
        filters = parsed_query.get('filters', [])
        metric = parsed_query.get('metric')
        group_by = parsed_query.get('group_by')
        
        if not entity:
            raise ValueError("No entity detected")
        
        table = entity['table']
        columns = entity['columns']
        
        # Build WHERE clause first (applied BEFORE aggregation)
        where_clauses = []
        for f in filters:
            if f['operator'] == 'LIKE':
                where_clauses.append(f"{f['field']} LIKE '{f['value']}'")
            else:
                where_clauses.append(f"{f['field']} {f['operator']} {f['value']}")
        
        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        # Generate SELECT based on operation
        if operation == 'COUNT':
            sql = f"SELECT COUNT(*) AS total FROM {table} {where_sql}"
        
        elif operation == 'GROUP_BY':
            if not group_by:
                # Fallback to simple count
                sql = f"SELECT COUNT(*) AS total FROM {table} {where_sql}"
            else:
                sql = f"SELECT {group_by}, COUNT(*) AS count FROM {table} {where_sql} GROUP BY {group_by}"
        
        elif operation == 'LIST':
            column_list = ', '.join(columns)
            sql = f"SELECT {column_list} FROM {table} {where_sql} LIMIT 20"
        
        elif operation == 'AVERAGE':
            if metric:
                sql = f"SELECT ROUND(AVG({metric}), 2) AS average, ROUND(MIN({metric}), 2) AS minimum, ROUND(MAX({metric}), 2) AS maximum FROM {table} {where_sql}"
            else:
                # Can't average without a metric
                sql = f"SELECT * FROM {table} {where_sql} LIMIT 20"
        
        elif operation == 'MAX':
            if metric:
                sql = f"SELECT * FROM {table} {where_sql} ORDER BY {metric} DESC LIMIT 10"
            else:
                sql = f"SELECT * FROM {table} {where_sql} LIMIT 10"
        
        elif operation == 'MIN':
            if metric:
                sql = f"SELECT * FROM {table} {where_sql} ORDER BY {metric} ASC LIMIT 10"
            else:
                sql = f"SELECT * FROM {table} {where_sql} LIMIT 10"
        
        elif operation == 'DESCRIBE':
            # For description queries, filter and return specific fields
            if entity['name'] == 'components':
                sql = f"SELECT component_name, description FROM {table} {where_sql} LIMIT 10"
            else:
                column_list = ', '.join(columns)
                sql = f"SELECT {column_list} FROM {table} {where_sql} LIMIT 10"
        
        else:
            # Default to LIST
            column_list = ', '.join(columns)
            sql = f"SELECT {column_list} FROM {table} {where_sql} LIMIT 20"
        
        return sql
    
    def _generate_explanation(self, parsed_query: Dict[str, Any], data: List[Dict], language: str = 'en') -> str:
        """Generate natural language explanation of the results."""
        operation = parsed_query['operation']
        entity = parsed_query['entity']
        filters = parsed_query.get('filters', [])
        
        if not data:
            if language == 'hi':
                return 'इस प्रश्न के लिए कोई मिलान रिकॉर्ड नहीं मिला।'
            elif language == 'kn':
                return 'ಈ ಪ್ರಶ್ನೆಗೆ ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿಲ್ಲ.'
            else:
                return 'No matching records found for this query.'
        
        # Determine what was filtered
        filter_desc = ""
        if filters:
            filter_parts = []
            for f in filters:
                if f['field'] == 'component_type':
                    # Extract component type from LIKE value
                    comp_type = f['value'].replace('%', '')
                    filter_parts.append(f"{comp_type}")
                elif f['field'] == 'faulty' and f['value'] == '1':
                    filter_parts.append("faulty" if language == 'en' else "दोषपूर्ण" if language == 'hi' else "ದೋಷಪೂರಿತ")
                elif f['field'] == 'manufacturer':
                    mfr = f['value'].replace('%', '')
                    filter_parts.append(mfr)
            
            if filter_parts:
                filter_desc = " ".join(filter_parts) + " "
        
        entity_name = entity['name']
        entity_label = {
            'en': {'components': 'components', 'helicopters': 'helicopters', 'sensors': 'sensor observations', 'maintenance': 'maintenance records'},
            'hi': {'components': 'घटक', 'helicopters': 'हेलीकॉप्टर', 'sensors': 'सेंसर अवलोकन', 'maintenance': 'रखरखाव रिकॉर्ड'},
            'kn': {'components': 'ಘಟಕಗಳು', 'helicopters': 'ಹೆಲಿಕಾಪ್ಟರ್‌ಗಳು', 'sensors': 'ಸೆನ್ಸರ್ ಅವಲೋಕನಗಳು', 'maintenance': 'ನಿರ್ವಹಣೆ ದಾಖಲೆಗಳು'}
        }.get(language, {}).get(entity_name, entity_name)
        
        if operation == 'COUNT':
            count = data[0].get('total', 0)
            if language == 'hi':
                return f"डेटाबेस में **{count} {filter_desc}{entity_label}** हैं।"
            elif language == 'kn':
                return f"ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ **{count} {filter_desc}{entity_label}** ಇವೆ."
            else:
                return f"There are **{count} {filter_desc}{entity_label}** in the database."
        
        elif operation == 'GROUP_BY':
            if language == 'hi':
                return f"**श्रेणी द्वारा {filter_desc}{entity_label} की गणना:**"
            elif language == 'kn':
                return f"**ವರ್ಗದ ಮೂಲಕ {filter_desc}{entity_label} ಎಣಿಕೆ:**"
            else:
                return f"**Count of {filter_desc}{entity_label} by category:**"
        
        elif operation == 'AVERAGE':
            row = data[0]
            metric = parsed_query.get('metric', 'value')
            if language == 'hi':
                return f"{filter_desc}{entity_label} के लिए: औसत {metric.upper()} **{row.get('average')}** (न्यूनतम: {row.get('minimum')}, अधिकतम: {row.get('maximum')})।"
            elif language == 'kn':
                return f"{filter_desc}{entity_label} ಗೆ: ಸರಾಸರಿ {metric.upper()} **{row.get('average')}** (ಕನಿಷ್ಠ: {row.get('minimum')}, ಗರಿಷ್ಠ: {row.get('maximum')})."
            else:
                return f"For {filter_desc}{entity_label}: Average {metric.upper()} is **{row.get('average')}** (min: {row.get('minimum')}, max: {row.get('maximum')})."
        
        elif operation == 'LIST' or operation == 'DESCRIBE':
            if language == 'hi':
                return f"**{len(data)} {filter_desc}{entity_label}** मिले हैं।"
            elif language == 'kn':
                return f"**{len(data)} {filter_desc}{entity_label}** ಕಂಡುಬಂದಿವೆ."
            else:
                return f"Found **{len(data)} {filter_desc}{entity_label}**."
        
        elif operation in ['MAX', 'MIN']:
            op_label = 'highest' if operation == 'MAX' else 'lowest'
            if language == 'hi':
                op_label = 'उच्चतम' if operation == 'MAX' else 'निम्नतम'
            elif language == 'kn':
                op_label = 'ಅತ್ಯಧಿಕ' if operation == 'MAX' else 'ಕನಿಷ್ಠ'
            
            metric = parsed_query.get('metric', 'value')
            if language == 'hi':
                return f"{filter_desc}{entity_label} के लिए {op_label} {metric.upper()} मान दिखा रहे हैं।"
            elif language == 'kn':
                return f"{filter_desc}{entity_label} ಗೆ {op_label} {metric.upper()} ಮೌಲ್ಯಗಳನ್ನು ತೋರಿಸಲಾಗುತ್ತಿದೆ."
            else:
                return f"Showing {op_label} {metric.upper()} values for {filter_desc}{entity_label}."
        
        # Default
        if language == 'hi':
            return f"**{len(data)} {filter_desc}{entity_label}** के रिकॉर्ड मिले हैं।"
        elif language == 'kn':
            return f"**{len(data)} {filter_desc}{entity_label}** ದಾಖಲೆಗಳು ಕಂಡುಬಂದಿವೆ."
        else:
            return f"Found **{len(data)} {filter_desc}{entity_label}** records."
    
    def execute_query(self, question: str, language: str = 'en') -> Dict[str, Any]:
        """
        Full pipeline: parse question → generate SQL → execute → explain.
        
        Args:
            question: Natural language question
            language: Response language ('en', 'hi', 'kn')
        
        Returns:
            dict: {
                "question": str,
                "intent": str,
                "sql": str,
                "isValid": bool,
                "queryResult": dict,
                "explanation": str,
                "chartType": str,
                "chartData": list,
                "parsed_query": dict  # for debugging
            }
        """
        try:
            # Parse the question
            parsed = self.parse_query(question)
            
            if parsed.get('error'):
                return {
                    "question": question,
                    "intent": "UNKNOWN",
                    "sql": None,
                    "isValid": False,
                    "queryResult": None,
                    "explanation": parsed['error'],
                    "chartType": "none",
                    "chartData": [],
                    "parsed_query": parsed
                }
            
            # Generate SQL
            sql = self.generate_sql(parsed)
            
            # Execute SQL
            result = execute_safe_sql(sql)
            
            if not result.get('success'):
                return {
                    "question": question,
                    "intent": parsed['operation'],
                    "sql": sql,
                    "isValid": False,
                    "queryResult": result,
                    "explanation": f"Query execution failed: {result.get('error')}",
                    "chartType": "none",
                    "chartData": [],
                    "parsed_query": parsed
                }
            
            data = result.get('data', [])
            
            # Generate explanation
            explanation = self._generate_explanation(parsed, data, language)
            
            # Determine chart type
            chart_type = "none"
            if parsed['operation'] == 'GROUP_BY':
                chart_type = "bar"
            elif parsed['operation'] in ['LIST', 'MAX', 'MIN', 'DESCRIBE']:
                chart_type = "table"
            elif parsed['operation'] == 'AVERAGE':
                chart_type = "none"
            
            return {
                "question": question,
                "intent": parsed['operation'],
                "sql": sql,
                "isValid": True,
                "queryResult": result,
                "explanation": explanation,
                "chartType": chart_type,
                "chartData": data,
                "parsed_query": parsed,
                "source": "dynamic_query_engine"
            }
            
        except Exception as e:
            logging.error(f"Dynamic query execution error: {e}", exc_info=True)
            return {
                "question": question,
                "intent": "ERROR",
                "sql": None,
                "isValid": False,
                "queryResult": None,
                "explanation": f"An error occurred while processing your query: {str(e)}",
                "chartType": "none",
                "chartData": [],
                "parsed_query": None
            }
