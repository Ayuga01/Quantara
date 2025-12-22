/**
 * UserProfile.jsx - User profile management with name/password update
 */

import { useState } from "react";

function IconUser() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" strokeLinecap="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
    </svg>
  );
}

export default function UserProfile({ user, onUpdateProfile }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isOAuthUser = user?.provider === "google" || user?.provider === "github" || user?.provider === "appwrite";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword && !currentPassword && !isOAuthUser) {
      setError("Please enter your current password");
      return;
    }

    setLoading(true);
    try {
      await onUpdateProfile({
        name: name.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      setSuccess("Profile updated successfully!");
      setEditing(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setName(user?.name || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar-large">
            {user?.picture ? (
              <img src={user.picture} alt={user.name || "User"} />
            ) : (
              <span>{(user?.name || user?.email || "U")[0].toUpperCase()}</span>
            )}
          </div>
          <div className="profile-header-info">
            <h2>{user?.name || "User"}</h2>
            <p className="profile-email">
              <IconMail /> {user?.email}
            </p>
            {user?.provider && (
              <span className="profile-provider-badge">
                {user.provider === "google" && "🔵 Google Account"}
                {user.provider === "github" && "⚫ GitHub Account"}
                {user.provider === "appwrite" && "🔵 Google Account"}
                {user.provider === "password" && "🔐 Email/Password"}
              </span>
            )}
          </div>
          {!editing && (
            <button className="profile-edit-btn" onClick={() => setEditing(true)}>
              <IconEdit /> Edit Profile
            </button>
          )}
        </div>

        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        {editing ? (
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="profile-form-section">
              <h3>Personal Information</h3>
              
              <div className="profile-field">
                <label htmlFor="name">Display Name</label>
                <div className="profile-input-wrapper">
                  <IconUser />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              </div>
            </div>

            {!isOAuthUser && (
              <div className="profile-form-section">
                <h3>Change Password</h3>
                <p className="profile-form-hint">Leave blank to keep current password</p>

                <div className="profile-field">
                  <label htmlFor="currentPassword">Current Password</label>
                  <div className="profile-input-wrapper">
                    <IconLock />
                    <input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label htmlFor="newPassword">New Password</label>
                  <div className="profile-input-wrapper">
                    <IconLock />
                    <input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 8 chars)"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="profile-field">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <div className="profile-input-wrapper">
                    <IconLock />
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            )}

            {isOAuthUser && (
              <div className="profile-oauth-notice">
                <p>🔒 Password management is handled by your OAuth provider ({user.provider}).</p>
              </div>
            )}

            <div className="profile-form-actions">
              <button type="button" className="profile-btn-cancel" onClick={handleCancel} disabled={loading}>
                <IconX /> Cancel
              </button>
              <button type="submit" className="profile-btn-save" disabled={loading}>
                {loading ? "Saving..." : <><IconCheck /> Save Changes</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-info-grid">
            <div className="profile-info-item">
              <span className="profile-info-label">Email</span>
              <span className="profile-info-value">{user?.email}</span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Account Type</span>
              <span className="profile-info-value">
                {isOAuthUser ? "OAuth (Social Login)" : "Email/Password"}
              </span>
            </div>
            <div className="profile-info-item">
              <span className="profile-info-label">Member Since</span>
              <span className="profile-info-value">
                {user?.created_at 
                  ? new Date(user.created_at).toLocaleDateString() 
                  : "N/A"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
