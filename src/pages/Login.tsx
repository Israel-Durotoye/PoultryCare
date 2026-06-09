import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signup(email, password);
        toast.success('Account created! Welcome to CluckCare 🐔');
      } else {
        await login(email, password);
        toast.success('Welcome back!');
      }
      navigate('/');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      const msg =
        code === 'auth/invalid-credential'   ? 'Invalid email or password.' :
        code === 'auth/user-not-found'        ? 'No account found with this email.' :
        code === 'auth/wrong-password'        ? 'Incorrect password.' :
        code === 'auth/email-already-in-use'  ? 'Email already registered. Sign in instead.' :
        code === 'auth/weak-password'         ? 'Password must be at least 6 characters.' :
        code === 'auth/invalid-email'         ? 'Please enter a valid email address.' :
        'Authentication failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <Toaster position="top-center" richColors />

      {/* Decorative blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-soft mb-4">
            <svg viewBox="0 0 32 32" className="h-9 w-9 text-primary" fill="currentColor">
              <path d="M16 2a10 10 0 0 0-8.56 15.18l-1.12 1.9a1.5 1.5 0 0 0 1.3 2.27h1.43c1.08 2.85 3.82 4.65 6.95 4.65s5.87-1.8 6.95-4.65h1.43a1.5 1.5 0 0 0 1.3-2.27l-1.12-1.9A10 10 0 0 0 16 2z" />
              <circle cx="12" cy="12" r="1.5" fill="white" />
              <circle cx="20" cy="12" r="1.5" fill="white" />
              <path d="M13 3.5c0-1.5 1-2 1-2s1 .5 1 2M17 3.5c0-1.5 1-2 1-2s1 .5 1 2" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 14.5l1 2 1-2h-2z" fill="#F59E0B" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">CluckCare</h1>
          <p className="text-muted-foreground text-sm mt-1.5 flex items-center justify-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-Powered Poultry Health Diagnostics
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl shadow-elegant p-8">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  mode === m
                    ? 'bg-card shadow-soft text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl bg-muted/60 border border-border hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-foreground transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="w-full h-11 px-4 pr-11 rounded-xl bg-muted/60 border border-border hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-foreground transition-all placeholder:text-muted-foreground/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-muted-foreground pl-1">Minimum 6 characters</p>
              )}
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer text-sm tracking-wide"
            >
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                ? '→  Sign In'
                : '→  Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer font-medium"
          >
            {mode === 'signin' ? 'Create a new account' : 'Sign in to existing account'}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          For research and demonstration purposes only.
          <br />Always confirm findings with a licensed veterinarian.
        </p>
      </div>
    </div>
  );
}
