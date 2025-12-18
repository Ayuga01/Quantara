import { useEffect, useState } from "react";
import { authLogout, authMe, getCurrentPrices, predictPrice } from "./services/api";
import "./App.css";
import Login from "./Login";

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState(null);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return window.localStorage.getItem("cp_guest_mode") === "true";
    } catch {
      return false;
    }
  });

  const [coin, setCoin] = useState("bitcoin");
  const [horizon, setHorizon] = useState("1h");
  const [stepsAhead, setStepsAhead] = useState(24);
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentPrices, setCurrentPrices] = useState(null);
  const [pricesError, setPricesError] = useState("");

  // Assumption: model outputs are in USD (same unit as your dataset).
  // Update this constant if you want a different conversion rate.
  const USD_TO_INR = 83;

  const formatPrice = (usdValue) => {
    const value = Number(usdValue);
    if (!Number.isFinite(value)) return "-";

    const converted = currency === "INR" ? value * USD_TO_INR : value;
    const locale = currency === "INR" ? "en-IN" : "en-US";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(converted);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await authMe();
        if (!cancelled) setMe(user);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!me && !isGuest) return;
    (async () => {
      try {
        const data = await getCurrentPrices();
        if (!cancelled) setCurrentPrices(data);
      } catch (err) {
        if (!cancelled) setPricesError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me, isGuest]);

  const handleLogout = async () => {
    try {
      await authLogout();
    } finally {
      setMe(null);
      setIsGuest(false);
      try { window.localStorage.removeItem("cp_guest_mode"); } catch {}
      setResult(null);
    }
  };

  const handlePredict = async () => {
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const steps = Number(stepsAhead);
      if (!Number.isFinite(steps) || steps < 1) {
        throw new Error("Future steps must be at least 1.");
      }
      const data = await predictPrice(coin, horizon, steps);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const coinLabel = (c) => {
    switch (c) {
      case "bitcoin":
        return "Bitcoin";
      case "ethereum":
        return "Ethereum";
      case "solana":
        return "Solana";
      case "cardano":
        return "Cardano";
      case "binancecoin":
        return "Binance Coin";
      default:
        return c;
    }
  };

  if (!authChecked) {
    return (
      <div className="app">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  if (!me && !isGuest) {
    return <Login onGuestLogin={() => {
      try { window.localStorage.setItem("cp_guest_mode", "true"); } catch {}
      setIsGuest(true);
    }} />;
  }

  return (
    <div className="app">
      <header className="appHeader">
        <div>
          <h1 className="appTitle">Crypto Price Forecast</h1>
          <p className="appSubtitle">Live Binance prices + future forecasts</p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 220 }}>
            <span className="label">Currency</span>
            <select className="control" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <span className="label">Signed in as</span>
            <div className="control" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me?.email || me?.name || "User"}
              </span>
              <button onClick={handleLogout} style={{ padding: "0.35rem 0.65rem" }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panelHeader">
            <h2 className="panelTitle">Current Prices (Binance)</h2>
            <p className="panelMeta">{currentPrices?.timestamp ? `As of: ${currentPrices.timestamp}` : ""}</p>
          </div>

          {pricesError && <p className="error">Error: {pricesError}</p>}

          {Array.isArray(currentPrices?.prices) && currentPrices.prices.length > 0 ? (
            <ul className="list">
              {currentPrices.prices.map((p) => (
                <li key={p.symbol}>
                  <b>{coinLabel(p.coin)}</b> ({p.symbol}): {formatPrice(p.price_usd)}
                </li>
              ))}
            </ul>
          ) : (
            !pricesError && <p className="hint">Fetching live prices…</p>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2 className="panelTitle">Future Forecast</h2>
            <p className="panelMeta">Starts from present time</p>
          </div>

          <div className="form">
            <div className="row">
              <label className="field">
                <span className="label">Coin</span>
                <select className="control" value={coin} onChange={(e) => setCoin(e.target.value)}>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="solana">Solana</option>
                  <option value="cardano">Cardano</option>
                  <option value="binancecoin">Binance Coin</option>
                </select>
              </label>

              <label className="field">
                <span className="label">Horizon</span>
                <select className="control" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                  <option value="1h">1h</option>
                  <option value="24h">24h</option>
                </select>
              </label>
            </div>

            <div className="row">
              <label className="field">
                <span className="label">Future steps</span>
                <input
                  className="control"
                  type="number"
                  min="1"
                  max="500"
                  value={stepsAhead}
                  onChange={(e) => setStepsAhead(e.target.value)}
                />
              </label>

              <div className="field">
                <span className="label">Action</span>
                <button onClick={handlePredict} disabled={loading}>
                  {loading ? "Predicting…" : "Predict"}
                </button>
              </div>
            </div>

            <div className="actions">
              <p className="hint">Forecasts are generated beyond “now”, not from the dataset end.</p>
            </div>

            {error && <p className="error">Error: {error}</p>}

            {result && (
              <div style={{ marginTop: "0.5rem" }}>
                <div className="kv">
                  <div className="kvRow">
                    <span className="kvKey">Forecast From</span>
                    <span className="kvValue">{result.requested_start_timestamp}</span>
                  </div>
                  <div className="kvRow">
                    <span className="kvKey">Last Observed Close</span>
                    <span className="kvValue">{formatPrice(result.last_observed_close)}</span>
                  </div>
                </div>

                {Array.isArray(result.future_predictions) && result.future_predictions.length > 0 && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <h3 className="panelTitle" style={{ margin: 0 }}>Future Predictions</h3>
                    <p className="panelMeta">First: {result.future_predictions[0].timestamp}</p>
                    <ul className="list">
                      {result.future_predictions.map((p) => (
                        <li key={p.timestamp}>
                          <b>{p.timestamp}:</b> {formatPrice(p.predicted_price)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;