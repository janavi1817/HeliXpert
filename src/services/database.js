/**
 * HeliXpert API Client Service
 * Replaces the local offline database with calls to the FastAPI backend.
 */

const API_BASE = 'http://localhost:8000/api';

class ApiDatabase {
  
  async request(endpoint, options = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("API Request failed:", err);
      return null;
    }
  }

  async isEmpty() {
    const stats = await this.getDashboardStats();
    return !stats || stats.totalHelicopters === 0;
  }

  async getHelicopters() {
    const data = await this.request('/helicopters');
    return data || [];
  }

  async getHelicopterById(id) {
    const data = await this.request(`/helicopters/${id}`);
    return data;
  }

  async getComponents() {
    const data = await this.request('/components');
    return data || [];
  }

  async getTelemetry() {
    const data = await this.request('/telemetry/trends');
    return data || [];
  }
  
  async getTelemetrySummary() {
    const data = await this.request('/telemetry/summary');
    return data || {};
  }

  async getMaintenance() {
    // For now we return empty or search based
    return [];
  }
  
  async searchMaintenance(query) {
    if (!query) return [];
    const data = await this.request(`/maintenance/search?q=${encodeURIComponent(query)}`);
    return data || [];
  }

  async getDashboardStats() {
    const stats = await this.request('/dashboard/stats');
    if (!stats) return { isEmpty: true, totalHelicopters: 0 };
    return {
      totalHelicopters: stats.helicopters || 0,
      operationalCount: stats.helicopters || 0, // Placeholder
      readinessRate: 100, // Placeholder
      activeFaultsCount: 0,
      groundedCount: 0,
      avgEngineTempC: 750, // Placeholder
      isEmpty: stats.helicopters === 0
    };
  }
  
  async getDatasetStatus() {
    return await this.request('/datasets');
  }

  async importDataset() {
    const res = await this.request('/datasets/import', { method: 'POST' });
    return res;
  }

  // Not implemented fully in API yet but kept to avoid breaking components
  async getFaults() { return []; }
  async getTechnicalDocs() { return []; }
  
  // Safe SQL Engine wrapper (Deprecated for backend usage in some places)
  async executeSql(queryStr) {
    // For now returning mock empty
    return {
      success: false,
      error: "ExecuteSQL deprecated. Use AI Analyst Backend API directly.",
      query: queryStr
    };
  }
}

export const db = new ApiDatabase();
