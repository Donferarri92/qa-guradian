import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
            style={{ width: `${filteredItems.length > 0 ? (completedCount / filteredItems.length) * 100 : 0}%` }}
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

export default ChecklistsPage;
