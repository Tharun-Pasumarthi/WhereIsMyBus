'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Lock, Eye, EyeOff, CheckCircle, Shield, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type PageState = 'loading' | 'ready' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Supabase appends tokens as hash fragments after the redirect
    // e.g. /reset-password#access_token=xxx&type=recovery
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (type === 'recovery' && accessToken && refreshToken) {
      // Establish session from URL tokens so we can call updateUser
      const supabase = createClient();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setPageState('invalid');
          } else {
            setPageState('ready');
            // Clean up the URL so tokens are not visible
            window.history.replaceState(null, '', '/reset-password');
          }
        });
    } else {
      setPageState('invalid');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
      } else {
        // Sign out after password reset so user logs in fresh
        await supabase.auth.signOut();
        setPageState('success');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Bus className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-bold text-foreground text-lg leading-none">Where Is My Bus</span>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase leading-none">Smart Transit</div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Verifying reset link…</p>
            </div>
          )}

          {/* Invalid / expired */}
          {pageState === 'invalid' && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground mb-1">Invalid or expired link</h1>
                <p className="text-sm text-muted-foreground">
                  This password reset link is invalid or has already been used. Please request a new one.
                </p>
              </div>
              <button
                onClick={() => router.push('/forgot-password')}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Request New Link
              </button>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-[#10b981]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground mb-1">Password reset!</h1>
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. You can now log in with your new password.
                </p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Reset form */}
          {pageState === 'ready' && (
            <>
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Set new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="Minimum 6 characters"
                      required
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="Repeat new password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          password.length >= (i + 1) * 3
                            ? password.length >= 12 ? 'bg-[#10b981]' : password.length >= 8 ? 'bg-[#f59e0b]' : 'bg-red-400'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">
                      {password.length < 6 ? 'Too short' : password.length < 8 ? 'Weak' : password.length < 12 ? 'Fair' : 'Strong'}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving || !password || !confirmPassword}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all"
                >
                  {saving
                    ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    : <><Shield className="w-4 h-4" /> Reset Password</>
                  }
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </main>
  );
}
