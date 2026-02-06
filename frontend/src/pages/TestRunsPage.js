import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle, RefreshCw, XCircle, Clock, Play, ExternalLink, Download, AlertTriangle
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
      const res = await axios.get(`${API}/runs?t=${Date.now()}`);
      setRuns(res.data || []);
    } catch (e) {
      console.error('Failed to load runs:', e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle size={14} />;
    if (status === 'running') return <RefreshCw className="spin" size={14} />;
    if (status === 'failed') return <XCircle size={14} />;
    return <Clock size={14} />;
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
          {runs.map((run) => {
            const summary = run.summary || {};
            return (
              <div key={run.id} className="table-row">
                <span className={'status-badge ' + run.status}>
                  {getStatusIcon(run.status)}
                  {run.status}
                </span>
                <span className="type-badge">{run.suite_type}</span>
                <span className="env-url">{run.environment_url}</span>
                <span className="results">
                  {summary.total ? (
                    <React.Fragment>
                      <span className="passed">{summary.passed} ✓</span>
                      <span className="failed">{summary.failed} ✗</span>
                      <span className="warnings">{summary.warnings} ⚠</span>
                    </React.Fragment>
                  ) : '-'}
                </span>
                <span className="date">{new Date(run.started_at).toLocaleString()}</span>
                <span className="actions">
                  <Link to={'/dashboard/runs/' + run.id} className="btn-icon" title="View details">
                    <ExternalLink size={16} />
                  </Link>
                </span>
              </div>
            );
          })}
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
  const params = useParams();
  const runId = params.runId;

  useEffect(() => {
    fetchRun();
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  const fetchRun = async () => {
    try {
      const res = await axios.get(`${API}/runs/${runId}?t=${Date.now()}`);
      setRun(res.data);
    } catch (e) {
      console.error('Failed to load run:', e);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const token = localStorage.getItem('qa_token');
      console.log('PDF Download - Token:', token ? 'Present' : 'Missing');
      if (!token) {
        alert('Authentication Error: No login token found. Please logging in again.');
        return;
      }
      const response = await axios.get(`${API}/reports/${runId}/pdf?token=${token}`, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qa-report-${runId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Failed to download PDF', error);
      alert('Failed to download PDF: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getResultIcon = (status) => {
    if (status === 'passed') return <CheckCircle size={18} />;
    if (status === 'failed') return <XCircle size={18} />;
    return <AlertTriangle size={18} />;
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  if (!run) {
    return <div className="error-state">Run not found</div>;
  }

  const summary = run.summary || {};
  const results = run.results || [];
  const suiteTypeCap = run.suite_type.charAt(0).toUpperCase() + run.suite_type.slice(1);

  return (
    <div className="run-detail-page" data-testid="run-detail-page">
      <div className="page-header">
        <div>
          <h1>{suiteTypeCap} Test Run</h1>
          <p>{run.environment_url}</p>
        </div>
        {run.status === 'completed' && (
          <button className="btn-primary" onClick={downloadPdf} data-testid="download-pdf">
            <Download size={18} /> Download PDF
          </button>
        )}
      </div>

      <div className={'status-banner ' + run.status}>
        {run.status === 'running' && (
          <React.Fragment>
            <RefreshCw className="spin" size={24} />
            <span>Tests are running... This may take a minute.</span>
          </React.Fragment>
        )}
        {run.status === 'completed' && (
          <React.Fragment>
            <CheckCircle size={24} />
            <span>Test run completed</span>
          </React.Fragment>
        )}
        {run.status === 'failed' && (
          <React.Fragment>
            <XCircle size={24} />
            <span>Test run failed: {summary.error || 'Unknown error'}</span>
          </React.Fragment>
        )}
      </div>

      {summary.total && (
        <div className="summary-cards">
          <div className="summary-card total">
            <span className="value">{summary.total}</span>
            <span className="label">Total Tests</span>
          </div>
          <div className="summary-card passed">
            <span className="value">{summary.passed}</span>
            <span className="label">Passed</span>
          </div>
          <div className="summary-card failed">
            <span className="value">{summary.failed}</span>
            <span className="label">Failed</span>
          </div>
          <div className="summary-card warnings">
            <span className="value">{summary.warnings}</span>
            <span className="label">Warnings</span>
          </div>
          <div className="summary-card rate">
            <span className="value">{summary.pass_rate}%</span>
            <span className="label">Pass Rate</span>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="results-section">
          <h2>Test Results</h2>
          <div className="results-list">
            {results.map((result, idx) => (
              <div key={idx} className={'result-item ' + result.status}>
                <div className="result-header">
                  <span className="result-status">
                    {getResultIcon(result.status)}
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
