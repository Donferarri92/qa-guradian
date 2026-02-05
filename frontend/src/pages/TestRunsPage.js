import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircle, RefreshCw, XCircle, Clock, Play,
  ExternalLink, Download, AlertTriangle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const TestRunsPage = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      const res = await axios.get(`${API}/runs`);
      setRuns(res.data);
    } catch (e) {
      console.error('Failed to load runs:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  return (
    <div className="runs-page" data-testid="runs-page">
      <div className="page-header">
        <h1>Test Runs</h1>
        <p>View all automated test executions</p>
      </div>

      {runs.length > 0 ? (
        <div className="runs-table">
          <div className="table-header">
            <span>Status</span>
            <span>Type</span>
            <span>Environment</span>
            <span>Results</span>
            <span>Date</span>
            <span>Actions</span>
          </div>
          {runs.map((run) => (
            <div key={run.id} className="table-row">
              <span className={`status-badge ${run.status}`}>
                {run.status === 'completed' ? <CheckCircle size={14} /> : 
                 run.status === 'running' ? <RefreshCw className="spin" size={14} /> :
                 run.status === 'failed' ? <XCircle size={14} /> : <Clock size={14} />}
                {run.status}
              </span>
              <span className="type-badge">{run.suite_type}</span>
              <span className="env-url">{run.environment_url}</span>
              <span className="results">
                {run.summary?.total ? (
                  <>
                    <span className="passed">{run.summary.passed} ✓</span>
                    <span className="failed">{run.summary.failed} ✗</span>
                    <span className="warnings">{run.summary.warnings} ⚠</span>
                  </>
                ) : '-'}
              </span>
              <span className="date">{new Date(run.started_at).toLocaleString()}</span>
              <span className="actions">
                <Link to={`/dashboard/runs/${run.id}`} className="btn-icon" title="View details">
                  <ExternalLink size={16} />
                </Link>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Play size={48} />
          <p>No test runs yet</p>
          <Link to="/dashboard" className="btn-primary">Run your first test</Link>
        </div>
      )}
    </div>
  );
};

export const RunDetailPage = () => {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const { runId } = useParams();

  useEffect(() => {
    fetchRun();
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  const fetchRun = async () => {
    try {
      const res = await axios.get(`${API}/runs/${runId}`);
      setRun(res.data);
    } catch (e) {
      console.error('Failed to load run:', e);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    window.open(`${API}/reports/${runId}/pdf`, '_blank');
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  if (!run) {
    return <div className="error-state">Run not found</div>;
  }

  return (
    <div className="run-detail-page" data-testid="run-detail-page">
      <div className="page-header">
        <div>
          <h1>{run.suite_type.charAt(0).toUpperCase() + run.suite_type.slice(1)} Test Run</h1>
          <p>{run.environment_url}</p>
        </div>
        {run.status === 'completed' && (
          <button className="btn-primary" onClick={downloadPdf} data-testid="download-pdf">
            <Download size={18} /> Download PDF
          </button>
        )}
      </div>

      <div className={`status-banner ${run.status}`}>
        {run.status === 'running' && (
          <>
            <RefreshCw className="spin" size={24} />
            <span>Tests are running... This may take a minute.</span>
          </>
        )}
        {run.status === 'completed' && (
          <>
            <CheckCircle size={24} />
            <span>Test run completed</span>
          </>
        )}
        {run.status === 'failed' && (
          <>
            <XCircle size={24} />
            <span>Test run failed: {run.summary?.error || 'Unknown error'}</span>
          </>
        )}
      </div>

      {run.summary?.total && (
        <div className="summary-cards">
          <div className="summary-card total">
            <span className="value">{run.summary.total}</span>
            <span className="label">Total Tests</span>
          </div>
          <div className="summary-card passed">
            <span className="value">{run.summary.passed}</span>
            <span className="label">Passed</span>
          </div>
          <div className="summary-card failed">
            <span className="value">{run.summary.failed}</span>
            <span className="label">Failed</span>
          </div>
          <div className="summary-card warnings">
            <span className="value">{run.summary.warnings}</span>
            <span className="label">Warnings</span>
          </div>
          <div className="summary-card rate">
            <span className="value">{run.summary.pass_rate}%</span>
            <span className="label">Pass Rate</span>
          </div>
        </div>
      )}

      {run.results?.length > 0 && (
        <div className="results-section">
          <h2>Test Results</h2>
          <div className="results-list">
            {run.results.map((result, idx) => (
              <div key={idx} className={`result-item ${result.status}`}>
                <div className="result-header">
                  <span className="result-status">
                    {result.status === 'passed' ? <CheckCircle size={18} /> :
                     result.status === 'failed' ? <XCircle size={18} /> :
                     <AlertTriangle size={18} />}
                  </span>
                  <span className="result-name">{result.test_name}</span>
                  <span className="result-duration">{result.duration_ms}ms</span>
                </div>
                <p className="result-message">{result.message}</p>
                {result.details && Object.keys(result.details).length > 0 && (
                  <details className="result-details">
                    <summary>View Details</summary>
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
