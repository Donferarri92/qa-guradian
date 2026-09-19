import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export default SettingsPage;
