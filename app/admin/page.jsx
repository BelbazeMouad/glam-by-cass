'use client';
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase';
import Dashboard from './Dashboard';

export default function AdminPage() {
  const supabase = supabaseBrowser();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(e) {
    e.preventDefault();
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
  }

  if (checking) return <div className="login-wrap"><p className="muted">Loading…</p></div>;

  if (!session) {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <h2 className="gold-text">Welcome back, Cass</h2>
          <p>Sign in to manage your studio</p>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="pass-wrap">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="pass-toggle" onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }}>Enter Dashboard</button>
          <p className="login-hint">Only Cass has an account. Create it in Supabase → Authentication → Users.</p>
        </form>
      </div>
    );
  }

  return <Dashboard supabase={supabase} onSignOut={() => supabase.auth.signOut()} />;
}
