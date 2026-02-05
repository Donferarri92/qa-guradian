import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Activity, CheckCircle, RefreshCw, XCircle, Clock,
  ChevronRight, Play, Shield, AlertTriangle, Zap, Calendar, BarChart3
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, envRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/environments`)
      ]);
      setStats(statsRes.data);
      setEnvironments(envRes.data);
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const runTests = async (suiteType) => {
    if (environments.length === 0) {
      alert('Please add a test environment first');
      return;
    }
    
    setRunningTest(suiteType);
    try {
      const res = await axios.post(`${API}/runs`, {
        environment_id: environments[0].id,
        suite_type: suiteType
      });
      navigate(`/dashboard/runs/${res.data.id}`);
    } catch (e) {
      console.error('Failed to start run:', e);
      alert('Failed to start test run');
    } finally {
      setRunningTest(null);
    }
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Monitor your QA tests and track quality metrics</p>
      </div>

      <div className="quick-actions">
        <button 
          className="action-card daily"
          onClick={() => runTests('daily')}
          disabled={runningTest}
          data-testid="run-daily-btn"
        >
          <div className="action-icon"><Zap size={24} /></div>
          <div className="action-content">
            <h3>Run Daily Regression</h3>
            <p>10 critical tests for homepage, navigation, and basic functionality</p>
          </div>
          {runningTest === 'daily' && <RefreshCw className="spin" size={20} />}
        </button>
        
        <button 
          className="action-card weekly"
          onClick={() => runTests('weekly')}
          disabled={runningTest}
          data-testid="run-weekly-btn"
        >
          <div className="action-icon"><Calendar size={24} /></div>
          <div className="action-content">
            <h3>Run Weekly Deep Dive</h3>
            <p>20 comprehensive tests including SEO, security, and performance</p>
          </div>
          {runningTest === 'weekly' && <RefreshCw className="spin" size={20} />}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Activity size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.total_runs || 0}</span>
            <span className="stat-label">Total Runs</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><CheckCircle size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.completed_runs || 0}</span>
            <span className="stat-label">Completed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><AlertTriangle size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{stats?.avg_pass_rate || 0}%</span>
            <span className="stat-label">Avg Pass Rate</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info"><Shield size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{environments.length}</span>
            <span className="stat-label">Environments</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Recent Test Runs</h2>
          <Link to="/dashboard/runs" className="view-all">View all <ChevronRight size={16} /></Link>
        </div>
        
        {stats?.recent_runs?.length > 0 ? (
          <div className="runs-list">
            {stats.recent_runs.map((run) => (
              <Link to={`/dashboard/runs/${run.id}`} key={run.id} className="run-item">
                <div className="run-info">
                  <span className={`run-status ${run.status}`}>
                    {run.status === 'completed' ? <CheckCircle size={16} /> : 
                     run.status === 'running' ? <RefreshCw className="spin" size={16} /> :
                     run.status === 'failed' ? <XCircle size={16} /> : <Clock size={16} />}
                  </span>
                  <span className="run-type">{run.suite_type} tests</span>
                  <span className="run-url">{run.environment_url}</span>
                </div>
                <div className="run-meta">
                  {run.summary?.pass_rate !== undefined && (
                    <span className="pass-rate">{run.summary.pass_rate}% passed</span>
                  )}
                  <span className="run-date">{new Date(run.started_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Play size={48} />
            <p>No test runs yet. Start your first test!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
