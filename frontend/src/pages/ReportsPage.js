import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Download, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API}/reports`);
      setReports(res.data);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = (runId) => {
    window.open(`${API}/reports/${runId}/pdf`, '_blank');
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  return (
    <div className="reports-page" data-testid="reports-page">
      <div className="page-header">
        <h1>Reports</h1>
        <p>Download and view test reports</p>
      </div>

      {reports.length > 0 ? (
        <div className="reports-grid">
          {reports.map((report) => (
            <div key={report.id} className="report-card">
              <div className="report-header">
                <FileText size={24} />
                <span className="report-type">{report.suite_type} Report</span>
              </div>
              <div className="report-meta">
                <span>{report.environment_url}</span>
                <span>{new Date(report.completed_at).toLocaleDateString()}</span>
              </div>
              <div className="report-stats">
                <span className="passed">{report.summary?.passed || 0} passed</span>
                <span className="failed">{report.summary?.failed || 0} failed</span>
                <span className="rate">{report.summary?.pass_rate || 0}%</span>
              </div>
              <button 
                className="download-btn" 
                onClick={() => downloadPdf(report.id)}
                data-testid={`download-${report.id}`}
              >
                <Download size={16} /> Download PDF
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={48} />
          <p>No reports generated yet</p>
          <p>Run some tests first!</p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
