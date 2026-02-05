import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, Play, FileText, CheckSquare, Settings, LogOut, 
  Menu, X, ChevronRight, Clock, AlertTriangle, CheckCircle,
  XCircle, Download, RefreshCw, Plus, Trash2, ExternalLink,
  BarChart3, Zap, Calendar, Activity
} from 'lucide-react';
import './App.css';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('qa_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch (e) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem('qa_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password });
    localStorage.setItem('qa_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('qa_token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login/Register Page
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(e.response?.data?.detail || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-testid="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <Shield className="auth-logo" size={48} />
          <h1>QA Guardian</h1>
          <p>Automated QA Testing Platform</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required={!isLogin}
                data-testid="name-input"
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              data-testid="email-input"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              data-testid="password-input"
            />
          </div>
          
          {error && <div className="auth-error">{error}</div>}
          
          <button type="submit" className="auth-button" disabled={loading} data-testid="auth-submit">
            {loading ? <RefreshCw className="spin" size={20} /> : (isLogin ? 'Sign in' : 'Create account')}
          </button>
        </form>
        
        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} data-testid="auth-toggle">
            {isLogin ? 'Register' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Sidebar Navigation
const Sidebar = ({ isOpen, setIsOpen }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/dashboard/runs', icon: Play, label: 'Test Runs' },
    { path: '/dashboard/checklists', icon: CheckSquare, label: 'Checklists' },
    { path: '/dashboard/reports', icon: FileText, label: 'Reports' },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Shield size={32} />
          <span>QA Guardian</span>
          <button className="sidebar-close" onClick={() => setIsOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
            <span>{user?.name || 'User'}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} data-testid="logout-btn">
            <LogOut size={20} />
          </button>
        </div>
      </aside>
    </>
  );
};

// Dashboard Page
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

      {/* Quick Actions */}
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

      {/* Stats Cards */}
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

      {/* Recent Runs */}
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

// Test Runs Page
const TestRunsPage = () => {
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

// Single Run Detail Page
const RunDetailPage = () => {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const runId = location.pathname.split('/').pop();

  useEffect(() => {
    fetchRun();
    const interval = setInterval(fetchRun, 3000);
    return () => clearInterval(interval);
  }, [runId]);

  const fetchRun = async () => {
    try {
      const res = await axios.get(`${API}/runs/${runId}`);
      setRun(res.data);
      if (res.data.status === 'completed' || res.data.status === 'failed') {
        // Stop polling when done
      }
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

      {/* Status Banner */}
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

      {/* Summary */}
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

      {/* Results */}
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

// Checklists Page
const ChecklistsPage = () => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('daily');

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const res = await axios.get(`${API}/checklists`);
      setChecklists(res.data);
    } catch (e) {
      console.error('Failed to load checklists:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (item) => {
    try {
      await axios.put(`${API}/checklists/${item.id}`, null, {
        params: { is_completed: !item.is_completed }
      });
      setChecklists(prev => prev.map(c => 
        c.id === item.id ? { ...c, is_completed: !c.is_completed } : c
      ));
    } catch (e) {
      console.error('Failed to update item:', e);
    }
  };

  const resetChecklist = async (type) => {
    try {
      await axios.post(`${API}/checklists/reset`, null, { params: { checklist_type: type } });
      fetchChecklists();
    } catch (e) {
      console.error('Failed to reset:', e);
    }
  };

  const filteredItems = checklists.filter(c => c.checklist_type === activeTab);
  const completedCount = filteredItems.filter(c => c.is_completed).length;
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  return (
    <div className="checklists-page" data-testid="checklists-page">
      <div className="page-header">
        <h1>Manual Checklists</h1>
        <p>Track manual QA testing tasks</p>
      </div>

      <div className="checklist-tabs">
        <button 
          className={activeTab === 'daily' ? 'active' : ''} 
          onClick={() => setActiveTab('daily')}
          data-testid="tab-daily"
        >
          Daily Regression
        </button>
        <button 
          className={activeTab === 'weekly' ? 'active' : ''} 
          onClick={() => setActiveTab('weekly')}
          data-testid="tab-weekly"
        >
          Weekly Deep Dive
        </button>
      </div>

      <div className="checklist-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(completedCount / filteredItems.length) * 100}%` }}
          />
        </div>
        <span>{completedCount} / {filteredItems.length} completed</span>
        <button className="reset-btn" onClick={() => resetChecklist(activeTab)} data-testid="reset-checklist">
          <RefreshCw size={16} /> Reset
        </button>
      </div>

      <div className="checklist-groups">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="checklist-group">
            <h3>{category}</h3>
            {items.map((item) => (
              <label key={item.id} className={`checklist-item ${item.is_completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.is_completed}
                  onChange={() => toggleItem(item)}
                  data-testid={`check-${item.id}`}
                />
                <span className="checkmark" />
                <span className="item-text">{item.item_text}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Reports Page
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

// Settings Page
const SettingsPage = () => {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEnv, setNewEnv] = useState({ name: '', url: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchEnvironments();
  }, []);

  const fetchEnvironments = async () => {
    try {
      const res = await axios.get(`${API}/environments`);
      setEnvironments(res.data);
    } catch (e) {
      console.error('Failed to load environments:', e);
    } finally {
      setLoading(false);
    }
  };

  const addEnvironment = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await axios.post(`${API}/environments`, newEnv);
      setNewEnv({ name: '', url: '' });
      fetchEnvironments();
    } catch (e) {
      console.error('Failed to add environment:', e);
    } finally {
      setAdding(false);
    }
  };

  const deleteEnvironment = async (id) => {
    if (!window.confirm('Delete this environment?')) return;
    try {
      await axios.delete(`${API}/environments/${id}`);
      fetchEnvironments();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }

  return (
    <div className="settings-page" data-testid="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage test environments and configuration</p>
      </div>

      <div className="settings-section">
        <h2>Test Environments</h2>
        <p>Add the websites you want to test</p>

        <form onSubmit={addEnvironment} className="add-env-form">
          <input
            type="text"
            placeholder="Environment name"
            value={newEnv.name}
            onChange={(e) => setNewEnv({ ...newEnv, name: e.target.value })}
            required
            data-testid="env-name-input"
          />
          <input
            type="url"
            placeholder="https://example.com"
            value={newEnv.url}
            onChange={(e) => setNewEnv({ ...newEnv, url: e.target.value })}
            required
            data-testid="env-url-input"
          />
          <button type="submit" disabled={adding} data-testid="add-env-btn">
            {adding ? <RefreshCw className="spin" size={16} /> : <Plus size={16} />}
            Add
          </button>
        </form>

        <div className="environments-list">
          {environments.map((env) => (
            <div key={env.id} className="environment-item">
              <div className="env-info">
                <span className="env-name">{env.name}</span>
                <span className="env-url">{env.url}</span>
              </div>
              <button 
                className="delete-btn" 
                onClick={() => deleteEnvironment(env.id)}
                data-testid={`delete-env-${env.id}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-state"><RefreshCw className="spin" size={32} /> Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Dashboard Layout
const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="dashboard-layout">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="main-content">
        <header className="top-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <span className="header-title">QA Guardian</span>
        </header>
        <main className="page-content">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="runs" element={<TestRunsPage />} />
            <Route path="runs/:runId" element={<RunDetailPage />} />
            <Route path="checklists" element={<ChecklistsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Main App
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/dashboard/*" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
