'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Sparkles, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSandbox, setLoadingSandbox] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent" />
          <p className="text-sm text-neutral-400">Loading SnapVault...</p>
        </div>
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    try {
      await signIn('google');
    } catch (err) {
      console.error(err);
      setLoadingGoogle(false);
    }
  };

  const handleSandboxSignIn = async () => {
    setLoadingSandbox(true);
    try {
      await signIn('credentials', { redirect: false });
      router.push('/');
    } catch (err) {
      console.error(err);
      setLoadingSandbox(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background glowing blobs */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-yellow-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          {/* Logo Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/20 mb-6 relative group">
            <Shield className="h-8 w-8 text-neutral-950 transition-transform duration-300 group-hover:scale-110" />
            <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-neutral-100 animate-pulse" />
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-300">
            SnapVault
          </h1>
          <p className="mt-2 text-sm text-neutral-400 max-w-sm">
            Restore, browse, and repair metadata for your Snapchat Memories local archive.
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-neutral-200">Access Your Archive</h2>
              <p className="text-xs text-neutral-400">
                SnapVault runs completely in your browser. None of your memories, metadata, or images are ever uploaded to a server.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Google Login Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loadingGoogle || loadingSandbox}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-neutral-900 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loadingGoogle ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 0, 0)">
                      <path d="M21.35,11.1H12v2.7h5.38C16.88,16.27,14.65,18,12,18c-3.31,0-6-2.69-6-6s2.69-6,6-6c1.47,0,2.81,0.53,3.87,1.43l2.03-2.03C16.21,3.8,14.24,3,12,3C7.03,3,3,7.03,3,12s4.03,9,9,9c4.8,0,8.9-3.4,8.9-9C20.9,11.75,21.35,11.1,21.35,11.1z" fill="#34A853" />
                      <path d="M12,21c4.8,0,8.9-3.4,8.9-9h-8.9v2.7h5.38C16.88,16.27,14.65,18,12,18V21z" fill="#4285F4" />
                      <path d="M12,3C7.03,3,3,7.03,3,12h3c0-3.31,2.69-6,6-6C14.24,3,16.21,3.8,17.9,5.4l2.03-2.03C17.9,2.07,15.1,3,12,3z" fill="#EA4335" fillOpacity="1" />
                      <path d="M12,3c2.24,0,4.21,0.8,5.9,2.4l2.03-2.03C17.9,2.07,15.1,3,12,3z" fill="#FBBC05" />
                    </g>
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-neutral-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-neutral-950 px-2 text-neutral-500">OR TEST LOCAL-FIRST</span>
                </div>
              </div>

              {/* Sandbox Bypass Button */}
              <button
                onClick={handleSandboxSignIn}
                disabled={loadingGoogle || loadingSandbox}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 hover:border-neutral-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loadingSandbox ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-transparent" />
                ) : (
                  <Shield className="h-4 w-4 text-yellow-500" />
                )}
                <span>Local Sandbox Mode (Bypass)</span>
              </button>
            </div>

            <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3 text-xs text-yellow-500/80">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                <strong>Sandbox Mode</strong> requires no setup and is recommended for local testing of ZIP files.
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-center text-xs text-neutral-600">
          SnapVault is an independent project and is not affiliated with Snapchat, Snap Inc., Google, or Apple.
        </p>
      </div>
    </div>
  );
}
