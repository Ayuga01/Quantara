import { useEffect, useState } from "react";
import { authLogout, authMe, setCurrentUserEmail, clearGuestId } from "./services/api";
import { getCurrentUser, appwriteLogout } from "./services/appwrite";
import "./App.css";
import "./LandingPage.css";
import Login from "./Login";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = window.localStorage.getItem("cp_dark_mode");
      return saved !== null ? saved === "true" : true; // Default to dark mode
    } catch {
      return true;
    }
  });
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return window.localStorage.getItem("cp_guest_mode") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // First check Appwrite session (Google OAuth)
        const appwriteUser = await getCurrentUser();
        if (!cancelled && appwriteUser) {
          const user = { email: appwriteUser.email, name: appwriteUser.name, provider: 'appwrite' };
          setMe(user);
          setCurrentUserEmail(user.email); // Sync with API service
          setAuthChecked(true);
          return;
        }
        // Then check backend session (email/password)
        const user = await authMe();
        if (!cancelled) {
          setMe(user);
          setCurrentUserEmail(user?.email || null); // Sync with API service
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setCurrentUserEmail(null); // Clear on error
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Logout from Appwrite if logged in via Google OAuth
      await appwriteLogout();
      // Also logout from backend if logged in via email/password
      await authLogout();
    } finally {
      setMe(null);
      setIsGuest(false);
      setShowLogin(false);
      setCurrentUserEmail(null); // Clear user email from API service
      clearGuestId(); // Reset guest ID so new guest gets fresh identity
      try { window.localStorage.removeItem("cp_guest_mode"); } catch { }
    }
  };

  // Save dark mode preference
  useEffect(() => {
    try {
      window.localStorage.setItem("cp_dark_mode", String(darkMode));
    } catch { }
  }, [darkMode]);

  if (!authChecked) {
    return (
      <div className="app">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  // Show landing page first, then login when user clicks "Get Started"
  if (!me && !isGuest && !showLogin) {
    return (
      <LandingPage
        onGetStarted={() => setShowLogin(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  if (!me && !isGuest && showLogin) {
    return <Login
      onGuestLogin={() => {
        try { window.localStorage.setItem("cp_guest_mode", "true"); } catch { }
        setCurrentUserEmail(null); // Guest uses guest ID
        setIsGuest(true);
      }}
      onBack={() => setShowLogin(false)}
      onLogin={(user) => {
        setMe(user);
        setCurrentUserEmail(user?.email || null); // Sync email with API
      }}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    />;
  }

  // Authenticated or guest user - show Dashboard
  return (
    <Dashboard
      user={me}
      isGuest={isGuest}
      onLogout={handleLogout}
      onUserUpdate={(updatedUser) => setMe(prev => ({ ...prev, ...updatedUser }))}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
    />
  );
}

export default App;