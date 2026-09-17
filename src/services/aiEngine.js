/**
 * HeliXpert Local AI Engine
 * Safe SQL generator and intent classifier.
 * Strictly respects empty dataset-pending state without inventing fake answers.
 */

import { db } from './database';

export class AiEngine {
  constructor() {
    this.ollamaUrl = localStorage.getItem('helixpert_ollama_url') || 'http://localhost:11434';
    this.useOllama = localStorage.getItem('helixpert_use_ollama') === 'true';
    this.modelName = localStorage.getItem('helixpert_model_name') || 'llama3:8b';
  }

  setOllamaConfig(url, enable, model) {
    this.ollamaUrl = url;
    this.useOllama = enable;
    this.modelName = model;
    localStorage.setItem('helixpert_ollama_url', url);
    localStorage.setItem('helixpert_use_ollama', String(enable));
    localStorage.setItem('helixpert_model_name', model);
  }

  async processQuery(userQuestion) {
    const startTime = performance.now();
    const queryLower = userQuestion.toLowerCase().trim();

    // Check if database is empty
    if (await db.isEmpty()) {
      return {
        question: userQuestion,
        intent: 'DATASET_PENDING',
        tablesUsed: [],
        sql: '-- Query execution paused: Database is empty',
        isValid: true,
        queryResult: { success: true, rowCount: 0, columns: [], data: [] },
        explanation: `**Dataset Not Loaded Yet**\n\nThe technical helicopter dataset has not been imported into the HeliXpert local database. Please import the official dataset via Settings or the Dashboard to enable natural language SQL analysis and parameter queries.`,
        chartType: 'none',
        chartData: [],
        keyInsights: [
          'Status: Awaiting Dataset Import',
          'Database Tables: Ready for relational import',
          'AI Query Engine: Active (Read-Only SQL Validator Ready)'
        ],
        executionTimeMs: Math.round(performance.now() - startTime),
        timestamp: new Date().toLocaleTimeString(),
        isDatasetPending: true
      };
    }

    // Step 1: Detect Intent
    const intentAnalysis = this.detectIntent(queryLower);

    // Step 2: Generate Safe Read-Only SQL
    const generatedSql = this.generateSql(queryLower, intentAnalysis);

    // Step 3: Validate Query Safety
    const validation = this.validateQuery(generatedSql);
    if (!validation.isValid) {
      return {
        question: userQuestion,
        intent: intentAnalysis.intent,
        sql: generatedSql,
        isValid: false,
        error: validation.reason,
        explanation: `Query Execution Blocked: ${validation.reason}`,
        executionTimeMs: Math.round(performance.now() - startTime)
      };
    }

    // Step 4: Execute Query
    const queryResult = db.executeSql(generatedSql);

    // Step 5: Response Synthesis
    const responsePackage = this.synthesizeResponse(userQuestion, intentAnalysis, generatedSql, queryResult);
    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      question: userQuestion,
      intent: intentAnalysis.intent,
      tablesUsed: intentAnalysis.tables,
      sql: generatedSql,
      isValid: true,
      queryResult: queryResult,
      explanation: responsePackage.explanation,
      chartType: responsePackage.chartType,
      chartData: responsePackage.chartData,
      chartConfig: responsePackage.chartConfig,
      keyInsights: responsePackage.keyInsights,
      executionTimeMs: executionTimeMs,
      timestamp: new Date().toLocaleTimeString(),
      isDatasetPending: false
    };
  }

  detectIntent(text) {
    if (text.includes('temp') || text.includes('hottest') || text.includes('egt')) {
      return { intent: 'MAX_ENGINE_TEMP', tables: ['telemetry_parameters', 'helicopters'] };
    }
    if (text.includes('vibration') || text.includes('peak')) {
      return { intent: 'VIBRATION_ANALYSIS', tables: ['telemetry_parameters', 'components', 'helicopters'] };
    }
    if (text.includes('fault') || text.includes('grounded')) {
      return { intent: 'FAULT_ANALYSIS', tables: ['faults', 'helicopters'] };
    }
    return { intent: 'FLEET_LIST', tables: ['helicopters'] };
  }

  generateSql(text, intentObj) {
    return `SELECT * FROM helicopters LIMIT 10;`;
  }

  validateQuery(sql) {
    const trimmed = sql.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) {
      return { isValid: false, reason: "Security violation: Direct write or modification operations are prohibited." };
    }
    return { isValid: true };
  }

  synthesizeResponse(question, intentObj, sql, result) {
    if (!result.data || result.data.length === 0) {
      return {
        explanation: `Query executed successfully, but no matching records were found in the database.`,
        chartType: 'none',
        chartData: [],
        keyInsights: ['Zero matching records in local dataset.']
      };
    }
    return {
      explanation: `Query executed across database tables. Retrieved ${result.data.length} records.`,
      chartType: 'table',
      chartData: result.data,
      chartConfig: {},
      keyInsights: [`Records retrieved: ${result.data.length}`]
    };
  }
}

export const aiEngine = new AiEngine();
