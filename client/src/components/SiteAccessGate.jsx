import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Lock, ShieldCheck } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useSiteAccess } from '../context/SiteAccessContext';

export default function SiteAccessGate() {
  const { verify } = useSiteAccess();
  const [form, setForm] = useState({ username: '', code: '' });
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.code.trim()) {
      return toast.error('Enter your username and access code');
    }

    setLoading(true);
    try {
      await verify(form.username.trim(), form.code);
      toast.success('Access granted — welcome to Curi');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid username or access code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg flex items-center justify-center relative overflow-hidden px-6">
      <div className="blob-bg w-96 h-96 bg-curi-pink top-[-6rem] left-[-4rem] animate-float" />
      <div className="blob-bg w-64 h-64 bg-curi-blue bottom-[-2rem] right-[-2rem] animate-float-delayed" />
      <div className="blob-bg w-40 h-40 bg-curi-yellow top-[18%] right-[18%] animate-float" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-curi-gradient mb-4 shadow-clay">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <img
            src="/images/curi-mascot.png"
            alt="Curi mascot"
            className="w-20 h-20 mx-auto object-contain mb-3"
          />
          <h1 className="text-3xl font-extrabold text-theme-text">Private access</h1>
          <p className="text-theme-muted/60 text-sm mt-2 font-medium">
            Enter your credentials to enter Curi before the public site loads.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label htmlFor="site-username" className="block text-xs font-bold uppercase tracking-wide text-theme-muted/60 mb-2">
              Username
            </label>
            <input
              id="site-username"
              type="text"
              autoComplete="username"
              className="input w-full"
              placeholder="Your access username"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="site-code" className="block text-xs font-bold uppercase tracking-wide text-theme-muted/60 mb-2">
              Access code
            </label>
            <div className="relative">
              <input
                id="site-code"
                type={showCode ? 'text' : 'password'}
                autoComplete="current-password"
                className="input w-full pr-24"
                placeholder="Your private access code"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-curi-pink"
              >
                {showCode ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            {loading ? 'Verifying…' : 'Unlock Curi'}
          </button>
        </form>

        <p className="text-center text-theme-muted/40 text-xs mt-6 font-medium">
          Authorized access only. Contact the Curi team if you need credentials.
        </p>
      </motion.div>
    </div>
  );
}
