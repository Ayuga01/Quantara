/**
 * PriceChart.jsx - CoinGecko-style price chart with time period selector
 */

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COIN_CONFIG = {
  bitcoin: {
    symbol: "BTC",
    name: "Bitcoin",
    color: "#f7931a",
    icon: "₿",
  },
  ethereum: {
    symbol: "ETH",
    name: "Ethereum",
    color: "#627eea",
    icon: "Ξ",
  },
  solana: {
    symbol: "SOL",
    name: "Solana",
    color: "#9945ff",
    icon: "◎",
  },
  cardano: {
    symbol: "ADA",
    name: "Cardano",
    color: "#0033ad",
    icon: "₳",
  },
  binancecoin: {
    symbol: "BNB",
    name: "BNB",
    color: "#f3ba2f",
    icon: "🔶",
  },
};

const TIME_PERIODS = [
  { key: "1D", label: "1D", hours: 24 },
  { key: "7D", label: "7D", hours: 168 },
  { key: "1M", label: "1M", hours: 720 },
];

const USD_TO_INR = 89;

function formatPrice(value, full = false, currency = "USD") {
  if (!value || !Number.isFinite(value)) return currency === "INR" ? "₹0.00" : "$0.00";

  const converted = currency === "INR" ? value * USD_TO_INR : value;
  const symbol = currency === "INR" ? "₹" : "$";

  if (full) {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: converted < 1 ? 4 : 2,
    }).format(converted);
  }

  if (converted >= 10000) return `${symbol}${(converted / 1000).toFixed(1)}K`;
  if (converted >= 1000) return `${symbol}${(converted / 1000).toFixed(2)}K`;
  if (converted >= 1) return `${symbol}${converted.toFixed(0)}`;
  return `${symbol}${converted.toFixed(4)}`;
}

function formatAxisTime(timestamp, period) {
  const date = new Date(timestamp);
  if (period === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CustomTooltip({ active, payload, coinConfig, currency }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0]?.payload;

  return (
    <div className="chart-tooltip-new">
      <p className="chart-tooltip-time">{formatTooltipTime(data.timestamp)}</p>
      <p className="chart-tooltip-price" style={{ color: coinConfig?.color || '#f7931a' }}>
        {formatPrice(data.price, true, currency)}
      </p>
    </div>
  );
}

export default function PriceChart({
  coin,
  historicalData,
  predictions,
  loading,
  currentPrice,
  onPeriodChange,
  currency = "USD"
}) {
  const [period, setPeriod] = useState("7D");
  const config = COIN_CONFIG[coin] || COIN_CONFIG.bitcoin;

  // Filter data based on selected period
  const filteredData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    const periodConfig = TIME_PERIODS.find(p => p.key === period);
    const hours = periodConfig?.hours || 168;

    // Take last N data points based on period
    const data = historicalData.slice(-hours).map(point => ({
      timestamp: point.timestamp,
      price: point.price || point.close,
    }));

    return data;
  }, [historicalData, period]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (filteredData.length < 2 || !currentPrice) return null;

    const firstPrice = filteredData[0]?.price;
    if (!firstPrice) return null;

    const change = currentPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    return {
      value: change,
      percent: changePercent,
      isPositive: change >= 0,
    };
  }, [filteredData, currentPrice]);

  // Calculate Y-axis domain
  const [minPrice, maxPrice] = useMemo(() => {
    if (filteredData.length === 0) return [0, 100];
    const prices = filteredData.map(d => d.price).filter(p => p != null);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [filteredData]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (onPeriodChange) {
      const periodConfig = TIME_PERIODS.find(p => p.key === newPeriod);
      onPeriodChange(periodConfig?.hours || 168);
    }
  };

  const lastUpdated = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });

  if (loading) {
    return (
      <div className="price-chart-container">
        <div className="chart-loading-state">
          <div className="chart-spinner" />
          <p>Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (!historicalData || historicalData.length === 0) {
    return (
      <div className="price-chart-container">
        <div className="chart-empty-state">
          <p>No chart data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="price-chart-container">
      {/* Header with coin info */}
      <div className="price-chart-header">
        <div className="price-chart-coin-info">
          <div className="price-chart-coin-icon" style={{ background: config.color }}>
            <span>{config.icon}</span>
          </div>
          <h2 className="price-chart-coin-name">
            {config.name} Price ({config.symbol})
          </h2>
          <span className="price-chart-hot-badge">HOT</span>
        </div>
      </div>

      {/* Price display */}
      <div className="price-chart-price-row">
        <span className="price-chart-label">{config.symbol} to </span>
        <span className="price-chart-usd">{currency}:</span>
        <span className="price-chart-current-price">
          1 {config.name} equals {formatPrice(currentPrice, true, currency)}
        </span>
        {priceChange && (
          <span className={`price-chart-change ${priceChange.isPositive ? 'positive' : 'negative'}`}>
            {priceChange.isPositive ? '+' : ''}{priceChange.percent.toFixed(2)}%
          </span>
        )}
        <span className="price-chart-period-label">{period}</span>
      </div>

      {/* Time period selector */}
      <div className="price-chart-periods">
        {TIME_PERIODS.map((p) => (
          <button
            key={p.key}
            className={`price-chart-period-btn ${period === p.key ? 'active' : ''}`}
            onClick={() => handlePeriodChange(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="price-chart-graph">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={filteredData}
            margin={{ top: 10, right: 60, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={`gradient-${coin}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={(t) => formatAxisTime(t, period)}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => formatPrice(v, false, currency)}
              stroke="rgba(255,255,255,0.3)"
              tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              orientation="right"
              width={70}
            />
            <Tooltip
              content={<CustomTooltip coinConfig={config} currency={currency} />}
              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={config.color}
              strokeWidth={2}
              fill={`url(#gradient-${coin})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: config.color,
                stroke: '#fff',
                strokeWidth: 2
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Y-axis price indicator (current price) */}
        {currentPrice && (
          <div
            className="price-chart-current-indicator"
            style={{
              backgroundColor: config.color,
            }}
          >
            {formatPrice(currentPrice, false, currency)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="price-chart-footer">
        <span>Page last updated: {lastUpdated}</span>
      </div>
    </div>
  );
}
