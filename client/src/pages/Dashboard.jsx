import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  GraduationCap,
  FileBarChart2,
  UploadCloud,
  Trash2,
  Plus,
  Send,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Check,
  X,
  Menu,
  BookOpen,
  Sparkles,
  Award,
  BookOpenCheck,
  Info,
  HelpCircle,
  HelpCircle as QuestionIcon
} from 'lucide-react';

export default function Dashboard() {
  const { currentUser, token, logout } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data states
  const [documents, setDocuments] = useState([]);
  const [chats, setChats] = useState([]);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    questionsAsked: 0,
    recentUploads: [],
    fileTypes: { pdf: 0, docx: 0, txt: 0 },
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0]
  });

  // Loading states
  const [docsLoading, setDocsLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Selection states
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Study Tools states
  const [studyDocId, setStudyDocId] = useState('');
  const [activeToolTab, setActiveToolTab] = useState('summary');
  const [studyData, setStudyData] = useState({});
  const [quizData, setQuizData] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);

  // Flashcards state
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Fetch stats and documents on load
  useEffect(() => {
    fetchDocumentsAndStats();
  }, [token]);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading]);

  const fetchDocumentsAndStats = async () => {
    if (!token) return;
    try {
      setDocsLoading(true);
      setStatsLoading(true);
      
      const docsData = await api.getDocuments(token);
      setDocuments(docsData);
      
      // Default selections
      if (docsData.length > 0 && selectedDocIds.length === 0) {
        setSelectedDocIds([docsData[0].id]);
      }
      if (docsData.length > 0 && !studyDocId) {
        setStudyDocId(docsData[0].id);
      }

      const chatsData = await api.getChats(token);
      setChats(chatsData);

      const statsData = await api.getStats(token);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setDocsLoading(false);
      setStatsLoading(false);
    }
  };

  // Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10MB limit.');
      return;
    }

    setUploading(true);
    try {
      await api.uploadDocument(file, token);
      await fetchDocumentsAndStats();
    } catch (err) {
      alert(err.message || 'Error uploading file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete document
  const handleDeleteDoc = async (id) => {
    if (!confirm('Are you sure you want to delete this document? All related chats, summaries, and quizzes will be removed.')) return;
    try {
      await api.deleteDocument(id, token);
      
      // Update selections
      setSelectedDocIds(prev => prev.filter(item => item !== id));
      if (studyDocId === id) setStudyDocId('');
      
      await fetchDocumentsAndStats();
    } catch (err) {
      alert('Error deleting document: ' + err.message);
    }
  };

  // --- CHAT LOGIC ---
  const handleSelectDocForChat = (id) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleStartNewChat = async () => {
    if (selectedDocIds.length === 0) {
      alert('Please select at least one document to start a chat session.');
      return;
    }

    try {
      const activeDocs = documents.filter(d => selectedDocIds.includes(d.id));
      const docNames = activeDocs.map(d => d.name.split('.')[0]).join(', ');
      const title = `Chat about: ${docNames.length > 25 ? docNames.substring(0, 22) + '...' : docNames}`;

      const newChat = await api.createChat({
        title,
        documentIds: selectedDocIds,
        messages: []
      }, token);

      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setChatMessages([]);
    } catch (err) {
      alert('Error creating chat: ' + err.message);
    }
  };

  const handleSelectChat = async (chat) => {
    setCurrentChatId(chat.id);
    setSelectedDocIds(chat.documentIds || []);
    setChatMessages(chat.messages || []);
  };

  const handleDeleteChat = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this chat history?')) return;
    try {
      await api.deleteChat(id, token);
      if (currentChatId === id) {
        setCurrentChatId(null);
        setChatMessages([]);
      }
      setChats(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Error deleting chat');
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    let chatId = currentChatId;
    
    // Create new chat session if none exists
    if (!chatId) {
      if (selectedDocIds.length === 0) {
        alert('Please select a document first.');
        return;
      }
      try {
        const activeDocs = documents.filter(d => selectedDocIds.includes(d.id));
        const docNames = activeDocs.map(d => d.name.split('.')[0]).join(', ');
        const title = `Chat: ${docNames.length > 25 ? docNames.substring(0, 22) + '...' : docNames}`;

        const newChat = await api.createChat({
          title,
          documentIds: selectedDocIds,
          messages: []
        }, token);

        chatId = newChat.id;
        setCurrentChatId(chatId);
        setChats(prev => [newChat, ...prev]);
      } catch (err) {
        alert('Error preparing chat: ' + err.message);
        return;
      }
    }

    const userMessage = { sender: 'user', text: chatInput, createdAt: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.sendMessage(chatId, userMessage.text, token);
      setChatMessages(prev => [...prev, response]);
      
      // Update chats list locally
      setChats(prev => prev.map(c => {
        if (c.id === chatId) {
          return { ...c, messages: [...c.messages, userMessage, response] };
        }
        return c;
      }));
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: `An error occurred: ${err.message}`, createdAt: new Date().toISOString() }
      ]);
    } finally {
      setChatLoading(false);
      // Fetch stats to update counter
      api.getStats(token).then(setStats).catch(() => {});
    }
  };

  // --- STUDY TOOLS LOGIC ---
  useEffect(() => {
    if (studyDocId) {
      loadStudyAids(studyDocId);
    } else {
      setStudyData({});
      setQuizData(null);
    }
  }, [studyDocId, token]);

  const loadStudyAids = async (docId) => {
    if (!token) return;
    try {
      setToolLoading(true);
      const summaryRes = await api.getSummary(docId, token);
      const quizRes = await api.getQuiz(docId, token);
      
      setStudyData(summaryRes || {});
      setQuizData(quizRes ? quizRes.questions : null);

      // Reset tools indexes
      setCurrentFlashcardIndex(0);
      setIsFlipped(false);
      setCurrentQuizIndex(0);
      setSelectedQuizAnswer(null);
      setQuizFinished(false);
      setQuizScore(0);
    } catch (err) {
      console.error('Error loading study aids:', err);
    } finally {
      setToolLoading(false);
    }
  };

  const handleGenerateTool = async (type) => {
    if (!studyDocId) return;
    setToolLoading(true);
    try {
      await api.generateStudyTool(studyDocId, type, token);
      await loadStudyAids(studyDocId);
    } catch (err) {
      alert(`Error generating ${type}: ${err.message}`);
    } finally {
      setToolLoading(false);
    }
  };

  // --- RENDERING HELPERS ---

  // Dashboard Stats & Grid
  const renderDashboardView = () => {
    const formattedSize = (bytes) => {
      if (!bytes) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Study Overview
        </h2>
        <p style={{ color: 'var(--gray-400)', marginBottom: '32px' }}>
          Welcome back, {currentUser?.displayName || 'Student'}! Here is your learning progress.
        </p>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div>
              <span className="stat-label">Total Documents</span>
              <div className="stat-value">{stats.totalDocuments}</div>
            </div>
            <div className="stat-icon primary">
              <FileText size={24} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span className="stat-label">Questions Asked</span>
              <div className="stat-value">{stats.questionsAsked}</div>
            </div>
            <div className="stat-icon success">
              <MessageSquare size={24} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span className="stat-label">Study Quizzes</span>
              <div className="stat-value">{documents.length}</div>
            </div>
            <div className="stat-icon warning">
              <GraduationCap size={24} />
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span className="stat-label">AI Readiness</span>
              <div className="stat-value">{documents.length > 0 ? '92%' : '0%'}</div>
            </div>
            <div className="stat-icon danger">
              <Sparkles size={24} />
            </div>
          </div>
        </div>

        <div className="dashboard-details">
          <div className="panel">
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Recent Uploads</h3>
            {stats.recentUploads && stats.recentUploads.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.recentUploads.map(doc => (
                  <div key={doc.id} className="flex-between" style={{ padding: '12px', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className={`doc-icon ${doc.type}`} style={{ width: '32px', height: '32px', fontSize: '0.65rem' }}>
                        {doc.type.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                          Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { setStudyDocId(doc.id); setActiveView('tools'); }} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      Study
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
                No documents uploaded yet. Go to Documents to upload your study files!
              </div>
            )}
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Knowledge Base Ratio</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div className="flex-between" style={{ fontSize: '0.875rem', marginBottom: '6px' }}>
                  <span>PDF Files</span>
                  <span style={{ fontWeight: 600 }}>{stats.fileTypes?.pdf || 0}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--gray-200)', borderRadius: '4px' }}>
                  <div style={{ height: '100%', backgroundColor: '#ef4444', borderRadius: '4px', width: `${stats.totalDocuments ? ((stats.fileTypes?.pdf || 0) / stats.totalDocuments) * 100 : 0}%` }}></div>
                </div>
              </div>
              
              <div>
                <div className="flex-between" style={{ fontSize: '0.875rem', marginBottom: '6px' }}>
                  <span>DOCX Files</span>
                  <span style={{ fontWeight: 600 }}>{stats.fileTypes?.docx || 0}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--gray-200)', borderRadius: '4px' }}>
                  <div style={{ height: '100%', backgroundColor: '#3b82f6', borderRadius: '4px', width: `${stats.totalDocuments ? ((stats.fileTypes?.docx || 0) / stats.totalDocuments) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex-between" style={{ fontSize: '0.875rem', marginBottom: '6px' }}>
                  <span>TXT Files</span>
                  <span style={{ fontWeight: 600 }}>{stats.fileTypes?.txt || 0}</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'var(--gray-200)', borderRadius: '4px' }}>
                  <div style={{ height: '100%', backgroundColor: 'var(--dark-light)', borderRadius: '4px', width: `${stats.totalDocuments ? ((stats.fileTypes?.txt || 0) / stats.totalDocuments) * 100 : 0}%` }}></div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '16px', marginTop: '10px' }}>
                <h4 style={{ fontSize: '0.875rem', color: 'var(--gray-400)', marginBottom: '10px' }}>Weekly Chat Activity</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '60px' }}>
                  {stats.weeklyActivity.map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ 
                        width: '12px', 
                        height: `${Math.min(45, (val / (Math.max(...stats.weeklyActivity, 1))) * 45)}px`, 
                        backgroundColor: 'var(--primary)', 
                        borderRadius: '3px 3px 0 0' 
                      }}></div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginTop: '4px' }}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Documents view
  const renderDocumentsView = () => {
    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          My Study Documents
        </h2>
        <p style={{ color: 'var(--gray-400)', marginBottom: '32px' }}>
          Upload your notes, textbooks, and files (PDF, DOCX, TXT) up to 10MB.
        </p>

        <div 
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud size={40} />
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Click to select or drag and drop a file</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: '4px' }}>
              Accepts PDF, DOCX, and TXT files (Max 10MB)
            </p>
          </div>
          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 500, fontSize: '0.9rem' }}>
              <RefreshCw className="animate-spin" size={16} /> Processing & chunking text...
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf,.docx,.txt" 
            style={{ display: 'none' }}
          />
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 style={{ fontSize: '1.25rem' }}>Uploaded Materials ({documents.length})</h3>
          </div>
          
          {docsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><RefreshCw className="animate-spin" /> Loading files...</div>
          ) : documents.length > 0 ? (
            <div className="document-list">
              {documents.map(doc => (
                <div key={doc.id} className="document-item">
                  <div className="document-meta">
                    <div className={`doc-icon ${doc.type}`}>{doc.type.toUpperCase()}</div>
                    <div>
                      <h4 className="doc-title">{doc.name}</h4>
                      <p className="doc-size">
                        Size: {parseFloat((doc.size / 1024).toFixed(1))} KB | Created: {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="actions-cell">
                    <button onClick={() => { setStudyDocId(doc.id); setActiveView('tools'); }} className="btn-secondary" style={{ padding: '8px 16px' }}>
                      Study Tools
                    </button>
                    <button onClick={() => handleDeleteDoc(doc.id)} className="btn-icon delete" title="Delete file">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>
              No study documents uploaded yet. Upload your first document above to get started!
            </div>
          )}
        </div>
      </div>
    );
  };

  // AI Chat view
  const renderChatView = () => {
    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          StudyMate AI Assistant
        </h2>
        <p style={{ color: 'var(--gray-400)', marginBottom: '24px' }}>
          Ask questions. The AI will answer ONLY from facts in the selected study documents.
        </p>

        <div className="chat-layout">
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} /> Select Sources
              </h3>
            </div>
            <div className="chat-doc-selector">
              {documents.length > 0 ? (
                documents.map(doc => (
                  <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 0' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => handleSelectDocForChat(doc.id)}
                    />
                    <span className="doc-title" style={{ fontSize: '0.85rem' }}>{doc.name}</span>
                  </label>
                ))
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textAlign: 'center', padding: '12px' }}>
                  No documents. Go to Documents view to upload.
                </p>
              )}
              
              <button 
                onClick={handleStartNewChat} 
                className="btn-primary" 
                style={{ width: '100%', padding: '10px', fontSize: '0.85rem', marginTop: '12px', justifyContent: 'center' }}
              >
                <Plus size={16} /> New Chat Session
              </button>

              {chats.length > 0 && (
                <div style={{ borderTop: '1px solid var(--gray-200)', marginTop: '20px', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginBottom: '8px' }}>Chat History</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {chats.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => handleSelectChat(c)}
                        className={`flex-between`} 
                        style={{ 
                          padding: '8px 10px', 
                          backgroundColor: currentChatId === c.id ? 'var(--primary-light)' : 'transparent',
                          color: currentChatId === c.id ? 'var(--primary)' : 'var(--dark-light)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 500
                        }}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                          {c.title}
                        </span>
                        <X size={14} style={{ color: 'var(--danger)', cursor: 'pointer' }} onClick={(e) => handleDeleteChat(c.id, e)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="chat-main">
            <div className="chat-header">
              <div>
                <h4 style={{ fontWeight: 700 }}>
                  {currentChatId ? chats.find(c => c.id === currentChatId)?.title : 'New Chat Session'}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '2px' }}>
                  Active Context: {selectedDocIds.length} file(s) selected
                </p>
              </div>
            </div>

            <div className="chat-messages">
              {chatMessages.length > 0 ? (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`message ${msg.sender}`}>
                    <div className="message-bubble" style={{ whiteSpace: 'pre-line' }}>
                      {msg.text}
                    </div>
                    <span className="message-meta">
                      {msg.sender === 'user' ? 'You' : 'StudyMate AI'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--gray-400)' }}>
                  <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <h3>Start Your Discussion</h3>
                  <p style={{ fontSize: '0.85rem', width: '280px', textAlign: 'center', marginTop: '6px' }}>
                    Type your question below. AI answers only based on the facts present in your uploaded files.
                  </p>
                </div>
              )}
              {chatLoading && (
                <div className="message ai">
                  <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gray-400)' }}>
                    <RefreshCw className="animate-spin" size={16} /> Thinking, verifying documents content...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <div className="chat-input-container">
              <form onSubmit={handleSendChatMessage} className="chat-input-form">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Ask a question about the active documents..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={selectedDocIds.length === 0}
                />
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={!chatInput.trim() || selectedDocIds.length === 0 || chatLoading}
                >
                  <Send size={16} /> Send
                </button>
              </form>
              {selectedDocIds.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '8px', fontWeight: 500 }}>
                  ⚠️ You must select at least one document source in the left panel to type questions.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Study Tools view
  const renderStudyToolsView = () => {
    const activeDoc = documents.find(d => d.id === studyDocId);

    const renderToolContent = () => {
      if (toolLoading) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px' }}>
            <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary)' }} />
            <h4 style={{ fontWeight: 600 }}>Analyzing & Generating study aid...</h4>
          </div>
        );
      }

      if (!studyDocId) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--gray-400)' }}>
            <GraduationCap size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3>Select a Document</h3>
            <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>Select a document from the left sidebar to generate study resources.</p>
          </div>
        );
      }

      switch (activeToolTab) {
        case 'summary':
          return (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem' }}>AI-Generated Summary</h3>
                {!studyData.summary && (
                  <button onClick={() => handleGenerateTool('summary')} className="btn-primary">
                    <Sparkles size={16} /> Generate Summary
                  </button>
                )}
              </div>
              {studyData.summary ? (
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.7, color: 'var(--dark-light)' }}>
                  {studyData.summary}
                </div>
              ) : (
                <p style={{ color: 'var(--gray-400)' }}>Click the button to generate a structured AI summary of the document.</p>
              )}
            </div>
          );

        case 'keypoints':
          return (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Key Points Takeaways</h3>
                {( !studyData.keyPoints || studyData.keyPoints.length === 0 ) && (
                  <button onClick={() => handleGenerateTool('keyPoints')} className="btn-primary">
                    <Sparkles size={16} /> Extract Key Points
                  </button>
                )}
              </div>
              {studyData.keyPoints && studyData.keyPoints.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', whiteSpace: 'pre-line' }}>
                  {studyData.keyPoints.map((pt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: 'var(--light)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{i+1}.</span>
                      <span style={{ color: 'var(--dark-light)' }}>{pt.replace(/^-\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--gray-400)' }}>Click extract to get a list of core structural topics and takeaways.</p>
              )}
            </div>
          );

        case 'shortnotes':
          return (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Revision Short Notes</h3>
                {!studyData.shortNotes && (
                  <button onClick={() => handleGenerateTool('shortNotes')} className="btn-primary">
                    <Sparkles size={16} /> Generate Short Notes
                  </button>
                )}
              </div>
              {studyData.shortNotes ? (
                <div style={{ whiteSpace: 'pre-line', lineHeight: 1.7, color: 'var(--dark-light)' }}>
                  {studyData.shortNotes}
                </div>
              ) : (
                <p style={{ color: 'var(--gray-400)' }}>Create structured short revision sheets for pre-exam lookups.</p>
              )}
            </div>
          );

        case 'flashcards':
          const cards = studyData.flashcards || [];
          return (
            <div>
              <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Vocabulary & Concept Flashcards</h3>
                {cards.length === 0 && (
                  <button onClick={() => handleGenerateTool('flashcards')} className="btn-primary">
                    <Sparkles size={16} /> Generate Flashcards
                  </button>
                )}
              </div>

              {cards.length > 0 ? (
                <div className="flashcards-container">
                  <div 
                    className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div className="card-face card-front">
                      <div className="card-tag">Concept / Question</div>
                      <h3>{cards[currentFlashcardIndex]?.front}</h3>
                      <div className="card-hint">Click to flip and reveal answer</div>
                    </div>
                    <div className="card-face card-back">
                      <div className="card-tag" style={{ color: 'var(--success)' }}>Explanation / Definition</div>
                      <p style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>{cards[currentFlashcardIndex]?.back}</p>
                      <div className="card-hint">Click to flip back</div>
                    </div>
                  </div>

                  <div className="flashcard-controls">
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setIsFlipped(false);
                        setCurrentFlashcardIndex(prev => Math.max(0, prev - 1));
                      }}
                      disabled={currentFlashcardIndex === 0}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      Card {currentFlashcardIndex + 1} of {cards.length}
                    </span>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setIsFlipped(false);
                        setCurrentFlashcardIndex(prev => Math.min(cards.length - 1, prev + 1));
                      }}
                      disabled={currentFlashcardIndex === cards.length - 1}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--gray-400)' }}>Click generate to split terms and concepts into dynamic study cards.</p>
              )}
            </div>
          );

        case 'quiz':
          const questions = quizData || [];
          
          if (questions.length === 0) {
            return (
              <div>
                <div className="flex-between" style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.25rem' }}>Practice MCQ Quizzes</h3>
                  <button onClick={() => handleGenerateTool('quizzes')} className="btn-primary">
                    <Sparkles size={16} /> Generate Practice Quiz
                  </button>
                </div>
                <p style={{ color: 'var(--gray-400)' }}>Challenge yourself! Generate an interactive multiple-choice test based on the document facts.</p>
              </div>
            );
          }

          if (quizFinished) {
            return (
              <div className="quiz-results fade-in">
                <div style={{ display: 'inline-flex', padding: '20px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%' }}>
                  <Award size={48} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Quiz Completed!</h3>
                  <p style={{ fontSize: '1.1rem', marginTop: '6px', color: 'var(--dark-light)' }}>
                    Your Score: <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{quizScore}</span> / {questions.length} (
                    {Math.round((quizScore / questions.length) * 100)}%)
                  </p>
                  <p style={{ color: 'var(--gray-400)', fontSize: '0.9rem', marginTop: '4px' }}>
                    {quizScore === questions.length ? '🥇 Perfect score! You have mastered this content!' : quizScore >= 3 ? '🥈 Good job! Review hints and try again.' : '🥉 Keep studying! Go through summaries first.'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setCurrentQuizIndex(0);
                    setSelectedQuizAnswer(null);
                    setQuizFinished(false);
                    setQuizScore(0);
                  }}
                  className="btn-primary"
                >
                  Retake Quiz
                </button>
              </div>
            );
          }

          const currentQ = questions[currentQuizIndex];
          return (
            <div className="quiz-container fade-in">
              <div className="flex-between">
                <h4 style={{ fontWeight: 600 }}>Question {currentQuizIndex + 1} of {questions.length}</h4>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>Score: {quizScore}</span>
              </div>
              <div className="quiz-progress-bar">
                <div className="quiz-progress-fill" style={{ width: `${((currentQuizIndex + 1) / questions.length) * 100}%` }}></div>
              </div>

              <div style={{ margin: '16px 0' }}>
                <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{currentQ?.question}</h3>
              </div>

              <div>
                {currentQ?.options.map((opt, oIdx) => {
                  let btnClass = '';
                  if (selectedQuizAnswer !== null) {
                    if (oIdx === currentQ.answer) btnClass = 'correct';
                    else if (selectedQuizAnswer === oIdx) btnClass = 'incorrect';
                  }

                  return (
                    <button
                      key={oIdx}
                      className={`quiz-option-button ${btnClass}`}
                      disabled={selectedQuizAnswer !== null}
                      onClick={() => {
                        setSelectedQuizAnswer(oIdx);
                        if (oIdx === currentQ.answer) {
                          setQuizScore(prev => prev + 1);
                        }
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selectedQuizAnswer !== null && (
                <div className="quiz-explanation">
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} /> Explanation
                  </p>
                  <p style={{ fontSize: '0.9rem', marginTop: '6px', color: 'var(--dark-light)' }}>{currentQ?.explanation}</p>
                  
                  <button
                    onClick={() => {
                      if (currentQuizIndex === questions.length - 1) {
                        setQuizFinished(true);
                      } else {
                        setCurrentQuizIndex(prev => prev + 1);
                        setSelectedQuizAnswer(null);
                      }
                    }}
                    className="btn-primary"
                    style={{ marginTop: '20px', marginLeft: 'auto' }}
                  >
                    {currentQuizIndex === questions.length - 1 ? 'Finish Test' : 'Next Question'}
                  </button>
                </div>
              )}
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Study Tools
        </h2>
        <p style={{ color: 'var(--gray-400)', marginBottom: '32px' }}>
          Select a document to review summaries, revision sheets, flippable card decks, and interactive quizzes.
        </p>

        <div className="study-layout">
          <div className="doc-sidebar">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Materials Directory</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {documents.length > 0 ? (
                documents.map(doc => (
                  <div 
                    key={doc.id} 
                    onClick={() => setStudyDocId(doc.id)}
                    className={`doc-select-card ${studyDocId === doc.id ? 'selected' : ''}`}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                      Type: {doc.type.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', textAlign: 'center', padding: '12px' }}>
                  No uploaded files.
                </p>
              )}
            </div>
          </div>

          <div className="study-main">
            {activeDoc ? (
              <>
                <div style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: '16px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={20} style={{ color: 'var(--primary)' }} /> {activeDoc.name}
                  </h3>
                </div>

                <div className="tool-tabs">
                  <button onClick={() => setActiveToolTab('summary')} className={`tool-tab ${activeToolTab === 'summary' ? 'active' : ''}`}>Summary</button>
                  <button onClick={() => setActiveToolTab('keypoints')} className={`tool-tab ${activeToolTab === 'keypoints' ? 'active' : ''}`}>Key Points</button>
                  <button onClick={() => setActiveToolTab('shortnotes')} className={`tool-tab ${activeToolTab === 'shortnotes' ? 'active' : ''}`}>Revision Notes</button>
                  <button onClick={() => setActiveToolTab('flashcards')} className={`tool-tab ${activeToolTab === 'flashcards' ? 'active' : ''}`}>Flashcards</button>
                  <button onClick={() => setActiveToolTab('quiz')} className={`tool-tab ${activeToolTab === 'quiz' ? 'active' : ''}`}>Practice Quiz</button>
                </div>

                {renderToolContent()}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--gray-400)' }}>
                <GraduationCap size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                <h3>No Material Selected</h3>
                <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>Select an item in the directory to initialize learning aids.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Project Report view
  const renderProjectReportView = () => {
    return (
      <div className="report-container fade-in">
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--primary)' }}>
            Project Documentation & Report
          </h1>
          <p style={{ color: 'var(--gray-400)', marginTop: '8px' }}>
            Technical breakdown, design layout, and structural specifications of StudyMate AI.
          </p>
        </div>

        <div className="report-section">
          <h2>Project Objective</h2>
          <p>
            StudyMate AI is designed as a smart, localized academic assistant that allows students to upload their coursework files (lecture slides, text documents, syllabi) and immediately engage in targeted, context-constrained learning. The core target is to allow students to interrogate their own documents without getting answers polluted by generic internet facts or external hallucinations. It also automates revision pipelines by generating summaries, notes, vocabulary flashcard decks, and testing modules.
          </p>
        </div>

        <div className="report-section">
          <h2>Problem Statement</h2>
          <p>
            While modern Large Language Models (LLMs) possess vast amounts of generic world data, they pose two major problems for academic revision:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Hallucinations & Generic Answers</strong>: Standard models respond with answers gathered from their pre-training dataset rather than focusing specifically on a teacher's lecture notes or university-specific formulas.</li>
            <li><strong>Text Parsing Inefficiencies</strong>: Manually chunking textbooks, copy-pasting content, and structuring mock revision aids is tedious and time-consuming for students preparing for exams.</li>
          </ul>
        </div>

        <div className="report-section">
          <h2>Methodology</h2>
          <p>
            We implement a localized Retrieval-Augmented Generation (RAG) framework:
          </p>
          <ol style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Document Parsing</strong>: Incoming text documents, PDF archives, or MS Word files are parsed in the Node.js layer to extract raw text buffers.</li>
            <li><strong>Text Chunking</strong>: A sliding window character algorithm splits the document content into overlapping blocks (1500 chars size, 300 overlap) to preserve context continuity.</li>
            <li><strong>Context Matching (RAG)</strong>: When a student chats, a similarity matching layer filters text chunks corresponding to keywords, packaging them as contextual boundaries.</li>
            <li><strong>Constrained Inference</strong>: The context is injected into Gemini AI models alongside instructions constraining output specifically to the supplied context. If facts cannot be found, a standard default message is enforced.</li>
          </ol>
        </div>

        <div className="report-section">
          <h2>System Architecture</h2>
          <p style={{ marginBottom: '16px' }}>
            A full-stack, modular architecture splitting duties between rendering, processing, and persistence:
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--light)', padding: '20px', borderRadius: '12px', border: '1px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', border: '1px solid var(--primary)', borderRadius: '8px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>Client Interface</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--dark-light)' }}>React SPA / CSS3 Transitions</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}><ChevronRight style={{ color: 'var(--gray-400)' }} /></div>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', border: '1px solid var(--primary)', borderRadius: '8px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>Express Backend</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--dark-light)' }}>Text extraction & API routes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}><ChevronRight style={{ color: 'var(--gray-400)' }} /></div>
              <div style={{ flex: 1, backgroundColor: 'white', padding: '16px', border: '1px solid var(--primary)', borderRadius: '8px', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '4px' }}>Storage / AI Layers</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--dark-light)' }}>Firestore DB & Gemini API</span>
              </div>
            </div>
          </div>
        </div>

        <div className="report-section">
          <h2>Technologies Used</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <h4>React & Vite</h4>
              <p style={{ fontSize: '0.85rem' }}>High-speed frontend assembly and hot module reloading.</p>
            </div>
            <div className="tech-card">
              <h4>Express / Node</h4>
              <p style={{ fontSize: '0.85rem' }}>File handling, PDF/DOCX buffers parsing, and API gateway routing.</p>
            </div>
            <div className="tech-card">
              <h4>Gemini AI SDK</h4>
              <p style={{ fontSize: '0.85rem' }}>Core LLM parsing engine for summary, quizzes, and chat replies.</p>
            </div>
            <div className="tech-card">
              <h4>Firebase Stack</h4>
              <p style={{ fontSize: '0.85rem' }}>User login/signup controls and cloud database persistence.</p>
            </div>
          </div>
        </div>

        <div className="report-section">
          <h2>Future Scope</h2>
          <p>
            To expand StudyMate AI into a larger classroom ecosystem:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><strong>Audio Transcriptions</strong>: Parsing and summarizing classroom audio lectures (MP3/WAV) using audio processing models.</li>
            <li><strong>Shared Study Spaces</strong>: Allowing groups of students to connect to shared document libraries.</li>
            <li><strong>Spaced Repetition Integration</strong>: Automating flashcards notifications using flashcard study algorithms (like SuperMemo SM-2).</li>
          </ul>
        </div>
      </div>
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      alert('Error signing out');
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar - Desktop */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <GraduationCap size={32} style={{ color: 'var(--primary)' }} />
          <span className="logo-text">StudyMate AI</span>
        </div>
        
        <ul className="sidebar-menu">
          <li onClick={() => { setActiveView('dashboard'); setMobileMenuOpen(false); }} className={`sidebar-item ${activeView === 'dashboard' ? 'active' : ''}`}>
            <LayoutDashboard />
            <span>Dashboard</span>
          </li>
          <li onClick={() => { setActiveView('documents'); setMobileMenuOpen(false); }} className={`sidebar-item ${activeView === 'documents' ? 'active' : ''}`}>
            <FileText />
            <span>Documents</span>
          </li>
          <li onClick={() => { setActiveView('chat'); setMobileMenuOpen(false); }} className={`sidebar-item ${activeView === 'chat' ? 'active' : ''}`}>
            <MessageSquare />
            <span>AI Chat</span>
          </li>
          <li onClick={() => { setActiveView('tools'); setMobileMenuOpen(false); }} className={`sidebar-item ${activeView === 'tools' ? 'active' : ''}`}>
            <GraduationCap />
            <span>Study Tools</span>
          </li>
          <li onClick={() => { setActiveView('report'); setMobileMenuOpen(false); }} className={`sidebar-item ${activeView === 'report' ? 'active' : ''}`}>
            <FileBarChart2 />
            <span>Project Report</span>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="user-info">
              <div className="user-name">{currentUser?.displayName || 'Student'}</div>
              <div className="user-email">{currentUser?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Header - Mobile */}
      <div className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={28} style={{ color: 'var(--primary)' }} />
          <span className="logo-text" style={{ fontSize: '1.1rem' }}>StudyMate AI</span>
        </div>
        <button className="btn-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Main Panel Content */}
      <main className="main-content">
        {activeView === 'dashboard' && renderDashboardView()}
        {activeView === 'documents' && renderDocumentsView()}
        {activeView === 'chat' && renderChatView()}
        {activeView === 'tools' && renderStudyToolsView()}
        {activeView === 'report' && renderProjectReportView()}
      </main>
    </div>
  );
}
