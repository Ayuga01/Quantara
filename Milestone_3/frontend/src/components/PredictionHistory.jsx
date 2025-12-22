/**
 * PredictionHistory.jsx - Compact, modular prediction history cards
 */

import { useState, useMemo } from "react";

const COIN_CONFIG = {
  bitcoin: { icon: "₿", name: "Bitcoin", symbol: "BTC", color: "#f7931a" },
  ethereum: { icon: "Ξ", name: "Ethereum", symbol: "ETH", color: "#627eea" },
  solana: { icon: "◎", name: "Solana", symbol: "SOL", color: "#9945ff" },
  cardano: { icon: "₳", name: "Cardano", symbol: "ADA", color: "#0033ad" },
  binancecoin: { icon: "🔶", name: "BNB", symbol: "BNB", color: "#f3ba2f" },
};

const USD_TO_INR = 89;

// =============== ICONS (using emoji for better visibility) ===============
function IconTrash() {
  return <span style={{ fontSize: '14px' }}>🗑️</span>;
}

function IconRefresh({ spinning }) {
  return (
    <span
      style={{
        fontSize: '14px',
        display: 'inline-block',
        animation: spinning ? 'spin 1s linear infinite' : 'none'
      }}
    >
      🔄
    </span>
  );
}

function IconPlay() {
  return <span style={{ fontSize: '12px' }}>▶️</span>;
}

function IconChevron({ expanded }) {
  return (
    <span
      style={{
        fontSize: '12px',
        display: 'inline-block',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease'
      }}
    >
      ▼
    </span>
  );
}

// =============== UTILITIES ===============
function formatPrice(value, currency = "USD") {
  if (!value && value !== 0) return "-";
  const converted = currency === "INR" ? value * USD_TO_INR : value;
  const symbol = currency === "INR" ? "₹" : "$";
  if (converted >= 100000) return `${symbol}${(converted / 1000).toFixed(0)}K`;
  if (converted >= 1000) return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (converted >= 1) return `${symbol}${converted.toFixed(2)}`;
  return `${symbol}${converted.toFixed(4)}`;
}

function getRelativeTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function calculatePriceChange(item) {
  const basePrice = item.last_observed_close;
  const lastPrice = item.last_predicted_price;
  if (!basePrice || !lastPrice) return null;
  return ((lastPrice - basePrice) / basePrice) * 100;
}

// =============== MINI CHART (ENHANCED WITH ACTUAL PRICES) ===============
function MiniPredictionChart({ item, currency }) {
  const predictions = item.predictions || [];
  const actualPrices = item.actual_prices || [];
  const isVerified = !!item.accuracy_verified_at;
  const meanError = item.mean_error_pct;
  const [hoverIndex, setHoverIndex] = useState(null);

  if (predictions.length === 0) return <div className="history-chart-empty">No chart data</div>;

  const prices = predictions.map(p => p.predicted_price);
  const hasActualPrices = actualPrices.length > 0 && actualPrices.some(p => p !== null);

  // Combine predicted and actual prices for Y-axis scaling
  const allPrices = [...prices];
  if (hasActualPrices) {
    actualPrices.forEach(p => { if (p !== null) allPrices.push(p); });
  }

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice || 1;
  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  const priceChange = ((endPrice - startPrice) / startPrice) * 100;

  const width = 400;
  const height = 140; // Slightly taller to accommodate legend
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = width - 2 * paddingX;
  const chartHeight = height - 2 * paddingY;

  const getX = (i) => paddingX + (i / (prices.length - 1 || 1)) * chartWidth;
  const getY = (price) => paddingY + chartHeight - ((price - minPrice) / range) * chartHeight;

  const points = prices.map((price, i) => `${getX(i)},${getY(price)}`).join(" ");
  const areaPoints = `${paddingX},${height - paddingY} ${points} ${width - paddingX},${height - paddingY}`;

  // Actual prices line (only points that are not null)
  const actualPoints = hasActualPrices
    ? actualPrices.map((price, i) => price !== null ? `${getX(i)},${getY(price)}` : null).filter(p => p).join(" ")
    : "";

  const coinConfig = COIN_CONFIG[item.coin] || {};
  const color = coinConfig.color || "#60a5fa";
  const actualColor = "#34d399"; // Green for actual prices

  // Grid lines (3 horizontal)
  const gridLines = [0, 0.5, 1].map(pct => ({
    y: paddingY + chartHeight * (1 - pct),
    price: minPrice + range * pct
  }));

  return (
    <div className="history-chart-enhanced">
      {/* Verification Status Badge */}
      <div className="chart-status-bar">
        {isVerified ? (
          <span className="verified-badge">
            ✓ Verified {meanError !== null ? `(${meanError.toFixed(1)}% avg error)` : ''}
          </span>
        ) : (
          <span className="pending-badge">⏳ Pending verification</span>
        )}
        {hasActualPrices && (
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-line predicted" style={{ background: color }}></span> Predicted</span>
            <span className="legend-item"><span className="legend-line actual" style={{ background: actualColor }}></span> Actual</span>
          </div>
        )}
      </div>

      <div className="chart-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHoverIndex(null)}>
          <defs>
            <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={paddingX}
                y1={line.y}
                x2={width - paddingX}
                y2={line.y}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4,4"
              />
              <text
                x={paddingX - 5}
                y={line.y + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.5)"
                fontSize="9"
              >
                {formatPrice(line.price, currency)}
              </text>
            </g>
          ))}

          {/* Area Fill for Predicted */}
          <polygon points={areaPoints} fill={`url(#grad-${item.id})`} />

          {/* Predicted Line (solid) */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Actual Prices Line (dashed) */}
          {hasActualPrices && actualPoints && (
            <polyline
              points={actualPoints}
              fill="none"
              stroke={actualColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6,4"
            />
          )}

          {/* Predicted Data Points */}
          {prices.map((price, i) => (
            <g key={`pred-${i}`}>
              <circle
                cx={getX(i)}
                cy={getY(price)}
                r={hoverIndex === i ? 6 : 3}
                fill={i === 0 || i === prices.length - 1 ? color : "white"}
                stroke={color}
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoverIndex(i)}
              />
            </g>
          ))}

          {/* Actual Price Data Points */}
          {hasActualPrices && actualPrices.map((price, i) => (
            price !== null && (
              <g key={`actual-${i}`}>
                <circle
                  cx={getX(i)}
                  cy={getY(price)}
                  r={hoverIndex === i ? 5 : 2.5}
                  fill={actualColor}
                  stroke="white"
                  strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                />
              </g>
            )
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoverIndex !== null && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(getX(hoverIndex) / width) * 100}%`,
              top: `${(getY(prices[hoverIndex]) / height) * 100 - 15}%`
            }}
          >
            <div className="tooltip-step">Step {hoverIndex + 1}</div>
            <div className="tooltip-price">Pred: {formatPrice(prices[hoverIndex], currency)}</div>
            {hasActualPrices && actualPrices[hoverIndex] !== null && (
              <>
                <div className="tooltip-actual">Actual: {formatPrice(actualPrices[hoverIndex], currency)}</div>
                <div className={`tooltip-error ${Math.abs((actualPrices[hoverIndex] - prices[hoverIndex]) / prices[hoverIndex] * 100) < 2 ? 'good' : 'poor'}`}>
                  Error: {Math.abs((actualPrices[hoverIndex] - prices[hoverIndex]) / prices[hoverIndex] * 100).toFixed(2)}%
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Chart Footer */}
      <div className="chart-footer">
        <div className="chart-stat">
          <span className="stat-label">Start</span>
          <span className="stat-value">{formatPrice(startPrice, currency)}</span>
        </div>
        <div className="chart-stat">
          <span className="stat-label">End</span>
          <span className="stat-value">{formatPrice(endPrice, currency)}</span>
        </div>
        <div className={`chart-stat change ${priceChange >= 0 ? 'up' : 'down'}`}>
          <span className="stat-label">Change</span>
          <span className="stat-value">{priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%</span>
        </div>
        {meanError !== null && (
          <div className={`chart-stat accuracy ${meanError < 2 ? 'good' : meanError < 5 ? 'moderate' : 'poor'}`}>
            <span className="stat-label">Accuracy</span>
            <span className="stat-value">{(100 - meanError).toFixed(1)}%</span>
          </div>
        )}
        <div className="chart-stat">
          <span className="stat-label">Steps</span>
          <span className="stat-value">{prices.length}</span>
        </div>
      </div>
    </div>
  );
}

// =============== COMPACT HISTORY ROW ===============
function HistoryRow({ item, onRerun, onDelete, currency, expanded, onToggleExpand }) {
  const coinConfig = COIN_CONFIG[item.coin] || { icon: "🪙", name: item.coin, symbol: "???", color: "#888" };
  const priceChange = calculatePriceChange(item);
  const isVerified = !!item.accuracy_verified_at;
  const meanError = item.mean_error_pct;

  // Get actual prices for display
  const actualPrices = item.actual_prices || [];
  const firstActualPrice = actualPrices.length > 0 ? actualPrices[0] : null;
  const lastActualPrice = actualPrices.length > 0 ? actualPrices[actualPrices.length - 1] : null;
  const hasActualPrices = firstActualPrice !== null && lastActualPrice !== null;

  return (
    <div className={`history-row ${expanded ? "expanded" : ""}`}>
      {/* Main Row */}
      <div className="history-row-main" onClick={onToggleExpand}>
        {/* Coin */}
        <div className="history-row-coin">
          <span className="history-row-icon" style={{ color: coinConfig.color }}>{coinConfig.icon}</span>
          <span className="history-row-symbol">{coinConfig.symbol}</span>
        </div>

        {/* Horizon & Steps */}
        <div className="history-row-info">
          <span className="history-row-horizon">{item.horizon}</span>
          <span className="history-row-steps">{item.steps_ahead} steps</span>
        </div>

        {/* Source */}
        <div className="history-row-source">
          {item.use_live_data ? <span className="live-badge">🔴 Live</span> : <span className="hist-badge">📊 Hist</span>}
        </div>

        {/* Predicted Price Range */}
        <div className="history-row-prices predicted">
          <span className="history-row-base">{formatPrice(item.last_observed_close, currency)}</span>
          <span className="history-row-arrow">→</span>
          <span className="history-row-pred">{formatPrice(item.last_predicted_price, currency)}</span>
        </div>

        {/* Actual Price Range */}
        <div className="history-row-prices actual">
          {hasActualPrices ? (
            <>
              <span className="history-row-base">{formatPrice(firstActualPrice, currency)}</span>
              <span className="history-row-arrow">→</span>
              <span className="history-row-actual">{formatPrice(lastActualPrice, currency)}</span>
            </>
          ) : (
            <span className="history-row-pending">⏳ Pending</span>
          )}
        </div>

        {/* Change Badge */}
        {priceChange !== null ? (
          <div className={`history-row-change ${priceChange >= 0 ? "up" : "down"}`}>
            {priceChange >= 0 ? "↑" : "↓"} {Math.abs(priceChange).toFixed(1)}%
          </div>
        ) : (
          <div className="history-row-change neutral">-</div>
        )}

        {/* Verification Status / Accuracy */}
        <div className="history-row-accuracy">
          {isVerified ? (
            <span className={`accuracy-badge ${meanError !== null && meanError < 2 ? 'good' : meanError !== null && meanError < 5 ? 'moderate' : 'poor'}`}>
              {meanError !== null ? `${(100 - meanError).toFixed(0)}%` : '✓'}
            </span>
          ) : (
            <span className="accuracy-badge pending">⏳</span>
          )}
        </div>

        {/* Time */}
        <div className="history-row-time">{getRelativeTime(item.predicted_at)}</div>

        {/* Actions */}
        <div className="history-row-actions">
          <button className="history-row-btn rerun" onClick={(e) => { e.stopPropagation(); onRerun(item); }} title="Rerun">
            <IconPlay />
          </button>
          <button className="history-row-btn delete" onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} title="Delete">
            <IconTrash />
          </button>
          <IconChevron expanded={expanded} />
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="history-row-expanded">
          <MiniPredictionChart item={item} currency={currency} />
        </div>
      )}
    </div>
  );
}

// =============== MAIN COMPONENT ===============
export default function PredictionHistory({
  history = [],
  loading,
  onRerun,
  onDelete,
  onRefresh,
  currency = "USD",
}) {
  const [filterCoin, setFilterCoin] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [expandedId, setExpandedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter and sort logic
  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (filterCoin !== "all") {
      result = result.filter(item => item.coin === filterCoin);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "date-asc": return new Date(a.predicted_at) - new Date(b.predicted_at);
        case "date-desc": return new Date(b.predicted_at) - new Date(a.predicted_at);
        case "coin-asc": return (a.coin || "").localeCompare(b.coin || "");
        default: return new Date(b.predicted_at) - new Date(a.predicted_at);
      }
    });

    return result;
  }, [history, filterCoin, sortBy]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setRefreshing(false), 500);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="history-container history-loading">
        <div className="history-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  return (
    <div className="history-container">
      {/* Compact Header */}
      <div className="history-header-compact">
        <div className="history-title-compact">
          <h2>History</h2>
          <span className="history-count">{filteredHistory.length}</span>
        </div>

        <div className="history-controls-compact">
          <select value={filterCoin} onChange={(e) => setFilterCoin(e.target.value)}>
            <option value="all">All</option>
            {Object.entries(COIN_CONFIG).map(([id, config]) => (
              <option key={id} value={id}>{config.symbol}</option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date-desc">Newest</option>
            <option value="date-asc">Oldest</option>
            <option value="coin-asc">Coin</option>
          </select>

          <button className="history-refresh-compact" onClick={handleRefresh} disabled={refreshing}>
            <IconRefresh spinning={refreshing} />
          </button>

          <button
            className="history-download-btn"
            onClick={() => {
              if (filteredHistory.length === 0) return;
              const csvHeader = 'Coin,Horizon,Steps,Source,Base Price,Predicted Price,Change %,Predicted At\n';
              const csvRows = filteredHistory.map(item => {
                const change = calculatePriceChange(item);
                return [
                  COIN_CONFIG[item.coin]?.name || item.coin,
                  item.horizon,
                  item.steps_ahead,
                  item.use_live_data ? 'Live' : 'Historical',
                  item.last_observed_close?.toFixed(2) || '',
                  item.last_predicted_price?.toFixed(2) || '',
                  change !== null ? change.toFixed(2) : '',
                  item.predicted_at || ''
                ].join(',');
              }).join('\n');
              const csvContent = csvHeader + csvRows;
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `prediction_history_${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            title="Download History as CSV"
            disabled={filteredHistory.length === 0}
          >
            📥
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="history-table-header">
        <span>Coin</span>
        <span>Config</span>
        <span>Source</span>
        <span>Predicted</span>
        <span>Actual</span>
        <span>Change</span>
        <span>Accuracy</span>
        <span>Time</span>
        <span>Actions</span>
      </div>

      {/* Content */}
      {filteredHistory.length === 0 ? (
        <div className="history-empty-compact">
          <p>No predictions yet</p>
        </div>
      ) : (
        <div className="history-rows">
          {filteredHistory.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              onRerun={onRerun}
              onDelete={onDelete}
              currency={currency}
              expanded={expandedId === item.id}
              onToggleExpand={() => toggleExpand(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
