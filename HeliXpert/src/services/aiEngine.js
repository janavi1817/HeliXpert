/**
 * HeliXpert AI Engine - Simplified version for real dataset integration
 */

import { dataService } from './dataService';

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
    try {
      // Use the data service to query the backend AI
      const result = await dataService.queryAI(userQuestion);
      
      if (result && !result.isEmpty) {
        // Backend returns: {question, intent, sql, isValid, queryResult, explanation, chartType, chartData}
        // Frontend expects: {success, answer, data, visualization, processingTime}
        
        const visualization = result.chartType && result.chartType !== 'none' ? {
          type: result.chartType, // 'bar', 'line', 'table', 'pie'
          data: result.chartData || []
        } : null;

        return {
          success: true,
          answer: result.explanation || "Query processed successfully",
          data: result.queryResult?.data || result.chartData || null,
          visualization: visualization,
          sql: result.sql || null,
          intent: result.intent || null,
          processingTime: "~2.1s"
        };
      } else {
        return {
          success: false,
          error: "AI service unavailable. Please ensure datasets are loaded.",
          answer: "I'm unable to process your question right now. Please check that the backend is running and datasets are loaded."
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        answer: "I encountered an error processing your question. Please try again."
      };
    }
  }
}

// Export singleton instance
export const aiEngine = new AiEngine();