'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, Mail, ArrowLeft, CheckCircle, Send } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
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
          {/* Header */}
          <div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to login
            </button>
            <h1 className="text-2xl font-bold text-foreground mb-1">Forgot password?</h1>
            <p className="text-sm text-muted-foreground">
              Enter your registered email and we&apos;ll send you a reset link.
            </p>
          </div>

          {/* Success state */}
          {success ? (
            <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#10b981] font-semibold">
                <CheckCircle className="w-5 h-5" />
                Reset link sent!
              </div>
              <p className="text-sm text-muted-foreground">
                If <span className="text-foreground font-medium">{email}</span> is registered, you&apos;ll receive a password reset email within a few minutes.
              </p>
              <p className="text-xs text-muted-foreground">
                Check your spam folder if you don&apos;t see it.
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full mt-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5 font-medium">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    placeholder="you@college.edu"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><Send className="w-4 h-4" /> Send Reset Link</>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
