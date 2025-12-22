/**
 * Login.jsx - Cryptocurrency Future Price Prediction Platform
 * 
 * A stunning, modern login page featuring:
 * - Glassmorphism design with frosted glass effects
 * - Animated floating crypto symbols background
 * - Email validation and password show/hide toggle
 * - Remember me, forgot password, and 2FA options
 * - Responsive design for all devices
 * - Micro-interactions and loading states
 */

import "./App.css";
import { useState, useEffect } from "react";
import { authLoginPassword, authRegister } from "./services/api";
import { loginWithGoogle } from "./services/appwrite";

/* ========================================
   ICON COMPONENTS - Crypto & UI Icons
   Using inline SVGs for optimal performance
   ======================================== */

// Chart trending icon for brand - shows upward momentum
function IconChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2">
      {/* Q Shape: Circle + Tail */}
      <path
        d="M12 21a9 9 0 1 1 9-9c0 1.1-.18 2.15-.5 3.12M17 17l4 4"
        stroke="url(#chartGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rising Chart Line inside */}
      <path
        d="M8 12l2.5 2.5 5.5-5.5"
        stroke="url(#chartGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Email/Mail icon with envelope design
function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Lock/Password icon with keyhole
function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

// User/Person icon for name field
function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Eye icon (show password state)
function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// Eye-off icon (hide password state)
function IconEyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Shield icon for 2FA - security indicator
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Google OAuth icon with brand colors
function IconGoogle() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// Guest icon - user silhouette
function IconGuest() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// GitHub OAuth icon
function IconGitHub() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// Loading spinner with animation
function Spinner() {
  return (
    <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 019.17 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Bitcoin floating icon with brand color
function IconBitcoin() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z" fill="#F7931A" />
      <path d="M17.3 10.4c.24-1.6-.98-2.46-2.64-3.03l.54-2.16-1.32-.33-.52 2.1c-.35-.09-.7-.17-1.06-.25l.53-2.11-1.32-.33-.54 2.16c-.29-.07-.57-.13-.85-.2l-1.82-.45-.35 1.41s.98.22.96.24c.53.13.63.49.61.77l-.61 2.46c.04.01.08.02.13.04l-.13-.03-.86 3.44c-.06.16-.23.4-.6.3.01.02-.96-.24-.96-.24l-.66 1.51 1.72.43c.32.08.63.16.94.24l-.55 2.2 1.32.33.54-2.17c.36.1.71.19 1.06.28l-.54 2.15 1.32.33.55-2.2c2.26.43 3.96.26 4.68-1.79.58-1.65-.03-2.6-1.22-3.22.87-.2 1.52-.77 1.7-1.95zm-3.04 4.26c-.41 1.65-3.18.76-4.08.53l.73-2.92c.9.22 3.78.67 3.35 2.39zm.41-4.29c-.37 1.5-2.68.74-3.43.55l.66-2.65c.75.19 3.16.54 2.77 2.1z" fill="#FFF" />
    </svg>
  );
}

// Ethereum floating icon with brand color
function IconEthereum() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#627EEA" />
      <path d="M12.373 3v6.652l5.623 2.513L12.373 3z" fill="#FFF" fillOpacity=".602" />
      <path d="M12.373 3L6.75 12.165l5.623-2.513V3z" fill="#FFF" />
      <path d="M12.373 16.476v4.52l5.627-7.784-5.627 3.264z" fill="#FFF" fillOpacity=".602" />
      <path d="M12.373 20.996v-4.52L6.75 13.212l5.623 7.784z" fill="#FFF" />
      <path d="M12.373 15.43l5.623-3.265-5.623-2.511v5.776z" fill="#FFF" fillOpacity=".2" />
      <path d="M6.75 12.165l5.623 3.265V9.654l-5.623 2.511z" fill="#FFF" fillOpacity=".602" />
    </svg>
  );
}

// Candlestick chart pattern for trading theme
function IconCandlestick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <line x1="6" y1="4" x2="6" y2="20" />
      <rect x="4" y="8" width="4" height="6" fill="#10b981" stroke="#10b981" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <rect x="10" y="6" width="4" height="10" fill="#ef4444" stroke="#ef4444" />
      <line x1="18" y1="6" x2="18" y2="18" />
      <rect x="16" y="9" width="4" height="5" fill="#10b981" stroke="#10b981" />
    </svg>
  );
}

// Solana icon
function IconSolana() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <linearGradient id="solGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="100%" stopColor="#14F195" />
      </linearGradient>
      <circle cx="12" cy="12" r="12" fill="url(#solGrad)" />
      <path d="M7 15.5l2-2h8l-2 2H7zm0-3l2 2h8l-2-2H7zm10-3l-2 2H7l2-2h8z" fill="#fff" />
    </svg>
  );
}

/* ========================================
   FLOATING BACKGROUND COMPONENT
   Animated crypto symbols and geometric shapes
   Creates depth and visual interest
   ======================================== */
function FloatingBackground() {
  return (
    <div className="floatingBg" aria-hidden="true">
      {/* Animated gradient orbs - create ambient lighting effect */}
      <div className="gradientOrb orb1" />
      <div className="gradientOrb orb2" />
      <div className="gradientOrb orb3" />

      {/* Floating crypto icons with different animations */}
      <div className="floatingIcon icon1"><IconBitcoin /></div>
      <div className="floatingIcon icon2"><IconEthereum /></div>
      <div className="floatingIcon icon3"><IconCandlestick /></div>
      <div className="floatingIcon icon4"><IconBitcoin /></div>
      <div className="floatingIcon icon5"><IconSolana /></div>
      <div className="floatingIcon icon6"><IconEthereum /></div>

      {/* Geometric shapes for abstract decoration */}
      <div className="geoShape shape1" />
      <div className="geoShape shape2" />
      <div className="geoShape shape3" />
      <div className="geoShape shape4" />

      {/* Grid pattern overlay for tech aesthetic */}
      <div className="gridPattern" />

      {/* Particle dots */}
      <div className="particle p1" />
      <div className="particle p2" />
      <div className="particle p3" />
      <div className="particle p4" />
      <div className="particle p5" />
    </div>
  );
}

/* ========================================
   MAIN LOGIN COMPONENT
   Handles authentication UI and logic
   ======================================== */

// Back arrow icon
function IconBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Sun icon for light mode
function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

// Moon icon for dark mode
function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export default function Login({ onGuestLogin, onBack, onLogin, darkMode, setDarkMode }) {
  // Form state management
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // UI state management
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [shake, setShake] = useState(false);

  // Load remembered email on component mount
  useEffect(() => {
    try {
      const savedEmail = window.localStorage.getItem("cp_saved_email") || "";
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage errors (e.g., private browsing)
    }
  }, []);

  // Email validation with regex pattern
  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  // Password validation - minimum 8 characters
  const validatePassword = (value) => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    if (value.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  // Trigger shake animation on validation error
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // Form submission handler with validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate inputs before submission
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      triggerShake();
      return;
    }

    setBusy(true);

    try {
      let userData;
      if (mode === "signup") {
        const result = await authRegister(email, password, name || null);
        userData = result.user || { email, name, provider: 'password' };
        setSuccess("Account created successfully! Redirecting...");
      } else {
        const result = await authLoginPassword(email, password);
        userData = result.user || { email, provider: 'password' };
        setSuccess("Login successful! Redirecting...");
      }

      // Handle remember me functionality
      try {
        if (rememberMe) {
          window.localStorage.setItem("cp_saved_email", email);
        } else {
          window.localStorage.removeItem("cp_saved_email");
        }
      } catch {
        // Ignore localStorage errors
      }

      // Call onLogin callback to update app state and go to dashboard
      setTimeout(() => {
        if (onLogin) {
          onLogin(userData);
        } else {
          window.location.href = "/";
        }
      }, 1200);

    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
      triggerShake();
    }

    setBusy(false);
  };

  // Toggle between sign in and sign up modes
  const toggleMode = (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setEmailError("");
    setPasswordError("");
    setMode((m) => (m === "signup" ? "signin" : "signup"));
  };

  return (
    <div className={`loginPage ${darkMode ? 'dark' : 'light'}`}>
      {/* Animated background with floating elements */}
      <FloatingBackground />

      {/* Top navigation bar with back button and theme toggle */}
      <div className="loginTopNav">
        {/* Back button to landing page */}
        {onBack && (
          <button className="backToLanding" onClick={onBack} aria-label="Back to landing page">
            <IconBack />
            <span>Back</span>
          </button>
        )}

        {/* Theme toggle button */}
        {setDarkMode && (
          <button
            className="loginThemeToggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <IconSun /> : <IconMoon />}
          </button>
        )}
      </div>

      <div className="loginContainer">
        {/* Brand header with logo and tagline */}
        <header className="loginBrand">
          <div className="brandIcon">
            <IconChart />
          </div>
          <div className="brandText">
            <h1 className="brandTitle">Quantara</h1>
            <p className="brandSubtitle">AI-Powered Price Forecasting</p>
          </div>
        </header>

        {/* Main login card with glassmorphism effect */}
        <main className={`loginCard ${shake ? "shake" : ""}`}>
          {/* Dynamic title based on mode */}
          <div className="cardHeader">
            <h2 className="loginTitle">
              {mode === "signup" ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="loginSubtitle">
              {mode === "signup"
                ? "Join thousands of crypto traders worldwide"
                : "Sign in to access your predictions"}
            </p>
          </div>

          <form className="loginForm" onSubmit={handleSubmit} noValidate>
            {/* Name field - only visible during signup */}
            {mode === "signup" && (
              <div className="formGroup">
                <label className="formLabel" htmlFor="name">
                  Full Name
                </label>
                <div className="inputWrapper">
                  <span className="inputIcon"><IconUser /></span>
                  <input
                    id="name"
                    type="text"
                    className="formInput"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    disabled={busy}
                  />
                </div>
              </div>
            )}

            {/* Email field with validation */}
            <div className="formGroup">
              <label className="formLabel" htmlFor="email">
                Email Address
              </label>
              <div className={`inputWrapper ${emailError ? "hasError" : ""}`}>
                <span className="inputIcon"><IconMail /></span>
                <input
                  id="email"
                  type="email"
                  className="formInput"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={(e) => validateEmail(e.target.value)}
                  autoComplete="email"
                  disabled={busy}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
              </div>
              {emailError && (
                <span id="email-error" className="fieldError" role="alert">
                  {emailError}
                </span>
              )}
            </div>

            {/* Password field with show/hide toggle */}
            <div className="formGroup">
              <label className="formLabel" htmlFor="password">
                Password
              </label>
              <div className={`inputWrapper ${passwordError ? "hasError" : ""}`}>
                <span className="inputIcon"><IconLock /></span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="formInput"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  disabled={busy}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                />
                <button
                  type="button"
                  className="passwordToggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={busy}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              {passwordError && (
                <span id="password-error" className="fieldError" role="alert">
                  {passwordError}
                </span>
              )}
            </div>

            {/* Options row: Remember me + Forgot password */}
            <div className="optionsRow">
              <label className="checkboxLabel">
                <input
                  type="checkbox"
                  className="checkboxInput"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={busy}
                />
                <span className="checkboxCustom">
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>Remember me</span>
              </label>

              {mode === "signin" && (
                <a href="#" className="forgotLink" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              )}
            </div>

            {/* Error message with icon */}
            {error && (
              <div className="alertError" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Success message with icon */}
            {success && (
              <div className="alertSuccess" role="status">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            {/* Submit button with loading and success states */}
            <button
              type="submit"
              className={`submitButton ${busy ? "loading" : ""} ${success ? "success" : ""}`}
              disabled={busy || !!success}
            >
              {busy ? (
                <>
                  <Spinner />
                  <span>Please wait...</span>
                </>
              ) : success ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Success!</span>
                </>
              ) : (
                <span>{mode === "signup" ? "Create Account" : "Sign In"}</span>
              )}
            </button>

            {/* Divider with "or continue with" */}
            <div className="divider">
              <span>or continue with</span>
            </div>

            {/* OAuth button */}
            <div className="oauthButtons">
              <button
                type="button"
                onClick={loginWithGoogle}
                className="oauthBtn googleBtn"
                aria-label="Continue with Google"
              >
                <IconGoogle />
                <span>Google</span>
              </button>
              <button
                type="button"
                className="oauthBtn guestBtn"
                onClick={() => onGuestLogin && onGuestLogin()}
                aria-label="Continue as Guest"
              >
                <IconGuest />
                <span>Guest</span>
              </button>
            </div>

            {/* Mode toggle: Sign in / Sign up */}
            <p className="modeToggle">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
              {" "}
              <a href="#" onClick={toggleMode} className="modeLink">
                {mode === "signup" ? "Sign in" : "Sign up"}
              </a>
            </p>
          </form>
        </main>


      </div>
    </div>
  );
}
