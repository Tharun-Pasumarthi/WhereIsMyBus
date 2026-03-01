'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bus, MapPin, Shield, Zap, Users, Bell, Eye, EyeOff, ArrowRight, Radio } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@college.edu', password: 'admin123', color: 'text-[#f59e0b]' },
  { role: 'Driver', email: 'driver1@college.edu', password: 'driver123', color: 'text-[#0ea5e9]' },
  { role: 'Student', email: 'student1@college.edu', password: 'student123', color: 'text-[#10b981]' },
  { role: 'Parent', email: 'parent1@college.edu', password: 'parent123', color: 'text-purple-400' },
];

const FEATURES = [
  { icon: MapPin, title: 'Live GPS Tracking', desc: 'Real-time bus location updates every 5 seconds', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
  { icon: Zap, title: 'Smart ETA Prediction', desc: 'AI-powered arrival time calculations with traffic data', color: 'text-[#0ea5e9]', bg: 'bg-[#0ea5e9]/10' },
  { icon: Shield, title: 'SOS Emergency', desc: 'Instant emergency alerts for drivers and students', color: 'text-red-400', bg: 'bg-red-400/10' },
  { icon: Users, title: 'QR Attendance', desc: 'Secure time-based QR boarding attendance system', color: 'text-[#10b981]', bg: 'bg-[#10b981]/10' },
  { icon: Bell, title: 'Smart Alerts', desc: 'Proactive delay, battery and device failure notifications', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { icon: Radio, title: 'Heartbeat Monitor', desc: 'Continuous driver device connectivity monitoring', color: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10' },
];

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) return;
      const role = d.user.role;
      if (role === 'admin' || role === 'transport_head') router.replace('/admin');
      else if (role === 'driver') router.replace('/driver');
      else if (role === 'parent') router.replace('/parent');
      else router.replace('/student');
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      const role = data.user.role;
      if (role === 'admin' || role === 'transport_head') router.push('/admin');
      else if (role === 'driver') router.push('/driver');
      else if (role === 'parent') router.push('/parent');
      else router.push('/student');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
  };

  return (
    <main className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-md bg-background/80">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Bus className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground font-[var(--font-space-grotesk)] text-lg leading-none">Where Is My Bus</span>
              <div className="text-[10px] text-muted-foreground tracking-widest uppercase leading-none">Smart Transit</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground border border-border/50 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] pulse-dot inline-block"></span>
              System Online
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16 min-h-screen flex flex-col lg:flex-row">
        {/* Left - Hero */}
        <div className="flex-1 flex flex-col justify-center px-6 py-16 lg:px-16 xl:px-24 relative">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary border border-primary/30 rounded-full px-3 py-1.5 mb-6 bg-primary/10">
              <Radio className="w-3 h-3" />
              AI-Powered College Bus Tracking
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight text-balance mb-4 font-[var(--font-space-grotesk)]">
              Know exactly{' '}
              <span className="text-primary">where your bus</span>{' '}
              is, right now.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed mb-10">
              Real-time GPS tracking, smart ETAs, QR boarding attendance, and proactive safety alerts — all in one platform for modern college transportation.
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-2.5 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center shrink-0`}>
                    <f.icon className={`w-4 h-4 ${f.color}`} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground leading-tight">{f.title}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 hidden sm:block">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Login Panel */}
        <div className="w-full lg:w-[480px] xl:w-[520px] flex items-center justify-center px-6 py-12 lg:py-0 border-t lg:border-t-0 lg:border-l border-border/50">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-[var(--font-space-grotesk)] text-foreground">Sign in to your portal</h2>
              <p className="text-muted-foreground text-sm mt-1">Access your role-based dashboard</p>
            </div>

            {/* Demo accounts */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Quick Demo Access</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.role}
                    onClick={() => fillDemo(acc)}
                    className="py-2 px-3 rounded-lg bg-muted hover:bg-accent/20 border border-border/50 hover:border-primary/40 transition-all text-center group"
                  >
                    <div className={`text-xs font-bold ${acc.color}`}>{acc.role}</div>
                    <div className="text-[10px] text-muted-foreground">click to fill</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@college.edu"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => router.push('/forgot-password')}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all text-sm pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  <Shield className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-3 gap-3 text-center">
              {[['3', 'Bus Routes'], ['3', 'Active Buses'], ['100+', 'Students']].map(([n, l]) => (
                <div key={l}>
                  <div className="text-lg font-bold text-primary">{n}</div>
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
