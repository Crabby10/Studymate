import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, GraduationCap, Lock, Mail, User } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signUp, isDemoMode } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!displayName.trim()) {
          throw new Error('Please enter your name');
        }
        await signUp(email, password, displayName);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page fade-in">
      <div className="auth-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <GraduationCap size={44} />
          <h1 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800 }}>
            StudyMate AI
          </h1>
        </div>
        <p style={{ fontSize: '1.25rem', opacity: 0.9, lineHeight: 1.6, marginBottom: '40px', fontWeight: 300 }}>
          Your personalized AI study companion. Upload documents, generate comprehensive study guides, practice quizzes, and chat directly with your learning materials.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <h4 style={{ color: 'white' }}>Smart Document Reader</h4>
              <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>Support for PDF, DOCX, and Text documents</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <h4 style={{ color: 'white' }}>Automated Study Tools</h4>
              <p style={{ fontSize: '0.875rem', opacity: 0.7 }}>Generate flashcards, summaries, and MCQs instantly</p>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-container">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '16px', marginBottom: '16px' }}>
            <GraduationCap size={36} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.9rem', marginTop: '6px' }}>
            {isDemoMode ? '🚀 Demo Mode Active - No Firebase credentials needed!' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px', color: 'var(--danger)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isLogin && (
            <div className="form-group">
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dark-light)' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--gray-400)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ paddingLeft: '44px', width: '100%' }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dark-light)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--gray-400)' }} />
              <input
                type="email"
                className="form-input"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '44px', width: '100%' }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--dark-light)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--gray-400)' }} />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '44px', width: '100%' }}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-400)' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span 
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }} 
              style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
