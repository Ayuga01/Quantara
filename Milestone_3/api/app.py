# app.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, Tuple, Any
from datetime import datetime
import pandas as pd
import numpy as np
import joblib
import os
from pathlib import Path
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import re
import base64
import hashlib
import hmac
import secrets
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

app = FastAPI()

# Frontend origin for CORS + OAuth redirect
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173")

# Cookie-based auth needs explicit origins (not "*")
# Include both localhost and 127.0.0.1 since browsers treat them as different origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Server-side session cookie for login
AUTH_SECRET = os.environ.get("AUTH_SECRET", "dev-change-me")
app.add_middleware(
    SessionMiddleware,
    secret_key=AUTH_SECRET,
    session_cookie="crypto_session",
    # Use "none" for cross-origin requests (frontend on 5173, backend on 8000)
    # Note: SameSite=None requires Secure=True in production
    same_site="none",
    max_age=60 * 60 * 24 * 7,  # 7 days
    https_only=os.environ.get("AUTH_HTTPS_ONLY", "0") == "1",
)

oauth = OAuth()

# Google (OpenID Connect)
oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# GitHub (OAuth2)
oauth.register(
    name="github",
    client_id=os.environ.get("GITHUB_CLIENT_ID"),
    client_secret=os.environ.get("GITHUB_CLIENT_SECRET"),
    authorize_url="https://github.com/login/oauth/authorize",
    access_token_url="https://github.com/login/oauth/access_token",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "read:user user:email"},
)

VALID_OAUTH_PROVIDERS = {"google", "github"}


class PredictRequest(BaseModel):
    coin: str
    horizon: str
    start_timestamp: Optional[datetime] = None
    steps_ahead: int = Field(default=0, ge=0, le=500)
    use_live_data: bool = Field(default=False, description="Use live Binance data instead of static CSV")


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class PasswordLoginRequest(BaseModel):
    email: str
    password: str


BASE_DIR = "/Users/ayushgupta/Desktop/ML-Driven-Web-Platform-for-Cryptocurrency-Price-Forecasting_November_Batch-5_2025"
MODEL_DIR = f"{BASE_DIR}/Milestone_2/models"
DATA_DIR  = f"{BASE_DIR}/Milestone_1/data"

# Prefer repo-relative paths (works across machines). If you *need* to override,
# set BASE_DIR via environment variable.
_THIS_DIR = Path(__file__).resolve().parent
BASE_DIR = Path(os.environ.get("BASE_DIR", str(_THIS_DIR.parent.parent))).resolve()
MODEL_DIR = (BASE_DIR / "Milestone_2" / "models").resolve()
DATA_DIR = (BASE_DIR / "Milestone_1" / "data").resolve()

# Auth DB (SQLite) for email/password login
AUTH_DB_PATH = Path(os.environ.get("AUTH_DB_PATH", str((_THIS_DIR / "auth.db").resolve())))

model_cache = {}
scaler_cache = {}

SUPPORTED_COINS = {"bitcoin", "ethereum", "solana", "cardano", "binancecoin"}
SUPPORTED_HORIZONS = {"1h", "24h"}

BINANCE_SYMBOLS = {
    "bitcoin": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "solana": "SOLUSDT",
    "cardano": "ADAUSDT",
    "binancecoin": "BNBUSDT",
}

# Live data cache: {coin: {"df": DataFrame, "fetched_at": timestamp}}
_live_data_cache: dict = {}
LIVE_DATA_CACHE_TTL = 300  # 5 minutes


def _fetch_binance_klines(coin: str, limit: int = 100) -> pd.DataFrame:
    """Fetch recent klines from Binance API with caching."""
    now = time.time()
    cached = _live_data_cache.get(coin)
    if cached and (now - cached["fetched_at"]) < LIVE_DATA_CACHE_TTL:
        return cached["df"].copy()

    symbol = BINANCE_SYMBOLS.get(coin)
    if not symbol:
        raise HTTPException(status_code=400, detail=f"No Binance symbol for {coin}")

    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1h&limit={limit}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CryptoForecast/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance API error: {e}")

    # Parse klines: [open_time, open, high, low, close, volume, close_time, ...]
    rows = []
    for k in data:
        rows.append({
            "open_time": pd.Timestamp(k[0], unit="ms", tz="UTC").tz_localize(None),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })
    df = pd.DataFrame(rows).set_index("open_time").sort_index()
    df = _compute_features(df)

    _live_data_cache[coin] = {"df": df, "fetched_at": now}
    return df.copy()


def _compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Compute technical features from OHLCV data."""
    df = df.copy()
    df["return_1h"] = df["close"].pct_change().fillna(0)
    # Use rolling std of RETURNS (not prices) to match preprocessing pipeline
    df["volatility_24h"] = df["return_1h"].rolling(24, min_periods=1).std().fillna(0)
    df["ma_24"] = df["close"].rolling(24, min_periods=1).mean()
    df["ma_168"] = df["close"].rolling(168, min_periods=1).mean()
    df["ma_ratio"] = (df["ma_24"] / df["ma_168"]).fillna(1)
    df["vol_change"] = df["volume"].pct_change().fillna(0)
    df["missing_flag"] = 0
    # Fill NaN values
    df = df.ffill().bfill().fillna(0)
    return df


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_auth_db() -> None:
    AUTH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT,
                password_salt_b64 TEXT NOT NULL,
                password_hash_b64 TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return base64.b64encode(salt).decode("ascii"), base64.b64encode(dk).decode("ascii")


def _verify_password(password: str, salt_b64: str, hash_b64: str) -> bool:
    try:
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(hash_b64.encode("ascii"))
    except Exception:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return hmac.compare_digest(dk, expected)


@app.get("/auth/login/{provider}")
async def auth_login(provider: str, request: Request):
    if provider not in VALID_OAUTH_PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")

    if provider == "google" and (not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET")):
        raise HTTPException(status_code=500, detail="Google OAuth env vars are not set")
    if provider == "github" and (not os.environ.get("GITHUB_CLIENT_ID") or not os.environ.get("GITHUB_CLIENT_SECRET")):
        raise HTTPException(status_code=500, detail="GitHub OAuth env vars are not set")

    redirect_uri = str(request.url_for("auth_callback", provider=provider))
    client = oauth.create_client(provider)
    return await client.authorize_redirect(request, redirect_uri)


@app.post("/auth/register")
async def auth_register(req: RegisterRequest, request: Request):
    email = (req.email or "").strip().lower()
    password = req.password or ""
    name = (req.name or "").strip() or None

    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    salt_b64, hash_b64 = _hash_password(password)
    created_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    try:
        with _db_connect() as conn:
            conn.execute(
                "INSERT INTO users (email, name, password_salt_b64, password_hash_b64, created_at) VALUES (?, ?, ?, ?, ?)",
                (email, name, salt_b64, hash_b64, created_at),
            )
            conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = {"provider": "password", "sub": email, "email": email, "name": name, "picture": None}
    request.session["user"] = user
    return {"ok": True, "user": user}


@app.post("/auth/login")
async def auth_login_password(req: PasswordLoginRequest, request: Request):
    email = (req.email or "").strip().lower()
    password = req.password or ""

    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    with _db_connect() as conn:
        row = conn.execute(
            "SELECT email, name, password_salt_b64, password_hash_b64 FROM users WHERE email = ?",
            (email,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _verify_password(password, row["password_salt_b64"], row["password_hash_b64"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = {
        "provider": "password",
        "sub": row["email"],
        "email": row["email"],
        "name": row["name"],
        "picture": None,
    }
    request.session["user"] = user
    return {"ok": True, "user": user}


@app.get("/auth/callback/{provider}", name="auth_callback")
async def auth_callback(provider: str, request: Request):
    if provider not in VALID_OAUTH_PROVIDERS:
        raise HTTPException(status_code=404, detail="Unknown provider")

    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)

    user = None
    if provider == "google":
        userinfo = await client.parse_id_token(request, token)
        user = {
            "provider": "google",
            "sub": userinfo.get("sub"),
            "email": userinfo.get("email"),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
        }

    if provider == "github":
        gh_user = (await client.get("user", token=token)).json()
        emails = (await client.get("user/emails", token=token)).json()
        primary_email = None
        if isinstance(emails, list):
            for e in emails:
                if e.get("primary") and e.get("verified"):
                    primary_email = e.get("email")
                    break
            if not primary_email and len(emails) > 0:
                primary_email = emails[0].get("email")

        user = {
            "provider": "github",
            "sub": str(gh_user.get("id")),
            "email": primary_email,
            "name": gh_user.get("name") or gh_user.get("login"),
            "picture": gh_user.get("avatar_url"),
        }

    if not user or not user.get("sub"):
        raise HTTPException(status_code=400, detail="Login failed")

    request.session["user"] = user
    return RedirectResponse(url=f"{FRONTEND_URL}/")


@app.get("/auth/me")
async def auth_me(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@app.post("/auth/logout")
async def auth_logout(request: Request):
    request.session.clear()
    return JSONResponse({"ok": True})


# ========================================
# Profile Update
# ========================================

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = None


@app.post("/auth/update-profile")
async def update_profile(req: UpdateProfileRequest, request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Only allow password changes for password-based users
    if user.get("provider") != "password":
        if req.newPassword:
            raise HTTPException(status_code=400, detail="OAuth users cannot change password")
        # OAuth users can update name in session (not persisted to DB)
        if req.name:
            user["name"] = req.name.strip()
            request.session["user"] = user
        return {"ok": True, "user": user}
    
    email = user.get("email")
    updates = {}
    
    # Handle name update
    if req.name is not None:
        updates["name"] = req.name.strip() or None
    
    # Handle password change
    if req.newPassword:
        if not req.currentPassword:
            raise HTTPException(status_code=400, detail="Current password required")
        if len(req.newPassword) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        
        # Verify current password
        with _db_connect() as conn:
            row = conn.execute(
                "SELECT password_salt_b64, password_hash_b64 FROM users WHERE email = ?",
                (email,),
            ).fetchone()
        
        if not row or not _verify_password(req.currentPassword, row["password_salt_b64"], row["password_hash_b64"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        salt_b64, hash_b64 = _hash_password(req.newPassword)
        updates["password_salt_b64"] = salt_b64
        updates["password_hash_b64"] = hash_b64
    
    if updates:
        with _db_connect() as conn:
            set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
            conn.execute(f"UPDATE users SET {set_clause} WHERE email = ?", (*updates.values(), email))
            conn.commit()
        
        if "name" in updates:
            user["name"] = updates["name"]
            request.session["user"] = user
    
    return {"ok": True, "user": user}


# ========================================
# Historical Price Data
# ========================================

@app.get("/historical/{coin}")
async def get_historical(coin: str, limit: int = 168):
    """Fetch historical klines from Binance for charting."""
    if coin not in SUPPORTED_COINS:
        raise HTTPException(status_code=400, detail=f"Unsupported coin: {coin}")
    
    symbol = BINANCE_SYMBOLS.get(coin)
    if not symbol:
        raise HTTPException(status_code=400, detail=f"No Binance symbol for {coin}")
    
    # Limit to max 1000 (Binance limit)
    limit = min(max(1, limit), 1000)
    
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1h&limit={limit}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CryptoForecast/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance API error: {e}")
    
    # Parse klines: [open_time, open, high, low, close, volume, ...]
    prices = []
    for k in data:
        # Keep timestamp in UTC with Z suffix so browser converts to local time
        utc_time = pd.Timestamp(k[0], unit="ms", tz="UTC")
        prices.append({
            "timestamp": utc_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "price": float(k[4]),  # close price
        })
    
    return {
        "coin": coin,
        "symbol": symbol,
        "interval": "1h",
        "prices": prices,
    }


# ========================================
# Prediction History (SQLite)
# ========================================

def _init_history_db() -> None:
    """Create prediction_history table if not exists."""
    with _db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                coin TEXT NOT NULL,
                horizon TEXT NOT NULL,
                steps_ahead INTEGER NOT NULL,
                use_live_data INTEGER NOT NULL,
                predicted_at TEXT NOT NULL,
                last_observed_close REAL,
                first_predicted_price REAL,
                last_predicted_price REAL,
                predictions_json TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_history_user ON prediction_history(user_email)")
        conn.commit()


class SaveHistoryRequest(BaseModel):
    coin: str
    horizon: str
    steps_ahead: int
    use_live_data: bool
    last_observed_close: Optional[float] = None
    first_predicted_price: Optional[float] = None
    last_predicted_price: Optional[float] = None
    predictions: Optional[list] = None


@app.get("/history")
async def get_history(request: Request):
    # Priority: X-User-Email header > session > X-Guest-ID header
    user_email_header = request.headers.get("X-User-Email")
    user = request.session.get("user")
    
    if user_email_header:
        # Frontend explicitly sent user email (authenticated user)
        user_key = user_email_header
        print(f"[HISTORY] Using X-User-Email header: {user_key}")
    elif user:
        # Session-based authentication
        user_key = user.get("email", "guest")
        print(f"[HISTORY] Using session user: {user_key}")
    else:
        # Guest user - use X-Guest-ID header
        guest_id = request.headers.get("X-Guest-ID")
        if not guest_id:
            if "guest_id" not in request.session:
                import uuid
                request.session["guest_id"] = f"guest_{uuid.uuid4().hex[:12]}"
            guest_id = request.session["guest_id"]
        user_key = guest_id
        print(f"[HISTORY] Using guest ID: {user_key}")
    
    with _db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id, coin, horizon, steps_ahead, use_live_data, predicted_at,
                   last_observed_close, first_predicted_price, last_predicted_price,
                   predictions_json
            FROM prediction_history
            WHERE user_email = ?
            ORDER BY predicted_at DESC
            LIMIT 100
            """,
            (user_key,),
        ).fetchall()
    
    history = []
    for row in rows:
        predictions = None
        if row["predictions_json"]:
            try:
                predictions = json.loads(row["predictions_json"])
            except:
                pass
        history.append({
            "id": row["id"],
            "coin": row["coin"],
            "horizon": row["horizon"],
            "steps_ahead": row["steps_ahead"],
            "use_live_data": bool(row["use_live_data"]),
            "predicted_at": row["predicted_at"],
            "last_observed_close": row["last_observed_close"],
            "first_predicted_price": row["first_predicted_price"],
            "last_predicted_price": row["last_predicted_price"],
            "predictions": predictions,
        })
    
    return {"history": history, "user_key": user_key}


@app.post("/history")
async def save_history(req: SaveHistoryRequest, request: Request):
    # Priority: X-User-Email header > session > X-Guest-ID header
    user_email_header = request.headers.get("X-User-Email")
    user = request.session.get("user")
    
    if user_email_header:
        user_key = user_email_header
    elif user:
        user_key = user.get("email", "guest")
    else:
        guest_id = request.headers.get("X-Guest-ID")
        if not guest_id:
            if "guest_id" not in request.session:
                import uuid
                request.session["guest_id"] = f"guest_{uuid.uuid4().hex[:12]}"
            guest_id = request.session["guest_id"]
        user_key = guest_id
    
    predicted_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    predictions_json = json.dumps(req.predictions) if req.predictions else None
    
    with _db_connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO prediction_history 
            (user_email, coin, horizon, steps_ahead, use_live_data, predicted_at,
             last_observed_close, first_predicted_price, last_predicted_price, predictions_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_key, req.coin, req.horizon, req.steps_ahead, int(req.use_live_data),
             predicted_at, req.last_observed_close, req.first_predicted_price,
             req.last_predicted_price, predictions_json),
        )
        conn.commit()
        history_id = cursor.lastrowid
    
    return {"ok": True, "id": history_id}


@app.delete("/history/{history_id}")
async def delete_history(history_id: int, request: Request):
    # Priority: X-User-Email header > session > X-Guest-ID header
    user_email_header = request.headers.get("X-User-Email")
    user = request.session.get("user")
    
    if user_email_header:
        user_key = user_email_header
    elif user:
        user_key = user.get("email", "guest")
    else:
        guest_id = request.headers.get("X-Guest-ID")
        if not guest_id:
            if "guest_id" not in request.session:
                raise HTTPException(status_code=401, detail="Not authenticated")
            guest_id = request.session["guest_id"]
        user_key = guest_id
    
    with _db_connect() as conn:
        # Ensure user can only delete their own history
        conn.execute(
            "DELETE FROM prediction_history WHERE id = ? AND user_email = ?",
            (history_id, user_key),
        )
        conn.commit()
    
    return {"ok": True}


# Initialize auth and history tables on startup
@app.on_event("startup")
async def _on_startup():
    _init_auth_db()
    _init_history_db()


def _fetch_binance_price_usdt(symbol: str) -> float:
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Binance HTTP error for {symbol}: {exc.code}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch Binance price for {symbol}: {exc}")

    price_str = payload.get("price")
    try:
        return float(price_str)
    except Exception:
        raise HTTPException(status_code=502, detail=f"Invalid Binance response for {symbol}: {payload}")


@app.get("/current-prices")
async def current_prices():
    """Live spot prices from Binance (USDT pairs)."""

    now_iso = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    out = []
    for coin, symbol in BINANCE_SYMBOLS.items():
        price = _fetch_binance_price_usdt(symbol)
        out.append({
            "coin": coin,
            "symbol": symbol,
            "price_usd": price,
        })

    return {
        "source": "binance",
        "timestamp": now_iso,
        "prices": out,
    }


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        if isinstance(value, (np.floating, np.integer)):
            return float(value)
        return float(value)
    except Exception:
        return float(default)


def _append_synthetic_row(
    df_ext: pd.DataFrame,
    ts: pd.Timestamp,
    close_price: float,
    *,
    horizon_hours: int,
) -> pd.DataFrame:
    """Append one synthetic row at timestamp ts using predicted close.

    We must fill all feature columns used by the model. Because future OHLCV is unknown,
    we use simple assumptions (open=prev close, high/low bounds, volume carried forward)
    and recompute derived indicators for that new row.
    """

    if len(df_ext) == 0:
        raise ValueError("df_ext must have at least one row")

    prev_row = df_ext.iloc[-1]
    prev_close = _safe_float(prev_row.get("close"), default=close_price)
    prev_volume = _safe_float(prev_row.get("volume"), default=0.0)

    open_price = prev_close
    high_price = max(open_price, close_price)
    low_price = min(open_price, close_price)
    volume = prev_volume

    new_row = {
        "open": open_price,
        "high": high_price,
        "low": low_price,
        "close": close_price,
        "volume": volume,
        "missing_flag": 1.0,
    }

    # Ensure all columns exist before assignment
    out = df_ext.copy()
    for col, val in new_row.items():
        if col not in out.columns:
            out[col] = np.nan
        out.loc[ts, col] = val

    # Derived features expected by the model
    # return_1h: If horizon is > 1h (e.g. 24h), the step return is a 24h return.
    # We must downscale it to an approximate 1h return to match model expectations.
    if "return_1h" not in out.columns:
        out["return_1h"] = np.nan
    
    if len(out) >= 2:
        prev_close_for_ret = _safe_float(out["close"].iloc[-2], default=0.0)
        step_return = (close_price / prev_close_for_ret - 1.0) if prev_close_for_ret else 0.0
        
        if horizon_hours > 1:
            # Geometric downscaling: (1 + R_24h)^(1/24) - 1
            # Note: This assumes constant growth over the period, which is the best neutral guess.
            # We add 1.0 only if step_return > -1.0 to avoid complex numbers.
            if step_return > -1.0:
                 out.loc[ts, "return_1h"] = (1.0 + step_return) ** (1.0 / horizon_hours) - 1.0
            else:
                 out.loc[ts, "return_1h"] = step_return / horizon_hours  # Linear fallback for crash
        else:
            out.loc[ts, "return_1h"] = step_return
    else:
        out.loc[ts, "return_1h"] = 0.0

    # vol_change: derived from volume change over the step
    # For large horizons, volume might be cumulative or instantaneous.
    # We'll just use simple linear scaling or keep it raw if it's intensity.
    if "vol_change" not in out.columns:
        out["vol_change"] = np.nan
    if len(out) >= 2:
        prev_vol_for_change = _safe_float(out["volume"].iloc[-2], default=0.0)
        out.loc[ts, "vol_change"] = (volume / prev_vol_for_change - 1.0) if prev_vol_for_change else 0.0
    else:
        out.loc[ts, "vol_change"] = 0.0

    # volatility_24h (std of last 24 returns)
    # If we are stepping by 24h, we only have 1 data point per day.
    # Calculating std of last 24 *steps* would look back 24 days, which is wrong.
    # Instead, we should ideally carry forward the last known valid volatility,
    # as we don't have enough intra-step data to compute new volatility.
    if "volatility_24h" not in out.columns:
        out["volatility_24h"] = np.nan
    
    if len(out) >= 2:
         # Just carry forward the previous volatility to avoid wild swings from sparse data
         prev_volatility = _safe_float(out["volatility_24h"].iloc[-2], default=0.0)
         out.loc[ts, "volatility_24h"] = prev_volatility
    else:
         out.loc[ts, "volatility_24h"] = 0.0

    # moving averages
    # For 24h steps, ma_24 (24 hours) is just the immediate last price (window=1 step).
    # ma_168 (7 days) is approx 7 steps.
    for ma_col, window_hours in (("ma_24", 24), ("ma_168", 168)):
        if ma_col not in out.columns:
            out[ma_col] = np.nan
        
        # Adjust window size based on horizon steps
        # e.g. for 24h horizon: ma_24 -> 1 step, ma_168 -> 7 steps
        window_steps = max(1, int(window_hours / horizon_hours))
        
        w = min(window_steps, len(out))
        out.loc[ts, ma_col] = float(out["close"].iloc[-w:].mean())

    if "ma_ratio" not in out.columns:
        out["ma_ratio"] = np.nan
    ma_24 = _safe_float(out.loc[ts, "ma_24"], default=0.0)
    ma_168 = _safe_float(out.loc[ts, "ma_168"], default=0.0)
    out.loc[ts, "ma_ratio"] = (ma_24 / ma_168) if ma_168 else 1.0

    # Fill any remaining NaNs in expected feature columns with the last valid value
    # (helps prevent scaler/model issues for early synthetic steps)
    out = out.sort_index()
    out = out.ffill()
    return out


def load_model_and_scalers(coin: str, horizon: str) -> Tuple[Any, Tuple[Any, Any]]:
    """
    Load model and scalers for a given coin and horizon.
    """
    # Use the requested horizon directly (all 1h models exist)
    model_horizon = horizon
    
    key = f"{coin}_{horizon}"
    if key in model_cache:
        return model_cache[key], scaler_cache[key]

    model_path = MODEL_DIR / coin / model_horizon / f"final_lstm_{coin}_{model_horizon}.keras"
    
    # Try both naming conventions for scalers
    # New naming: feature_scaler.pkl, price_scaler.pkl
    # Old naming: {coin}_feature_scaler.pkl, {coin}_price_scaler.pkl
    scaler_dir = DATA_DIR / "scaled" / coin
    
    feat_scaler_new = scaler_dir / "feature_scaler.pkl"
    feat_scaler_old = scaler_dir / f"{coin}_feature_scaler.pkl"
    price_scaler_new = scaler_dir / "price_scaler.pkl"
    price_scaler_old = scaler_dir / f"{coin}_price_scaler.pkl"
    
    feat_scaler_path = feat_scaler_new if feat_scaler_new.exists() else feat_scaler_old
    price_scaler_path = price_scaler_new if price_scaler_new.exists() else price_scaler_old

    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model not found: {model_path}")
    if not feat_scaler_path.exists():
        raise HTTPException(status_code=404, detail=f"Feature scaler not found in {scaler_dir}")
    if not price_scaler_path.exists():
        raise HTTPException(status_code=404, detail=f"Price scaler not found in {scaler_dir}")

    try:
        import tensorflow as tf  # lazy import
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TensorFlow is not available: {exc}")

    # Global fix: Monkey-patch Dense layer to ignore 'quantization_config'
    # This handles Keras 3 -> Keras 2 deserialization issues globally
    if not getattr(tf.keras.layers.Dense, "_patched", False):
        original_init = tf.keras.layers.Dense.__init__

        def new_init(self, *args, **kwargs):
            kwargs.pop("quantization_config", None)
            original_init(self, *args, **kwargs)

        tf.keras.layers.Dense.__init__ = new_init
        tf.keras.layers.Dense._patched = True

    model = tf.keras.models.load_model(str(model_path))
    feature_scaler = joblib.load(str(feat_scaler_path))
    price_scaler = joblib.load(str(price_scaler_path))

    model_cache[key] = model
    scaler_cache[key] = (feature_scaler, price_scaler)

    return model, (feature_scaler, price_scaler)


@app.post("/predict")
async def predict(req: PredictRequest):

    coin = req.coin
    horizon = req.horizon
    start_timestamp = req.start_timestamp
    steps_ahead = int(req.steps_ahead or 0)
    use_live_data = req.use_live_data

    if coin not in SUPPORTED_COINS:
        raise HTTPException(status_code=400, detail=f"Unsupported coin '{coin}'. Supported: {sorted(SUPPORTED_COINS)}")
    if horizon not in SUPPORTED_HORIZONS:
        raise HTTPException(status_code=400, detail=f"Unsupported horizon '{horizon}'. Supported: {sorted(SUPPORTED_HORIZONS)}")

    if steps_ahead <= 0:
        raise HTTPException(status_code=400, detail="steps_ahead must be >= 1 for future-only forecasting.")

    model, (feature_scaler, price_scaler) = load_model_and_scalers(coin, horizon)

    # Choose data source: live Binance data or static CSV
    if use_live_data:
        try:
            # Fetch 200 klines to ensure enough data for ma_168 calculation
            df = _fetch_binance_klines(coin, limit=200)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch live data: {e}")
    else:
        csv_path = DATA_DIR / "processed" / f"{coin}_processed.csv"
        if not csv_path.exists():
            raise HTTPException(status_code=404, detail=f"Processed CSV not found: {csv_path}")
        df = pd.read_csv(str(csv_path), parse_dates=["open_time"]).set_index("open_time")

    # *** FIXED: close REMOVED from features ***
    feature_cols = [
        "open","high","low","volume",
        "return_1h","volatility_24h",
        "ma_24","ma_168","ma_ratio",
        "vol_change","missing_flag"
    ]

    missing_cols = [c for c in feature_cols + ["close"] if c not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=500, detail=f"CSV missing required columns: {missing_cols}")

    expected_n_features = getattr(feature_scaler, "n_features_in_", None)
    if expected_n_features is not None and expected_n_features != len(feature_cols):
        raise HTTPException(
            status_code=500,
            detail=f"Feature scaler expects {expected_n_features} features but app is using {len(feature_cols)}."
        )

    H = int(horizon.replace("h", ""))
    SEQ_LEN = 48

    if len(df) < SEQ_LEN:
        raise HTTPException(status_code=400, detail=f"Not enough history to forecast. Need at least {SEQ_LEN} rows.")

    base_df = df.copy()
    base_timestamp = pd.Timestamp(base_df.index[-1])
    base_close = float(base_df["close"].iloc[-1])

    # Forecast start time handling:
    # - With live data: "now" is meaningful.
    # - With static CSV: defaulting to real-world "now" can be far beyond the last observed timestamp,
    #   forcing hundreds/thousands of warmup steps and causing drift/explosions.
    #   So when NOT using live data and caller does not provide a start_timestamp, we start from the
    #   last observed timestamp in the dataset.
    if start_timestamp is None:
        start_ts = pd.Timestamp(datetime.utcnow()) if use_live_data else base_timestamp
    else:
        start_ts = pd.Timestamp(start_timestamp)
        if start_ts.tzinfo is not None:
            start_ts = start_ts.tz_convert(None)

    # Predict iteratively: each step advances by H hours
    step_delta = pd.Timedelta(hours=H)
    future_predictions = []

    # Determine how many steps are needed to reach the requested start time.
    # We will *not* return the intermediate gap predictions; we only return predictions from the first
    # horizon-aligned timestamp at/after start_ts.
    if start_ts <= base_timestamp:
        warmup_steps = 0
    else:
        diff = start_ts - base_timestamp
        steps_to_start = int(np.ceil(diff / step_delta))
        warmup_steps = max(0, steps_to_start - 1)

    # Guardrail: avoid excessive iterative warmup forecasting (drift/explosions).
    # If caller needs far-future alignment, they should use live data or provide a closer start timestamp.
    MAX_WARMUP_STEPS = SEQ_LEN  # 48 steps (2 days for 1h, 48 days for 24h)
    if warmup_steps > MAX_WARMUP_STEPS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"start_timestamp is too far beyond the last observed timestamp for '{coin}' ({base_timestamp.isoformat()}). "
                f"Requested start ({start_ts.isoformat()}) would require {warmup_steps} warmup steps (> {MAX_WARMUP_STEPS}). "
                "Use live_data=true or choose a nearer start_timestamp."
            ),
        )

    # --- CALIBRATION STEP ---
    # To prevent "way too much difference" (regime shift bias), we calibrate the model
    # by running it on the *previous* window to see what it predicts for "now".
    # We then adjust future predictions by the ratio: (Actual Now) / (Predicted Now).
    calibration_ratio = 1.0
    if len(base_df) >= SEQ_LEN + 1:
        # Window for t-1 to predict t (now)
        prev_window = base_df[feature_cols].iloc[-SEQ_LEN-1:-1].values
        prev_window = feature_scaler.transform(prev_window)
        prev_window = prev_window.reshape(1, SEQ_LEN, len(feature_cols))
        
        pred_scaled_now = model.predict(prev_window, verbose=0)[0][0]
        fr = getattr(price_scaler, "feature_range", (0.0, 1.0))
        lo, hi = float(fr[0]), float(fr[1])
        pred_scaled_now = float(np.clip(pred_scaled_now, lo, hi))
        pred_now = float(price_scaler.inverse_transform([[pred_scaled_now]])[0][0])
        
        # Calculate ratio, clamped to avoid extreme multipliers (e.g. 0.5x to 2.0x)
        if pred_now > 0:
            calibration_ratio = base_close / pred_now
            calibration_ratio = max(0.8, min(1.2, calibration_ratio)) # Relaxed clamp to allow 20% correction

    for _ in range(warmup_steps):
        feature_window = base_df[feature_cols].iloc[-SEQ_LEN:].values
        feature_window = feature_scaler.transform(feature_window)
        feature_window = feature_window.reshape(1, SEQ_LEN, len(feature_cols))
        next_scaled = model.predict(feature_window, verbose=0)[0][0]
        fr = getattr(price_scaler, "feature_range", (0.0, 1.0))
        lo, hi = float(fr[0]), float(fr[1])
        next_scaled = float(np.clip(next_scaled, lo, hi))
        next_close = float(price_scaler.inverse_transform([[next_scaled]])[0][0])
        
        # Apply calibration
        next_close = next_close * calibration_ratio
        
        next_ts = pd.Timestamp(base_df.index[-1]) + step_delta
        base_df = _append_synthetic_row(base_df, next_ts, next_close, horizon_hours=H)

    for _ in range(steps_ahead):
        feature_window = base_df[feature_cols].iloc[-SEQ_LEN:].values
        feature_window = feature_scaler.transform(feature_window)
        feature_window = feature_window.reshape(1, SEQ_LEN, len(feature_cols))
        next_scaled = model.predict(feature_window, verbose=0)[0][0]
        fr = getattr(price_scaler, "feature_range", (0.0, 1.0))
        lo, hi = float(fr[0]), float(fr[1])
        next_scaled = float(np.clip(next_scaled, lo, hi))
        next_close = float(price_scaler.inverse_transform([[next_scaled]])[0][0])

        # Apply calibration
        next_close = next_close * calibration_ratio

        next_ts = pd.Timestamp(base_df.index[-1]) + step_delta
        future_predictions.append({
            "timestamp": next_ts.isoformat(),
            "predicted_price": next_close,
        })

        base_df = _append_synthetic_row(base_df, next_ts, next_close, horizon_hours=H)

    return {
        "coin": coin,
        "horizon": horizon,
        "requested_start_timestamp": start_ts.isoformat(),
        "last_observed_timestamp": base_timestamp.isoformat(),
        "last_observed_close": base_close,
        "future_predictions": future_predictions,
    }


# ============ NEWS API ENDPOINT (using free CryptoCompare) ============
COIN_CATEGORIES = {
    "bitcoin": "BTC",
    "ethereum": "ETH",
    "solana": "SOL",
    "cardano": "ADA",
    "binancecoin": "BNB"
}

@app.get("/news/{coin}")
async def get_coin_news(coin: str, limit: int = 4):
    """Fetch latest news for a cryptocurrency from CryptoCompare (free, real news)"""
    category = COIN_CATEGORIES.get(coin, "BTC")
    
    try:
        # CryptoCompare free news API - provides real news with images
        url = f"https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories={category}"
        
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode())
        
        articles = []
        for item in data.get("Data", [])[:limit]:
            articles.append({
                "title": item.get("title", ""),
                "description": item.get("body", "")[:150] + "..." if item.get("body") else "",
                "url": item.get("url", ""),
                "source": item.get("source_info", {}).get("name", item.get("source", "CryptoCompare")),
                "publishedAt": datetime.fromtimestamp(item.get("published_on", 0)).isoformat() if item.get("published_on") else "",
                "image": item.get("imageurl", "")
            })
        
        if articles:
            return {"coin": coin, "articles": articles}
        
    except Exception as e:
        print(f"CryptoCompare news error: {e}")
    
    # Fallback with static news
    coin_name = {"bitcoin": "Bitcoin", "ethereum": "Ethereum", "solana": "Solana", "cardano": "Cardano", "binancecoin": "BNB"}.get(coin, coin)
    return {
        "coin": coin,
        "articles": [
            {
                "title": f"{coin_name} Price Analysis: Market Trends Today",
                "description": f"Get the latest {coin_name} price updates, market analysis and trading insights.",
                "url": f"https://www.coingecko.com/en/coins/{coin}",
                "source": "CoinGecko",
                "publishedAt": datetime.now().isoformat(),
                "image": ""
            },
            {
                "title": f"{coin_name} Technical Analysis & Charts",
                "description": f"View {coin_name} charts, technical analysis and price predictions.",
                "url": f"https://coinmarketcap.com/currencies/{coin}/",
                "source": "CoinMarketCap",
                "publishedAt": datetime.now().isoformat(),
                "image": ""
            },
            {
                "title": "Breaking Crypto Market News",
                "description": "Latest cryptocurrency news, analysis and market insights from industry experts.",
                "url": "https://www.coindesk.com/",
                "source": "CoinDesk",
                "publishedAt": datetime.now().isoformat(),
                "image": ""
            },
            {
                "title": "Cryptocurrency Market Updates",
                "description": "Real-time updates from the cryptocurrency world and blockchain industry.",
                "url": "https://cointelegraph.com/",
                "source": "Cointelegraph",
                "publishedAt": datetime.now().isoformat(),
                "image": ""
            }
        ]
    }