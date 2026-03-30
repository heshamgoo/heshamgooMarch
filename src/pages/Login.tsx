import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, Loader2, ArrowRight, CheckCircle2, ShieldCheck, Award, Anchor, Star, FileText } from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck,
  Award,
  Anchor,
  CheckCircle2,
  Lock,
  Star,
  FileText,
  Building2
};

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const { settings, init: initSettings } = useSettingsStore();
  const { user, isLoading: authLoading, login, resetPassword } = useAuthStore();

  useEffect(() => {
    initSettings();
  }, [initSettings]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setResetSent(true);
      } else {
        await login(email, password, rememberMe);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A192F]">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0A192F] font-sans selection:bg-[#D4AF37] selection:text-[#0A192F]">
      {/* Left side - Maritime Background & Branding */}
      <div className="hidden md:flex md:w-5/12 relative overflow-hidden items-center justify-center">
        {/* High-quality maritime background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center transform scale-105 transition-transform duration-10000 hover:scale-100"
          style={{ 
            backgroundImage: `url('${settings?.loginBgUrl || '/diver-bg.jpg'}')`
          }}
        ></div>
        
        {/* Deep Navy & Purple Gradient Overlay - Balanced for image visibility and text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A192F]/60 via-[#2E1065]/40 to-[#0A192F]/70 z-0"></div>
        
        <div className="relative z-10 text-white p-12 flex flex-col h-full justify-between w-full max-w-lg">
          <div className="mt-8">
            <div className="mb-8 inline-flex items-center justify-center w-full max-w-[320px]">
              {(settings?.loginLogoUrl || settings?.logoUrl) ? (
                <img src={settings.loginLogoUrl || settings.logoUrl} alt="Porto Marine Services" className="w-full h-auto object-contain drop-shadow-2xl" />
              ) : (
                <Anchor className="h-24 w-24 text-[#D4AF37] drop-shadow-2xl" />
              )}
            </div>
            <h1 className="flex flex-col text-[#D4AF37] mb-8 drop-shadow-xl">
              <span className="text-[3.4rem] font-light leading-none tracking-tight">{settings?.loginCompanyNameLine1 || 'Porto Marine'}</span>
              <span className="text-[2.6rem] font-bold leading-none tracking-[0.06em] mt-2">{settings?.loginCompanyNameLine2 || 'Services L.L.C'}</span>
            </h1>
            <div className="flex flex-col">
              <div className="w-12 h-[2px] bg-[#D4AF37] mb-5 opacity-80"></div>
              <p className="flex flex-col uppercase drop-shadow-2xl">
                <span className="text-xl md:text-2xl font-light tracking-[0.35em] text-slate-200 mb-2">{settings?.loginSloganLine1 || 'Leading With'}</span>
                <span className="text-4xl md:text-5xl font-bold tracking-[0.15em] text-white">{settings?.loginSloganLine2 || 'Passion'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-5 mb-8">
            {(settings?.loginCertifications || [
              { title: 'Enterprise-Grade Security', description: 'End-to-end encrypted connection', icon: 'ShieldCheck' },
              { title: 'ISO 9001:2015 Certified', description: 'Global standard for quality management', icon: 'Award' }
            ]).map((cert, index) => {
              const IconComponent = ICON_MAP[cert.icon] || Award;
              return (
                <div key={index} className="flex items-center space-x-4 bg-white/5 p-4 rounded-xl backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/10">
                  <IconComponent className="w-8 h-8 text-[#D4AF37]" />
                  <div>
                    <p className="text-sm font-semibold text-white tracking-wide">{cert.title}</p>
                    <p className="text-xs text-slate-400">{cert.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative bg-[#0A192F]">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2E1065] rounded-full mix-blend-screen filter blur-[150px] opacity-20 animate-pulse pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#0A192F] rounded-full mix-blend-screen filter blur-[100px] opacity-40 pointer-events-none"></div>
        
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="md:hidden flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-4 shadow-xl">
              {(settings?.loginLogoUrl || settings?.logoUrl) ? (
                <img src={settings.loginLogoUrl || settings.logoUrl} alt="Porto Marine Services" className="h-10 w-auto object-contain" />
              ) : (
                <Anchor className="h-8 w-8 text-[#D4AF37]" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              {settings?.loginCompanyNameLine1 || 'Porto Marine'} {settings?.loginCompanyNameLine2 || 'Services L.L.C'}
            </h1>
          </div>

          <div>
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              {isForgotPassword ? 'Reset Password' : 'Executive Login'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {isForgotPassword 
                ? "Enter your corporate email to receive a secure reset link."
                : "Authenticate to access the management portal."}
            </p>
          </div>
          
          {resetSent ? (
            <div className="bg-[#112240] border border-[#D4AF37]/30 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#D4AF37]/10 mb-6 border border-[#D4AF37]/20">
                <CheckCircle2 className="h-8 w-8 text-[#D4AF37]" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Check your email</h3>
              <p className="text-sm text-slate-400 mb-8">
                We sent a secure password reset link to <br/><span className="font-semibold text-white mt-1 block">{email}</span>
              </p>
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetSent(false);
                  setError('');
                }}
                className="text-sm font-medium text-[#D4AF37] hover:text-[#FBBF24] transition-colors"
              >
                &larr; Back to secure login
              </button>
            </div>
          ) : (
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-950/50 border-l-4 border-rose-500 p-4 rounded-r-xl backdrop-blur-sm">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-rose-200">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Corporate Email</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full pl-11 pr-4 py-3.5 bg-[#112240] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] sm:text-sm transition-all shadow-inner"
                      placeholder="executive@portomarine.com"
                    />
                  </div>
                </div>
                
                {!isForgotPassword && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-300">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                        }}
                        className="text-sm font-medium text-[#D4AF37] hover:text-[#FBBF24] transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none block w-full pl-11 pr-4 py-3.5 bg-[#112240] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] sm:text-sm transition-all shadow-inner"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!isForgotPassword && (
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-[#D4AF37] focus:ring-[#D4AF37] border-slate-600 bg-[#112240] rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-400">
                    Remember me for 30 days
                  </label>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-[#0A192F] bg-gradient-to-r from-[#D4AF37] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A192F] focus:ring-[#D4AF37] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)]"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#0A192F]" />
                  ) : (
                    <>
                      {isForgotPassword ? 'Send Reset Link' : 'Secure Sign In'}
                      {!isForgotPassword && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                    </>
                  )}
                </button>
              </div>

              {isForgotPassword && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError('');
                    }}
                    className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    &larr; Back to login
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Trust signal at bottom */}
          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col items-center justify-center space-y-2 text-slate-500 text-xs">
            <div className="flex items-center space-x-2">
              <Lock className="w-3.5 h-3.5" />
              <span>Secure 256-bit SSL Encryption</span>
            </div>
            <p>&copy; {new Date().getFullYear()} {settings?.loginCompanyNameLine1 || 'Porto Marine'} {settings?.loginCompanyNameLine2 || 'Services L.L.C'}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
