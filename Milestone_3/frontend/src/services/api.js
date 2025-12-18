const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `Request failed (${res.status})`);
  }
  return await res.json();
}

export async function predictPrice(coin, horizon, stepsAhead) {
  const body = {
    coin,
    horizon,
    start_timestamp: new Date().toISOString(),
    steps_ahead: Number(stepsAhead),
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