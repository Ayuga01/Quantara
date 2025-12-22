const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Generate or retrieve stable guest ID from localStorage
function getGuestId() {
  let guestId = localStorage.getItem("cp_guest_id");
  if (!guestId) {
    guestId = `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    localStorage.setItem("cp_guest_id", guestId);
  }
  return guestId;
}

// Clear guest ID (called on logout to reset guest identity)
export function clearGuestId() {
  localStorage.removeItem("cp_guest_id");
}

// Store user email for authenticated requests
let _currentUserEmail = null;
export function setCurrentUserEmail(email) {
  _currentUserEmail = email;
}

async function requestJson(path, options = {}) {
  const headers = {
    ...options.headers,
  };

  // Include user identification: prefer authenticated email, fallback to guest ID
  if (_currentUserEmail) {
    headers["X-User-Email"] = _currentUserEmail;
  } else {
    headers["X-Guest-ID"] = getGuestId();
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Request failed (${res.status})`);
  }
  return await res.json();
}

export async function predictPrice(coin, horizon, stepsAhead, useLiveData = false) {
  const body = {
    coin,
    horizon,
    start_timestamp: new Date().toISOString(),
    steps_ahead: Number(stepsAhead),
    use_live_data: useLiveData,
  };

  return await requestJson("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getCurrentPrices() {
  return await requestJson("/current-prices");
}

export async function authMe() {
  return await requestJson("/auth/me");
}

export async function authLogout() {
  return await requestJson("/auth/logout", { method: "POST" });
}

export async function authLoginPassword(email, password) {
  return await requestJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function authRegister(email, password, name = null) {
  return await requestJson("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
}

export function oauthLoginUrl(provider) {
  return `${API_BASE}/auth/login/${provider}`;
}

// ========================================
// Historical Data
// ========================================

export async function getHistoricalPrices(coin, limit = 168) {
  // Default 168 hours = 7 days of hourly data
  return await requestJson(`/historical/${coin}?limit=${limit}`);
}

// ========================================
// Prediction History
// ========================================

export async function getHistory() {
  return await requestJson("/history");
}

export async function saveHistory(data) {
  return await requestJson("/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteHistory(id) {
  return await requestJson(`/history/${id}`, {
    method: "DELETE",
  });
}

// ========================================
// User Profile
// ========================================

export async function updateProfile(data) {
  return await requestJson("/auth/update-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}