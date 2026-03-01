'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import { User, Mail, Phone, Lock, Save, ArrowLeft, CheckCircle, Eye, EyeOff, Shield } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Name / phone form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileOk, setProfileOk] = useState(false);

  // Password form
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passOk, setPassOk] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailOk, setEmailOk] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      setUser(d.user);
      setName(d.user.name);
      setPhone(d.user.phone || '');
      setLoading(false);
    });
  }, [router]);

  const flash = (setMsg: (m: string) => void, setOk: (b: boolean) => void, msg: string, ok: boolean) => {
    setMsg(msg); setOk(ok);
    setTimeout(() => { setMsg(''); setOk(false); }, 4000);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    });
    const data = await res.json();
    setProfileSaving(false);
    if (res.ok) {
      setUser((u: any) => ({ ...u, name, phone }));
      flash(setProfileMsg, setProfileOk, 'Profile updated successfully!', true);
    } else {
      flash(setProfileMsg, setProfileOk, data.error || 'Update failed', false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      flash(setPassMsg, setPassOk, 'Passwords do not match', false); return;
    }
    if (newPass.length < 6) {
      flash(setPassMsg, setPassOk, 'Password must be at least 6 characters', false); return;
    }
    setPassSaving(true);
    const res = await fetch('/api/profile/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'password', password: newPass }),
    });
    const data = await res.json();
    setPassSaving(false);
    if (res.ok) {
      setNewPass(''); setConfirmPass('');
      flash(setPassMsg, setPassOk, 'Password changed successfully!', true);
    } else {
      flash(setPassMsg, setPassOk, data.error || 'Failed to change password', false);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    const res = await fetch('/api/profile/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email: newEmail }),
    });
    const data = await res.json();
    setEmailSaving(false);
    if (res.ok) {
      flash(setEmailMsg, setEmailOk, 'Confirmation email sent! Check your inbox.', true);
      setNewEmail('');
    } else {
      flash(setEmailMsg, setEmailOk, data.error || 'Failed to update email', false);
    }
  };

  const goBack = () => {
    const role = user?.role;
    if (role === 'admin' || role === 'transport_head') router.push('/admin');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'parent') router.push('/parent');
    else router.push('/student');
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {user && <DashboardNav user={user} />}

      <main className="flex-1 p-4 lg:p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-space-grotesk)' }}>Profile & Settings</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Current info card */}
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-medium capitalize">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Name & Phone */}
        <form onSubmit={saveProfile} className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Personal Info</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Display Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Your full name"
                required
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="+91 9876543210"
                type="tel"
              />
            </div>
          </div>

          {profileMsg && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${profileOk ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
              {profileOk && <CheckCircle className="w-4 h-4 shrink-0" />}
              {profileMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={profileSaving}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {profileSaving
              ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              : <><Save className="w-4 h-4" /> Save Changes</>
            }
          </button>
        </form>

        {/* Change Email */}
        <form onSubmit={saveEmail} className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Change Email</span>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Current email: <span className="text-foreground">{user.email}</span></label>
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              type="email"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="new@email.com"
              required
            />
            <p className="text-xs text-muted-foreground mt-1.5">A confirmation link will be sent to both addresses.</p>
          </div>

          {emailMsg && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${emailOk ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
              {emailOk && <CheckCircle className="w-4 h-4 shrink-0" />}
              {emailMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={emailSaving || !newEmail}
            className="w-full py-2.5 rounded-lg bg-muted border border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted/70 disabled:opacity-60 transition-all"
          >
            {emailSaving
              ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              : <><Mail className="w-4 h-4" /> Update Email</>
            }
          </button>
        </form>

        {/* Change Password */}
        <form onSubmit={savePassword} className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Change Password</span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <label className="text-xs text-muted-foreground block mb-1.5">New Password</label>
              <input
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                type={showPass ? 'text' : 'password'}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Minimum 6 characters"
                required
              />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-8 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Confirm New Password</label>
              <input
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                type={showPass ? 'text' : 'password'}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Repeat new password"
                required
              />
            </div>
          </div>

          {passMsg && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${passOk ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
              {passOk && <CheckCircle className="w-4 h-4 shrink-0" />}
              {passMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={passSaving || !newPass || !confirmPass}
            className="w-full py-2.5 rounded-lg bg-muted border border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted/70 disabled:opacity-60 transition-all"
          >
            {passSaving
              ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              : <><Shield className="w-4 h-4" /> Change Password</>
            }
          </button>
        </form>
      </main>
    </div>
  );
}
