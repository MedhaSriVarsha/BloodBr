import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Heart,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Mail,
  Lock,
  User,
  Calendar,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import { signInSchema, signUpSchema, type SignInFormData, type SignUpFormData } from '../../schemas/authSchemas';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

interface AuthLandingPageProps {
  initialTab?: 'signin' | 'signup';
}

export const AuthLandingPage: React.FC<AuthLandingPageProps> = ({ initialTab = 'signin' }) => {
  const {
    signin,
    signup,
    verifyLoginOtp,
    resendLoginOtp,
    verifyEmail,
    resendVerification,
    loginAsDemoUser,
    loginAsDemoAdmin,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  // Determine initial tab from props or query param ?tab=signup / ?tab=signin
  const queryParams = new URLSearchParams(location.search);
  const tabFromQuery = queryParams.get('tab') === 'signup' ? 'signup' : queryParams.get('tab') === 'signin' ? 'signin' : initialTab;

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(tabFromQuery);
  const [authStep, setAuthStep] = useState<'form' | 'login_otp' | 'email_verification'>('form');
  const [challengeEmail, setChallengeEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app/dashboard';

  // Cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Sign In Form
  const {
    register: registerSignIn,
    handleSubmit: handleSignInSubmit,
    setValue: setSignInValue,
    formState: { errors: signInErrors, isSubmitting: isSignInSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: 'marcus.vance@example.org',
      password: 'Password123!',
    },
  });

  // Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSignUpSubmit,
    watch: watchSignUp,
    formState: { errors: signUpErrors, isSubmitting: isSignUpSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      dateOfBirth: '2000-01-15',
      email: '',
      password: '',
      confirmPassword: '',
      termsAccepted: true,
    },
  });

  // Watch DOB to calculate age live
  const dobValue = watchSignUp('dateOfBirth');
  useEffect(() => {
    if (dobValue) {
      const birth = new Date(dobValue);
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        setCalculatedAge(age >= 0 ? age : null);
      } else {
        setCalculatedAge(null);
      }
    }
  }, [dobValue]);

  // 1. Handle Sign In
  const onSignIn = async (data: SignInFormData) => {
    setAuthError(null);
    setSuccessNotice(null);
    try {
      const result = await signin({
        email: data.email.trim(),
        password: data.password,
      });

      setChallengeEmail(result.email || data.email.trim());

      if (result.requiresEmailVerification) {
        // Step 3: Unverified account flow
        setAuthStep('email_verification');
        setResendCooldown(60);
        setSuccessNotice('Account not yet verified. An activation code has been dispatched to your email.');
      } else if (result.requiresOtp) {
        // Step 4 & 5: Credentials valid -> Move to Login OTP challenge
        setAuthStep('login_otp');
        setResendCooldown(60);
        setSuccessNotice('Verification code dispatched. Please check your inbox.');
      } else {
        // In case OTP was bypassed or session directly issued
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Authentication failed. Please verify your credentials.';
      setAuthError(msg);
    }
  };

  // 2. Handle Sign Up
  const onSignUp = async (data: SignUpFormData) => {
    setAuthError(null);
    setSuccessNotice(null);
    try {
      const result = await signup({
        username: data.username.trim(),
        dateOfBirth: data.dateOfBirth,
        email: data.email.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
        termsAccepted: data.termsAccepted,
      });

      setChallengeEmail(result.email || data.email.trim());
      setAuthStep('email_verification');
      setResendCooldown(60);
      setSuccessNotice(result.message || 'Account created! Verification code sent to your email.');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Registration failed. Please check your details.';
      setAuthError(msg);
    }
  };

  // 3. Handle Verify Login OTP
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit numeric verification code.');
      return;
    }
    setAuthError(null);
    setIsVerifyingOtp(true);
    try {
      const session = await verifyLoginOtp({
        email: challengeEmail,
        code: otpCode.trim(),
      });
      setSuccessNotice('Login verified! Redirecting to BloodConnect dashboard...');
      setTimeout(() => {
        if (session.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Invalid or expired OTP code. Please retry.';
      setAuthError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 4. Handle Verify Email Registration OTP
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('Please enter the 6-digit numeric verification code.');
      return;
    }
    setAuthError(null);
    setIsVerifyingOtp(true);
    try {
      const session = await verifyEmail({
        email: challengeEmail,
        code: otpCode.trim(),
      });
      setSuccessNotice('Email verified successfully! Welcome to BloodConnect.');
      setTimeout(() => {
        if (session.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      }, 1000);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Invalid or expired verification code.';
      setAuthError(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setAuthError(null);
    setIsResending(true);
    try {
      if (authStep === 'login_otp') {
        const res = await resendLoginOtp({ email: challengeEmail });
        setSuccessNotice(res.message || 'A fresh login OTP has been sent to your email.');
      } else {
        const res = await resendVerification({ email: challengeEmail });
        setSuccessNotice(res.message || 'A fresh account verification code has been sent.');
      }
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Failed to resend code. Please wait before retrying.';
      setAuthError(msg);
    } finally {
      setIsResending(false);
    }
  };

  // 1-Tap Quick Demo Donor
  const handleQuickDemoDonor = () => {
    setSignInValue('email', 'marcus.vance@example.org');
    setSignInValue('password', 'Password123!');
  };

  // 1-Tap Quick Demo Admin
  const handleQuickDemoAdmin = () => {
    setSignInValue('email', 'admin@bloodbridge.org');
    setSignInValue('password', 'AdminPassword2026!');
  };

  return (
    <Card className="shadow-xl border-line-border overflow-hidden bg-white">
      {/* Brand Header */}
      <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-rose-600 p-6 text-white text-center relative">
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm mx-auto flex items-center justify-center mb-3 shadow-inner ring-1 ring-white/30">
          <Heart className="w-6 h-6 fill-white text-white animate-pulse" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">BloodConnect</h1>
        <p className="text-xs text-rose-100 font-medium mt-1">
          Secure Savior &amp; Donor Authentication
        </p>
      </div>

      <CardContent className="p-6 sm:p-8 space-y-6">
        {/* Step: OTP Verification (Login or Account Activation) */}
        {authStep !== 'form' ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center shadow-sm">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-ink-main tracking-tight">
                {authStep === 'login_otp' ? 'Two-Factor Authentication' : 'Verify Your Email'}
              </h2>
              <p className="text-xs text-ink-secondary leading-relaxed max-w-xs mx-auto">
                {authStep === 'login_otp'
                  ? 'To protect savior records, enter the single-use 6-digit code sent to:'
                  : 'Enter the 6-digit account activation code sent to:'}
                <br />
                <strong className="text-ink-main font-semibold">{challengeEmail}</strong>
              </p>
            </div>

            {authError && <ErrorBanner message={authError} onRetry={() => setAuthError(null)} />}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            <form
              onSubmit={authStep === 'login_otp' ? handleVerifyLoginOtp : handleVerifyEmailOtp}
              className="space-y-5"
            >
              <div>
                <label htmlFor="otp-code-input" className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider text-center mb-2">
                  6-Digit Verification Code
                </label>
                <input
                  id="otp-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full text-center text-3xl tracking-[0.5em] font-mono font-black py-3 px-4 border-2 border-line-border rounded-xl focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-all text-ink-main"
                  autoFocus
                />
                <p className="text-[11px] text-ink-muted text-center mt-2">
                  Code expires in 5 minutes &bull; Maximum 5 verification attempts
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isVerifyingOtp}
                className="w-full justify-center shadow-md font-bold"
              >
                {authStep === 'login_otp' ? 'Verify & Access Dashboard' : 'Activate Account & Continue'}
              </Button>

              <div className="flex items-center justify-between text-xs text-ink-secondary pt-2">
                <span>Didn&apos;t receive code?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center min-h-[44px] px-2 rounded"
                >
                  <RotateCw className={`w-3.5 h-3.5 mr-1 ${isResending ? 'animate-spin' : ''}`} />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="text-center pt-2 border-t border-line-border">
                <button
                  type="button"
                  onClick={() => {
                    setAuthStep('form');
                    setOtpCode('');
                    setAuthError(null);
                    setSuccessNotice(null);
                  }}
                  className="text-xs text-ink-secondary hover:text-brand-600 font-semibold"
                >
                  &larr; Return to {activeTab === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Step: Form Selection (Sign In or Sign Up) */
          <>
            {/* Dual Options Tab Selector */}
            <div className="flex rounded-xl bg-gray-100 p-1 text-sm font-semibold shadow-inner">
              <button
                type="button"
                id="auth-tab-signin"
                onClick={() => {
                  setActiveTab('signin');
                  setAuthError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2.5 text-center rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'signin'
                    ? 'bg-white text-brand-600 shadow-sm font-bold ring-1 ring-black/5'
                    : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Sign In
              </button>
              <button
                type="button"
                id="auth-tab-signup"
                onClick={() => {
                  setActiveTab('signup');
                  setAuthError(null);
                  setSuccessNotice(null);
                }}
                className={`flex-1 py-2.5 text-center rounded-lg transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'signup'
                    ? 'bg-white text-brand-600 shadow-sm font-bold ring-1 ring-black/5'
                    : 'text-ink-secondary hover:text-ink-main'
                }`}
              >
                <User className="w-4 h-4" />
                Sign Up
              </button>
            </div>

            {authError && <ErrorBanner message={authError} onRetry={() => setAuthError(null)} />}

            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* TAB 1: SIGN IN */}
            {activeTab === 'signin' ? (
              <form onSubmit={handleSignInSubmit(onSignIn)} className="space-y-4">
                <Input
                  label="Registered Email Address"
                  type="email"
                  placeholder="e.g. savior@bloodconnect.org"
                  autoComplete="email"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                  error={signInErrors.email?.message}
                  {...registerSignIn('email')}
                />

                <div className="space-y-1">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Enter your account password"
                    autoComplete="current-password"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signInErrors.password?.message}
                    {...registerSignIn('password')}
                  />
                  <div className="flex justify-end pt-1">
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 focus:outline-none"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSignInSubmitting}
                  className="w-full justify-center mt-2 shadow-md font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Sign In &amp; Send OTP
                </Button>

                {/* 1-Tap Credentials Pill for Convenience */}
                <div className="pt-4 border-t border-line-border space-y-2.5">
                  <div className="flex items-center text-[11px] text-ink-secondary font-semibold uppercase tracking-wider text-amber-800">
                    <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Quick Test Credentials (1-Tap):
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleQuickDemoDonor}
                      className="p-2.5 rounded-lg border border-brand-200 bg-brand-50/70 hover:bg-brand-100 text-left transition-colors text-xs"
                    >
                      <div className="font-bold text-brand-700">Marcus Vance</div>
                      <div className="text-[10px] text-ink-secondary">Donor (O+ Universal)</div>
                      <div className="text-[9px] text-brand-600 font-mono mt-0.5">Password123!</div>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuickDemoAdmin}
                      className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-left transition-colors text-xs"
                    >
                      <div className="font-bold text-amber-800">Dr. Evelyn Reed</div>
                      <div className="text-[10px] text-ink-secondary">Operations Lead (Admin)</div>
                      <div className="text-[9px] text-amber-700 font-mono mt-0.5">AdminPassword2026!</div>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* TAB 2: SIGN UP */
              <form onSubmit={handleSignUpSubmit(onSignUp)} className="space-y-4">
                <Input
                  label="Username"
                  placeholder="e.g. jordan_savior"
                  required
                  leftIcon={<User className="w-4 h-4" />}
                  helperText="Choose a unique savior handle (letters, numbers, _.-)"
                  error={signUpErrors.username?.message}
                  {...registerSignUp('username')}
                />

                <div>
                  <Input
                    label="Date of Birth"
                    type="date"
                    required
                    leftIcon={<Calendar className="w-4 h-4" />}
                    error={signUpErrors.dateOfBirth?.message}
                    {...registerSignUp('dateOfBirth')}
                  />
                  {calculatedAge !== null && (
                    <div className="mt-1.5 flex items-center text-xs">
                      {calculatedAge >= 18 ? (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Age {calculatedAge} &bull; Eligible for voluntary blood donation
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-medium border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          Age {calculatedAge} &bull; Youth Advocate (Voluntary donation unlocks at age 18)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="e.g. jordan@example.org"
                  required
                  leftIcon={<Mail className="w-4 h-4" />}
                  helperText="A single-use 6-digit verification code will be sent to this email."
                  error={signUpErrors.email?.message}
                  {...registerSignUp('email')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min 8 characters"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signUpErrors.password?.message}
                    {...registerSignUp('password')}
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-type password"
                    required
                    leftIcon={<Lock className="w-4 h-4" />}
                    error={signUpErrors.confirmPassword?.message}
                    {...registerSignUp('confirmPassword')}
                  />
                </div>

                <div className="pt-2">
                  <Checkbox
                    label={
                      <span className="text-xs text-ink-secondary">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" className="text-brand-600 underline font-semibold">
                          Terms of Participation
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" className="text-brand-600 underline font-semibold">
                          Privacy Policy
                        </Link>
                        .
                      </span>
                    }
                    {...registerSignUp('termsAccepted')}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSignUpSubmitting}
                  className="w-full justify-center mt-2 shadow-md font-bold"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Account &amp; Send OTP
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
