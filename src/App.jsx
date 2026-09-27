import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Settings, 
  Bell, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  RefreshCw,
  Trash2,
  X
} from 'lucide-react';
import { fetchComplaints, updateComplaintStatus, deleteComplaint } from './api';
import './App.css';

function App() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, solved
  const [dateFilter, setDateFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null, confirmText: 'Confirm', type: 'danger' });
  
  const showConfirm = (title, message, confirmText, type, onConfirm, onCancel = null) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      type,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        if (onCancel) onCancel();
      }
    });
  };
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const loadData = async (userEmail = email, userPassword = password) => {
    setLoading(true);
    try {
      const data = await fetchComplaints(userEmail, userPassword);
      if (data && data.error) {
        setIsAuthenticated(false);
        setLoginError('Invalid Email or Password. Access denied by Google Apps Script.');
        localStorage.removeItem('crm_auth_email');
        localStorage.removeItem('crm_auth_pass');
        return false;
      } else {
        setComplaints(data);
        setIsAuthenticated(true);
        setLoginError('');
        localStorage.setItem('crm_auth_email', userEmail);
        localStorage.setItem('crm_auth_pass', userPassword);
        return true;
      }
    } catch (error) {
      console.error("Failed to fetch complaints", error);
      setLoginError('Network error connecting to Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    await loadData(email, password);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    localStorage.removeItem('crm_auth_email');
    localStorage.removeItem('crm_auth_pass');
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('crm_auth_email');
    const savedPass = localStorage.getItem('crm_auth_pass');
    if (savedEmail && savedPass) {
      setEmail(savedEmail);
      setPassword(savedPass);
      loadData(savedEmail, savedPass);
    }
  }, []);

  const handleStatusToggle = (id, currentStatus) => {
    if (currentStatus === 'pending') {
      showConfirm(
        "Resolve or Delete?",
        "Do you want to permanently delete this data from the Google Sheet, or just mark it as solved?",
        "Delete Permanently",
        "danger",
        async () => {
          // On Delete
          setComplaints(prev => prev.filter(c => c.id !== id));
          try {
            await deleteComplaint(id, email, password);
          } catch (error) {
            console.error("Failed to delete", error);
            loadData(email, password);
          }
        },
        async () => {
          // On Cancel (Just solve it)
          const newStatus = 'solved';
          setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
          try {
            await updateComplaintStatus(id, newStatus, email, password);
          } catch (error) {
            console.error("Failed to update status", error);
            setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus } : c));
          }
        }
      );
      return;
    }

    const newStatus = 'pending';
    // Optimistic update for Reopen
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    
    updateComplaintStatus(id, newStatus, email, password).catch(error => {
      console.error("Failed to update status", error);
      setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus } : c));
    });
  };

  const handleDelete = (id) => {
    showConfirm(
      "Delete Issue",
      "Are you sure you want to permanently delete this issue? This cannot be undone.",
      "Delete",
      "danger",
      async () => {
        setComplaints(prev => prev.filter(c => c.id !== id));
        try {
          await deleteComplaint(id, email, password);
        } catch (error) {
          console.error("Failed to delete", error);
          loadData(email, password);
        }
      }
    );
  };

  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const solvedCount = complaints.filter(c => c.status === 'solved').length;

  const getSolvedCountForDay = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    
    let count = 0;
    complaints.forEach(c => {
      if (c.status === 'solved') {
        const cDate = new Date(c.date);
        if (!isNaN(cDate.getTime()) && cDate.getFullYear() === d.getFullYear() && cDate.getMonth() === d.getMonth() && cDate.getDate() === d.getDate()) {
          count++;
        }
      }
    });
    return { dayName, count, isToday: offsetDays === 0 };
  };

  const dayStats = [2, 1, 0].map(getSolvedCountForDay);

  const filteredComplaints = complaints.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (dateFilter && !c.date.toLowerCase().includes(dateFilter.toLowerCase())) return false;
    if (issueFilter && !c.category.toLowerCase().includes(issueFilter.toLowerCase()) && !c.issue.toLowerCase().includes(issueFilter.toLowerCase())) return false;
    if (globalSearch) {
      const searchLower = globalSearch.toLowerCase();
      if (
        !c.id.toLowerCase().includes(searchLower) &&
        !c.email.toLowerCase().includes(searchLower) &&
        !c.category.toLowerCase().includes(searchLower) &&
        !c.issue.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <form onSubmit={handleLogin} className="glass-panel" style={{ padding: '40px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ background: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <MessageSquare size={24} color="white" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Sinan CRM</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>Please log in with your credentials</p>
          </div>
          
          {loginError && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center' }}>{loginError}</div>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px', color: 'white', width: '100%' }}
              placeholder="admin@sinan.com"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '8px', color: 'white', width: '100%' }}
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', justifyContent: 'center', marginTop: '10px' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-layout">


      {/* Main Content */}
      <main className="main-content">
        <header className="header animate-fade-in">
          <h1 className="page-title">Statistics</h1>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search something..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 16px', fontSize: '13px' }}>Logout</button>
          </div>
        </header>

        {/* Stats */}
        <div className="dashboard-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="glass-panel stat-card primary">
            <div className="stat-header">
              Total Complaints
              <div style={{ fontSize: '12px' }}>More</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
               <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '8px solid rgba(26, 28, 33, 0.2)', borderLeftColor: '#1a1c21', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                 {complaints.length}
               </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', background: '#1a1c21', borderRadius: '2px' }}></div> Pending</div>
                <div style={{ fontWeight: 600 }}>{pendingCount}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', background: 'rgba(26,28,33,0.3)', borderRadius: '2px' }}></div> Solved</div>
                <div style={{ fontWeight: 600 }}>{solvedCount}</div>
              </div>
            </div>
          </div>
          
          <div className="glass-panel stat-card" style={{ background: 'var(--bg-sidebar)', border: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="stat-header" style={{ marginBottom: '8px' }}>
              <div style={{ border: '1px solid var(--border)', padding: '6px 16px', borderRadius: '20px', fontSize: '12px' }}>Filter Data</div>
            </div>
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Search by Date</label>
                 <input 
                   type="text" 
                   placeholder="e.g. 10/24/2026" 
                   value={dateFilter}
                   onChange={e => setDateFilter(e.target.value)}
                   style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                 />
               </div>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Search by Issue</label>
                 <input 
                   type="text" 
                   placeholder="Keyword..." 
                   value={issueFilter}
                   onChange={e => setIssueFilter(e.target.value)}
                   style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                 />
               </div>
            </div>
          </div>
          
          <div className="glass-panel stat-card" style={{ background: '#e6e7eb' }}>
             <div className="stat-header" style={{ color: '#1a1c21', fontWeight: 600 }}>
               Solved Rate
               <div style={{ background: '#1a1c21', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 19L19 5M19 5V15M19 5H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
               </div>
             </div>
             
             <div style={{ display: 'flex', gap: '8px', margin: '20px 0' }}>
               {dayStats.map((stat, i) => (
                 <div key={i} style={{ background: stat.isToday ? 'var(--primary)' : 'white', padding: '12px 10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, color: stat.isToday ? '#1a1c21' : '#8b8d96', fontSize: '11px', fontWeight: stat.isToday ? 500 : 400 }}>
                   {stat.dayName}
                   <div style={{ color: '#1a1c21', fontSize: '14px', fontWeight: stat.isToday ? 700 : 600 }}>{stat.count}</div>
                 </div>
               ))}
             </div>
             
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
               <div style={{ fontSize: '42px', fontWeight: 700, color: '#1a1c21', lineHeight: 1 }}>{complaints.length > 0 ? Math.round((solvedCount / complaints.length) * 100) : 0}%</div>
               <div style={{ fontSize: '11px', color: '#8b8d96', textAlign: 'right' }}>
                 <div style={{ color: '#1a1c21', fontWeight: 600 }}>Overall Rate</div>
                 Across all time
               </div>
             </div>
          </div>
          
          <div className="glass-panel stat-card" style={{ padding: '0', position: 'relative', overflow: 'hidden' }}>
             <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} alt="AI" />
             <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px' }}>
                <button className="btn btn-primary" onClick={() => loadData(email, password)} disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '13px', display: 'flex', justifyContent: 'center' }}>
                   {loading ? <RefreshCw size={16} className="animate-pulse-slow" /> : 'Sync with Sheet'}
                </button>
             </div>
          </div>
        </div>

        {/* Filters */}
        <div className="animate-fade-in" style={{ display: 'flex', gap: '12px', marginBottom: '24px', animationDelay: '0.2s' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('all')}>All Complaints</button>
          <button className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('pending')}>Pending Only</button>
          <button className={`btn ${filter === 'solved' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter('solved')}>Solved Only</button>
        </div>

        {/* Table */}
        <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.3s', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Recent Reports</h2>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                style={{ 
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                  padding: '10px 16px 10px 40px', borderRadius: '8px', color: 'white', width: '250px' 
                }} 
              />
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Date</th>
                  <th>Order id</th>
                  <th>Email / phone</th>
                  <th>Issue</th>
                  <th>Describe issue</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      <RefreshCw className="animate-pulse-slow" size={32} style={{ marginBottom: '16px', color: 'var(--primary)' }} />
                      <p>Fetching data from Google Sheets...</p>
                    </td>
                  </tr>
                ) : filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">No complaints found.</td>
                  </tr>
                ) : (
                  filteredComplaints.map((complaint, index) => (
                    <tr key={`${complaint.id}-${index}`}>
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{index + 1}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{complaint.date}</td>
                      <td style={{ fontWeight: 500 }}>{complaint.id}</td>
                      <td>{complaint.email}</td>
                      <td>
                        <span className="category-tag">{complaint.category}</span>
                      </td>
                      <td 
                        style={{ maxWidth: '300px', cursor: 'pointer' }}
                        onClick={() => setSelectedComplaint(complaint)}
                      >
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--primary)', textDecoration: 'underline' }}>
                          Click to view issue...
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge status-${complaint.status}`}>
                          {complaint.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           {complaint.status === 'pending' ? (
                             <button 
                               style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, transition: 'all 0.2s' }}
                               onClick={() => handleStatusToggle(complaint.id, complaint.status)}
                               title="Click to resolve this issue"
                               onMouseOver={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'}
                               onMouseOut={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'}
                             >
                               <CheckCircle2 size={14} /> Resolve
                             </button>
                           ) : (
                             <button 
                               style={{ padding: '6px 12px', fontSize: '12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                               onClick={() => handleStatusToggle(complaint.id, complaint.status)}
                               title="Click to reopen this issue"
                               onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                               onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                             >
                               <RefreshCw size={14} /> Reopen
                             </button>
                           )}
                           
                           {complaint.status === 'solved' && (
                             <button className="action-btn" onClick={() => handleDelete(complaint.id)} title="Delete permanently">
                               <Trash2 size={18} color="#ef4444" />
                             </button>
                           )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Modal */}
      {selectedComplaint && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '500px', padding: '32px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <button onClick={() => setSelectedComplaint(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px 0' }}>Issue Details</h2>
            
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Order ID</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{selectedComplaint.id}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Email / Phone</div>
              <div style={{ fontSize: '16px', fontWeight: 500 }}>{selectedComplaint.email}</div>
            </div>
            
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Issue Category</div>
              <span className="category-tag">{selectedComplaint.category}</span>
            </div>
            
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Detailed Description</div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '15px' }}>
                {selectedComplaint.issue || "No description provided."}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirm Modal */}
      {confirmDialog.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: confirmDialog.type === 'danger' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: confirmDialog.type === 'danger' ? '#ef4444' : '#f59e0b', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={24} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{confirmDialog.title}</h2>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
              {confirmDialog.message}
            </p>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                onClick={confirmDialog.onCancel}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                style={{ padding: '8px 16px', borderRadius: '8px', background: confirmDialog.type === 'danger' ? '#ef4444' : 'var(--primary)', color: confirmDialog.type === 'danger' ? 'white' : 'black', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
