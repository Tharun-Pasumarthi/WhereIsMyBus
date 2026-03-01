'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import { User, Mail, Phone, Lock, Save, ArrowLeft, CheckCircle, Eye, EyeOff, Shield, UserPlus, Trash2, Users, Camera, X } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar_url?: string | null;
}

interface LinkedParent {
  id: string;
  name: string;
  email: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
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

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarOk, setAvatarOk] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Parent linking (student only)
  const [linkedParents, setLinkedParents] = useState<LinkedParent[]>([]);
  const [parentEmail, setParentEmail] = useState('');
  const [parentSaving, setParentSaving] = useState(false);
  const [parentMsg, setParentMsg] = useState('');
  const [parentOk, setParentOk] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchLinkedParents = useCallback(async () => {
    const res = await fetch('/api/profile/parent');
    if (res.ok) {
      const data = await res.json();
      setLinkedParents(data.parents ?? []);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user) { router.push('/'); return; }
      setUser(d.user);
      setName(d.user.name);
      setPhone(d.user.phone || '');
      if (d.user.role === 'student') fetchLinkedParents();
      setLoading(false);
    });
  }, [router, fetchLinkedParents]);

  const flash = (
    setMsg: (m: string) => void,
    setOk: (b: boolean) => void,
    msg: string,
    ok: boolean
  ) => {
    setMsg(msg);
    setOk(ok);
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
      setUser(prev => prev ? { ...prev, name, phone } : prev);
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

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarMsg('');
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok) {
      setUser(prev => prev ? { ...prev, avatar_url: data.avatar_url } : prev);
      flash(setAvatarMsg, setAvatarOk, 'Profile photo updated!', true);
    } else {
      flash(setAvatarMsg, setAvatarOk, data.error || 'Upload failed', false);
    }
    // Reset input so same file can be re-selected
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok) {
      setUser(prev => prev ? { ...prev, avatar_url: null } : prev);
      flash(setAvatarMsg, setAvatarOk, 'Photo removed.', true);
    } else {
      flash(setAvatarMsg, setAvatarOk, data.error || 'Remove failed', false);
    }
  };

  const linkParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentSaving(true);
    const res = await fetch('/api/profile/parent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parentEmail }),
    });
    const data = await res.json();
    setParentSaving(false);
    if (res.ok) {
      setParentEmail('');
      await fetchLinkedParents();
      flash(setParentMsg, setParentOk, data.message || 'Parent linked!', true);
    } else {
      flash(setParentMsg, setParentOk, data.error || 'Failed to link parent', false);
    }
  };

  const removeParent = async (parentId: string) => {
    setRemovingId(parentId);
    const res = await fetch('/api/profile/parent', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: parentId }),
    });
    const data = await res.json();
    setRemovingId(null);
    if (res.ok) {
      setLinkedParents(prev => prev.filter(p => p.id !== parentId));
      flash(setParentMsg, setParentOk, 'Parent access removed.', true);
    } else {
      flash(setParentMsg, setParentOk, data.error || 'Failed to remove parent', false);
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarMsg('');
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok) {
      setUser(prev => prev ? { ...prev, avatar_url: data.avatar_url } : prev);
      flash(setAvatarMsg, setAvatarOk, 'Profile photo updated!', true);
    } else {
      flash(setAvatarMsg, setAvatarOk, data.error || 'Upload failed', false);
    }
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const removeAvatar = async () => {
    setAvatarUploading(true);
    const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
    const data = await res.json();
    setAvatarUploading(false);
    if (res.ok) {
      setUser(prev => prev ? { ...prev, avatar_url: null } : prev);
      flash(setAvatarMsg, setAvatarOk, 'Photo removed.', true);
    } else {
      flash(setAvatarMsg, setAvatarOk, data.error || 'Remove failed', false);
    }
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

        {/* Profile photo card */}
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <div className="flex items-center gap-4">
            {/* Avatar with upload overlay */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden text-3xl font-bold text-muted-foreground">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  : user.name?.charAt(0).toUpperCase()
                }
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-background hover:bg-primary/80 transition-colors disabled:opacity-60"
                aria-label="Upload photo"
              >
                {avatarUploading
                  ? <span className="w-3.5 h-3.5 border border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                }
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={uploadAvatar}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-foreground">{user.name}</div>
              <div className="text-sm text-muted-foreground truncate">{user.email}</div>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-medium capitalize">
                {user.role}
              </span>
            </div>

            {user.avatar_url && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarUploading}
                className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                aria-label="Remove photo"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {avatarMsg && (
            <div className={`mt-3 flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${avatarOk ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
              {avatarOk && <CheckCircle className="w-4 h-4 shrink-0" />}
              {avatarMsg}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · max 2 MB</p>
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
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                <Phone className="w-3 h-3" />
                <label htmlFor="phone">Phone Number</label>
              </div>
              <input
                id="phone"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="+91 9876543210"
                type="tel"
                autoComplete="tel"
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

        {/* Parent Access — students only */}
        {user.role === 'student' && (
          <div className="bg-card rounded-xl border border-border/50 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Parent Access</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Allow a parent to track your bus and view your attendance. They must have a parent account registered first.
            </p>

            {/* Linked parents list */}
            {linkedParents.length > 0 && (
              <ul className="space-y-2">
                {linkedParents.map(p => (
                  <li key={p.id} className="flex items-center justify-between bg-muted/60 border border-border/50 rounded-lg px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    <button
                      onClick={() => removeParent(p.id)}
                      disabled={removingId === p.id}
                      className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove parent access"
                      aria-label={`Remove ${p.name}`}
                    >
                      {removingId === p.id
                        ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin block" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {linkedParents.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2 bg-muted/40 rounded-lg border border-dashed border-border">
                No parents linked yet.
              </div>
            )}

            {/* Add parent form */}
            <form onSubmit={linkParent} className="flex gap-2">
              <input
                type="email"
                value={parentEmail}
                onChange={e => setParentEmail(e.target.value)}
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="parent@email.com"
                required
              />
              <button
                type="submit"
                disabled={parentSaving || !parentEmail}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all whitespace-nowrap"
              >
                {parentSaving
                  ? <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  : <><UserPlus className="w-4 h-4" /> Add</>
                }
              </button>
            </form>

            {parentMsg && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${parentOk ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                {parentOk && <CheckCircle className="w-4 h-4 shrink-0" />}
                {parentMsg}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
