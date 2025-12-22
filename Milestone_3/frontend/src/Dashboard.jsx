/**
 * Dashboard.jsx - Main dashboard with sidebar navigation
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import PriceChart from "./components/PriceChart";
import CoinSelector from "./components/CoinSelector";
import UserProfile from "./components/UserProfile";
import PredictionHistory from "./components/PredictionHistory";
import {
  getCurrentPrices,
  predictPrice,
  getHistoricalPrices,
  getHistory,
  saveHistory,
  deleteHistory,
  updateProfile
} from "./services/api";
import "./Dashboard.css";

const COIN_LABELS = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  cardano: "Cardano",
  binancecoin: "BNB",
};

const COIN_COLORS = {
  bitcoin: "#f7931a",
  ethereum: "#627eea",
  solana: "#9945ff",
  cardano: "#0033ad",
  binancecoin: "#f3ba2f",
};

// Interactive Prediction Result Chart Component with Zoom
function PredictionResultChart({ predictions, basePrice, coin, currency }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit all, higher = zoom in
  const chartRef = useRef(null);

  if (!predictions || predictions.length === 0) return null;

  const prices = predictions.map(p => p.predicted_price);
  const timestamps = predictions.map(p => p.timestamp);
  const allPrices = basePrice ? [basePrice, ...prices] : prices;
  const allTimestamps = basePrice ? ["Current", ...timestamps] : timestamps;

  // Calculate price range with zoom
  const actualMin = Math.min(...allPrices);
  const actualMax = Math.max(...allPrices);
  const actualRange = actualMax - actualMin || 1;
  const midPrice = (actualMax + actualMin) / 2;

  // Apply zoom: reduce the range around the midpoint
  const zoomedRange = actualRange / zoomLevel;
  const minPrice = midPrice - zoomedRange / 2;
  const maxPrice = midPrice + zoomedRange / 2;
  const range = maxPrice - minPrice || 1;

  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const color = COIN_COLORS[coin] || "#60a5fa";

  // Generate path points (clamp Y values to chart area)
  const getY = (price) => {
    const normalized = (price - minPrice) / range;
    return padding.top + chartHeight - Math.max(0, Math.min(1, normalized)) * chartHeight;
  };

  const points = allPrices.map((price, i) => {
    const x = padding.left + (i / (allPrices.length - 1 || 1)) * chartWidth;
    const y = getY(price);
    return { x, y, price, timestamp: allTimestamps[i], index: i };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  // Format price for labels with currency conversion
  const USD_TO_INR = 89;
  const formatLabel = (val) => {
    const converted = currency === "INR" ? val * USD_TO_INR : val;
    const symbol = currency === "INR" ? "₹" : "$";
    if (converted >= 100000) return `${symbol}${(converted / 100000).toFixed(1)}L`;
    if (converted >= 1000) return `${symbol}${(converted / 1000).toFixed(1)}K`;
    if (converted >= 1) return `${symbol}${converted.toFixed(2)}`;
    return `${symbol}${converted.toFixed(4)}`;
  };

  // Handle mouse move on chart
  const handleMouseMove = (e) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;

    // Find closest point
    let closestIdx = 0;
    let closestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    setHoveredIndex(closestIdx);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => setHoveredIndex(null);

  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    setZoomLevel(prev => Math.max(1, Math.min(20, prev + delta)));
  };

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  // Calculate price change percentage for display
  const priceChangePercent = ((actualMax - actualMin) / actualMin * 100).toFixed(2);

  return (
    <div className="prediction-chart interactive">
      {/* Zoom Controls */}
      <div className="chart-zoom-controls">
        <button
          className="zoom-btn"
          onClick={() => setZoomLevel(prev => Math.min(20, prev + 1))}
          title="Zoom In"
        >
          +
        </button>
        <span className="zoom-level">{zoomLevel.toFixed(0)}x</span>
        <button
          className="zoom-btn"
          onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))}
          title="Zoom Out"
        >
          −
        </button>
        <button
          className="zoom-btn reset"
          onClick={() => setZoomLevel(1)}
          title="Reset Zoom"
        >
          ⟲
        </button>
        {zoomLevel === 1 && priceChangePercent < 1 && (
          <span className="zoom-hint">📈 Small change ({priceChangePercent}%) - try zooming in!</span>
        )}
      </div>

      <div
        className="chart-wrapper"
        ref={chartRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="prediction-chart-svg">
          <defs>
            <linearGradient id={`gradient-${coin}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.4" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <clipPath id="chart-clip">
              <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={padding.top + chartHeight * ratio}
                x2={width - padding.right}
                y2={padding.top + chartHeight * ratio}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4"
              />
              <text
                x={padding.left - 10}
                y={padding.top + chartHeight * ratio + 4}
                fill="rgba(255,255,255,0.5)"
                fontSize="10"
                textAnchor="end"
              >
                {formatLabel(maxPrice - range * ratio)}
              </text>
            </g>
          ))}

          {/* Clipped chart content */}
          <g clipPath="url(#chart-clip)">
            {/* Area fill */}
            <path d={areaPath} fill={`url(#gradient-${coin})`} />

            {/* Line */}
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="chart-line"
            />
          </g>

          {/* Hover vertical line */}
          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              y1={padding.top}
              x2={hoveredPoint.x}
              y2={height - padding.bottom}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4"
              opacity="0.6"
            />
          )}

          {/* Data points (all small, hovered one bigger) */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={Math.max(padding.top, Math.min(height - padding.bottom, p.y))}
              r={hoveredIndex === i ? 8 : (i === 0 || i === points.length - 1) ? 5 : 3}
              fill={i === 0 ? "#fff" : color}
              stroke={i === 0 ? color : "#fff"}
              strokeWidth="2"
              opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.4}
              style={{
                transition: 'r 0.15s ease, opacity 0.15s ease',
                cursor: 'pointer'
              }}
              filter={hoveredIndex === i ? "url(#glow)" : undefined}
            />
          ))}

          {/* X-axis labels */}
          <text x={padding.left} y={height - 10} fill="rgba(255,255,255,0.5)" fontSize="10">Now</text>
          <text x={width - padding.right} y={height - 10} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="end">
            +{predictions.length} {predictions.length > 1 ? 'steps' : 'step'}
          </text>
        </svg>

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="chart-tooltip"
            style={{
              left: mousePos.x,
              top: mousePos.y - 70,
            }}
          >
            <div className="tooltip-step">Step {hoveredPoint.index}</div>
            <div className="tooltip-price">{formatLabel(hoveredPoint.price)}</div>
            <div className="tooltip-time">{hoveredPoint.timestamp}</div>
            {hoveredPoint.index > 0 && (
              <div className={`tooltip-change ${hoveredPoint.price >= allPrices[0] ? 'up' : 'down'}`}>
                {hoveredPoint.price >= allPrices[0] ? '↑' : '↓'}
                {Math.abs(((hoveredPoint.price - allPrices[0]) / allPrices[0]) * 100).toFixed(2)}%
              </div>
            )}
          </div>
        )}
      </div>

      <div className="prediction-chart-legend">
        <span className="legend-start">● Start: {formatLabel(allPrices[0])}</span>
        <span className="legend-end" style={{ color }}>● End: {formatLabel(allPrices[allPrices.length - 1])}</span>
        <span className={`legend-change ${allPrices[allPrices.length - 1] >= allPrices[0] ? 'up' : 'down'}`}>
          {allPrices[allPrices.length - 1] >= allPrices[0] ? '↑' : '↓'}
          {Math.abs(((allPrices[allPrices.length - 1] - allPrices[0]) / allPrices[0]) * 100).toFixed(2)}%
        </span>
      </div>

      <div className="chart-hint">
        💡 Hover to see details • Scroll to zoom • Use +/- buttons
      </div>
    </div>
  );
}


function formatPrice(value, currency = "USD") {
  const USD_TO_INR = 89;
  const converted = currency === "INR" ? value * USD_TO_INR : value;
  if (!Number.isFinite(converted)) return "-";

  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(converted);
}

// Dashboard Home Section
function DashboardHome({
  coin,
  setCoin,
  currentPrices,
  historicalData,
  predictions,
  loadingHistorical,
  loadingPrediction,
  onPredict,
  currency = "USD",
  onCurrencyChange,
  onPeriodChange
}) {
  const [news, setNews] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // CoinDesk curated news - coin-specific headlines
  useEffect(() => {
    setLoadingNews(true);

    const coinNames = { bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana", cardano: "Cardano", binancecoin: "BNB" };
    const coinName = coinNames[coin] || "Bitcoin";

    // CoinDesk coin-specific search URLs
    const coinDeskSearchUrls = {
      bitcoin: "https://www.coindesk.com/tag/bitcoin/",
      ethereum: "https://www.coindesk.com/tag/ethereum/",
      solana: "https://www.coindesk.com/tag/solana/",
      cardano: "https://www.coindesk.com/tag/cardano/",
      binancecoin: "https://www.coindesk.com/tag/bnb/"
    };

    // Generate 4 different CoinDesk article cards for each coin
    const coinNews = {
      bitcoin: [
        { title: "Bitcoin Price Analysis: BTC Market Trends", description: "Latest Bitcoin price movements, technical analysis and market outlook from CoinDesk analysts.", url: "https://www.coindesk.com/price/bitcoin", image: "https://www.coindesk.com/resizer/H_GmlORLiCa-dQdWTp4EPJ8OyEY=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2GRCOXC5WVY4GDN4GJE.png" },
        { title: "Bitcoin News & Breaking Updates", description: "Breaking news, analysis and insights about Bitcoin from industry experts.", url: coinDeskSearchUrls.bitcoin, image: "https://www.coindesk.com/resizer/vY9k3K0V4DBdnlDEKfG6MqLx5ic=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/K4KQYQ6QKBGQDA6RIE3FJNHPJY.png" },
        { title: "Bitcoin ETF & Institutional Adoption", description: "Coverage of Bitcoin ETFs, institutional investments and regulatory developments.", url: "https://www.coindesk.com/tag/bitcoin-etf/", image: "https://www.coindesk.com/resizer/7eFOZWQhpRIKi2gfP6B3dBq3G_A=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/STKC3GWHSRF3ZHPJHKDKVVZB6U.jpg" },
        { title: "Bitcoin Mining & Network Analysis", description: "Updates on Bitcoin mining, hash rate, network security and miner activity.", url: "https://www.coindesk.com/tag/bitcoin-mining/", image: "https://www.coindesk.com/resizer/d0NEiPaLBVHzVxdV_wqN_zM8cQg=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/SRKL3HXEQZG6BOUMITFBVYDZAY.jpg" }
      ],
      ethereum: [
        { title: "Ethereum Price Analysis: ETH Market Outlook", description: "Latest Ethereum price analysis, DeFi trends and market insights from CoinDesk.", url: "https://www.coindesk.com/price/ethereum", image: "https://www.coindesk.com/resizer/nJqe0Gc0hT9O2X3gzLYrlG5bI0Y=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2GRCOXC5WVY4GDN4GJE.png" },
        { title: "Ethereum News & DeFi Updates", description: "Breaking Ethereum news, DeFi developments and smart contract innovations.", url: coinDeskSearchUrls.ethereum, image: "https://www.coindesk.com/resizer/jE6fB9z6R1N3Q4M1BXKk_eI5ooo=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/3JFBQSW7CRGQ3GDXVDTRVBPQAQ.jpg" },
        { title: "Ethereum Layer 2 & Scaling Solutions", description: "Coverage of Ethereum L2 networks, rollups and scaling technology.", url: "https://www.coindesk.com/tag/layer-2/", image: "https://www.coindesk.com/resizer/IbDuJc7MXZW5FZQFQ3LN3NKXLU=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/2CHNQ7FFPJGKDCRHR3GDMVXLZI.jpg" },
        { title: "Ethereum Staking & Network Upgrades", description: "Updates on ETH staking, validator economics and protocol upgrades.", url: "https://www.coindesk.com/tag/ethereum-staking/", image: "https://www.coindesk.com/resizer/YqM7R6NPGVF3BDNRQ5WN5KZLCM=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/QSPC3C6WVNFLXGY7YJFQ5NZUOQ.jpg" }
      ],
      solana: [
        { title: "Solana Price Analysis: SOL Market Trends", description: "Latest Solana price movements and ecosystem developments from CoinDesk.", url: "https://www.coindesk.com/price/solana", image: "https://www.coindesk.com/resizer/nJqe0Gc0hT9O2X3gzLYrlG5bI0Y=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2GRCOXC5WVY4GDN4GJE.png" },
        { title: "Solana News & Ecosystem Updates", description: "Breaking Solana news, DApp launches and network performance.", url: coinDeskSearchUrls.solana, image: "https://www.coindesk.com/resizer/jE6fB9z6R1N3Q4M1BXKk_eI5ooo=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/3JFBQSW7CRGQ3GDXVDTRVBPQAQ.jpg" },
        { title: "Solana DeFi & NFT Ecosystem", description: "Coverage of Solana DeFi protocols, NFT marketplaces and meme coins.", url: "https://www.coindesk.com/tag/solana/", image: "https://www.coindesk.com/resizer/IbDuJc7MXZW5FZQFQ3LN3NKXLU=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/2CHNQ7FFPJGKDCRHR3GDMVXLZI.jpg" },
        { title: "Solana Network & Developer Updates", description: "Technical updates on Solana network, validators and developer tools.", url: "https://www.coindesk.com/tag/solana/", image: "https://www.coindesk.com/resizer/YqM7R6NPGVF3BDNRQ5WN5KZLCM=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/QSPC3C6WVNFLXGY7YJFQ5NZUOQ.jpg" }
      ],
      cardano: [
        { title: "Cardano Price Analysis: ADA Market Outlook", description: "Latest Cardano price analysis and ecosystem developments from CoinDesk.", url: "https://www.coindesk.com/price/cardano", image: "https://www.coindesk.com/resizer/nJqe0Gc0hT9O2X3gzLYrlG5bI0Y=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2GRCOXC5WVY4GDN4GJE.png" },
        { title: "Cardano News & Protocol Updates", description: "Breaking Cardano news, Hydra scaling and governance developments.", url: coinDeskSearchUrls.cardano, image: "https://www.coindesk.com/resizer/jE6fB9z6R1N3Q4M1BXKk_eI5ooo=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/3JFBQSW7CRGQ3GDXVDTRVBPQAQ.jpg" },
        { title: "Cardano DeFi & Smart Contracts", description: "Coverage of Cardano DeFi ecosystem, Plutus smart contracts.", url: "https://www.coindesk.com/tag/cardano/", image: "https://www.coindesk.com/resizer/IbDuJc7MXZW5FZQFQ3LN3NKXLU=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/2CHNQ7FFPJGKDCRHR3GDMVXLZI.jpg" },
        { title: "Cardano Staking & Governance", description: "Updates on ADA staking, stake pools and on-chain governance.", url: "https://www.coindesk.com/tag/cardano/", image: "https://www.coindesk.com/resizer/YqM7R6NPGVF3BDNRQ5WN5KZLCM=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/QSPC3C6WVNFLXGY7YJFQ5NZUOQ.jpg" }
      ],
      binancecoin: [
        { title: "BNB Price Analysis: Market Trends", description: "Latest BNB price analysis and Binance ecosystem updates from CoinDesk.", url: "https://www.coindesk.com/price/bnb", image: "https://www.coindesk.com/resizer/nJqe0Gc0hT9O2X3gzLYrlG5bI0Y=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/ZJZZK5B2GRCOXC5WVY4GDN4GJE.png" },
        { title: "BNB Chain News & Updates", description: "Breaking news on BNB Chain, opBNB and Binance developments.", url: coinDeskSearchUrls.binancecoin, image: "https://www.coindesk.com/resizer/jE6fB9z6R1N3Q4M1BXKk_eI5ooo=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/3JFBQSW7CRGQ3GDXVDTRVBPQAQ.jpg" },
        { title: "Binance Exchange & Regulation", description: "Coverage of Binance exchange, regulatory news and compliance.", url: "https://www.coindesk.com/tag/binance/", image: "https://www.coindesk.com/resizer/IbDuJc7MXZW5FZQFQ3LN3NKXLU=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/2CHNQ7FFPJGKDCRHR3GDMVXLZI.jpg" },
        { title: "BNB Chain DeFi & Projects", description: "Updates on BNB Chain DeFi protocols, gaming and NFT projects.", url: "https://www.coindesk.com/tag/bnb-chain/", image: "https://www.coindesk.com/resizer/YqM7R6NPGVF3BDNRQ5WN5KZLCM=/1200x628/center/middle/cloudfront-us-east-1.images.arcpublishing.com/coindesk/QSPC3C6WVNFLXGY7YJFQ5NZUOQ.jpg" }
      ]
    };

    // Set coin-specific news with source
    const articles = (coinNews[coin] || coinNews.bitcoin).map(article => ({
      ...article,
      source: "CoinDesk",
      publishedAt: new Date().toISOString()
    }));

    setNews(articles);
    setLoadingNews(false);
  }, [coin]);

  const currentPrice = currentPrices?.[coin];
  const lastPred = predictions?.[predictions?.length - 1];
  const priceChange = lastPred && currentPrice
    ? ((lastPred.predicted_price - currentPrice) / currentPrice) * 100
    : null;

  const COIN_LABELS = {
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    solana: "Solana",
    cardano: "Cardano",
    binancecoin: "BNB"
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="dashboard-home">
      {/* Coin & Currency Dropdowns */}
      <CoinSelector
        selectedCoin={coin}
        onSelectCoin={setCoin}
        currentPrices={currentPrices}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
      />

      {/* Price Chart */}
      <PriceChart
        coin={coin}
        historicalData={historicalData}
        predictions={predictions}
        loading={loadingHistorical}
        currentPrice={currentPrice}
        onPeriodChange={onPeriodChange}
        currency={currency}
      />

      {/* Quick Stats */}
      {predictions && predictions.length > 0 && (
        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-label">Current Price</span>
            <span className="stat-value">{formatPrice(currentPrice, currency)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Next Hour</span>
            <span className="stat-value">{formatPrice(predictions[0]?.predicted_price, currency)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">In 24 Steps</span>
            <span className="stat-value">{formatPrice(lastPred?.predicted_price, currency)}</span>
          </div>
          <div className={`stat-card ${priceChange >= 0 ? "positive" : "negative"}`}>
            <span className="stat-label">Predicted Change</span>
            <span className="stat-value">
              {priceChange >= 0 ? "↑" : "↓"} {Math.abs(priceChange || 0).toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="news-section">
        <h3 className="news-title">About {COIN_LABELS[coin] || coin}</h3>
        {loadingNews ? (
          <div className="news-loading">Loading...</div>
        ) : news.length === 0 ? (
          <div className="news-empty">No information available</div>
        ) : (
          <div className="news-grid">
            {news.map((article, idx) => (
              <a
                key={idx}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="news-card no-image"
              >
                <div className="news-card-content">
                  <h4 className="news-headline">{article.title}</h4>
                  <p className="news-desc">{article.description?.slice(0, 100) || "Read more..."}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Predict Section
function PredictSection({
  coin,
  setCoin,
  horizon,
  setHorizon,
  stepsAhead,
  setStepsAhead,
  useLiveData,
  setUseLiveData,
  currentPrices,
  onPredict,
  loading,
  result,
  error,
  currency = "USD",
  onCurrencyChange
}) {
  return (
    <div className="predict-section">
      <h2>Generate Prediction</h2>

      <div className="predict-form">
        {/* Coin Selection */}
        <CoinSelector
          selectedCoin={coin}
          onSelectCoin={setCoin}
          currentPrices={currentPrices}
          currency={currency}
          onCurrencyChange={onCurrencyChange}
        />

        {/* Prediction Options */}
        <div className="predict-options">
          <div className="predict-option-group">
            <label>Prediction Horizon</label>
            <div className="predict-horizon-btns">
              <button
                className={horizon === "1h" ? "active" : ""}
                onClick={() => setHorizon("1h")}
              >
                1 Hour
              </button>
              <button
                className={horizon === "24h" ? "active" : ""}
                onClick={() => setHorizon("24h")}
              >
                24 Hours
              </button>
            </div>
          </div>

          <div className="predict-option-group">
            <label>Steps Ahead</label>
            <input
              type="number"
              min="1"
              max="100"
              value={stepsAhead}
              onChange={(e) => setStepsAhead(Number(e.target.value))}
              className="predict-input"
            />
            <span className="predict-hint">
              {horizon === "1h" ? `${stepsAhead} hours` : `${stepsAhead} days`}
            </span>
          </div>

        </div>

        <button
          className="predict-submit-btn"
          onClick={onPredict}
          disabled={loading}
        >
          {loading ? "Predicting..." : "Generate Prediction"}
        </button>

        {error && <div className="predict-error">{error}</div>}

        {/* Results */}
        {result && (
          <div className="predict-results">
            {/* Results Header */}
            <div className="results-header">
              <div className="results-header-icon" style={{ background: `linear-gradient(135deg, ${COIN_COLORS[result.coin] || '#60a5fa'}40, ${COIN_COLORS[result.coin] || '#60a5fa'}10)` }}>
                <span style={{ color: COIN_COLORS[result.coin] || '#60a5fa' }}>
                  {result.coin === 'bitcoin' && '₿'}
                  {result.coin === 'ethereum' && 'Ξ'}
                  {result.coin === 'solana' && '◎'}
                  {result.coin === 'cardano' && '₳'}
                  {result.coin === 'binancecoin' && '🔶'}
                </span>
              </div>
              <div className="results-header-text">
                <h3>Prediction Results</h3>
                <span className="results-subtitle">{COIN_LABELS[result.coin]} • {result.horizon} horizon</span>
              </div>
              <div className="results-header-badge" style={{ borderColor: COIN_COLORS[result.coin] || '#60a5fa' }}>
                {result.future_predictions?.length || 0} steps
              </div>
            </div>

            {/* Stats Cards */}
            <div className="results-stats-grid">
              <div className="results-stat-card">
                <span className="stat-icon">💰</span>
                <div className="stat-content">
                  <span className="stat-label">Last Observed</span>
                  <span className="stat-value">{formatPrice(result.last_observed_close, currency)}</span>
                </div>
              </div>
              <div className="results-stat-card">
                <span className="stat-icon">🎯</span>
                <div className="stat-content">
                  <span className="stat-label">Predicted End</span>
                  <span className="stat-value" style={{ color: COIN_COLORS[result.coin] || '#60a5fa' }}>
                    {formatPrice(result.future_predictions?.[result.future_predictions.length - 1]?.predicted_price, currency)}
                  </span>
                </div>
              </div>
              <div className="results-stat-card">
                <span className="stat-icon">📈</span>
                <div className="stat-content">
                  <span className="stat-label">Expected Change</span>
                  {(() => {
                    const startPrice = result.last_observed_close;
                    const endPrice = result.future_predictions?.[result.future_predictions.length - 1]?.predicted_price;
                    const change = startPrice && endPrice ? ((endPrice - startPrice) / startPrice) * 100 : 0;
                    return (
                      <span className={`stat-value ${change >= 0 ? 'positive' : 'negative'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="results-stat-card">
                <span className="stat-icon">🕐</span>
                <div className="stat-content">
                  <span className="stat-label">Generated At</span>
                  <span className="stat-value stat-time">
                    {new Date(result.generated_at || Date.now()).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Prediction Chart */}
            {result.future_predictions && result.future_predictions.length > 0 && (
              <div className="predict-chart-container">
                <h4>📈 Price Prediction Curve</h4>
                <PredictionResultChart
                  predictions={result.future_predictions}
                  basePrice={result.last_observed_close}
                  coin={result.coin}
                  currency={currency}
                />
              </div>
            )}

            <div className="predict-results-list">
              <div className="predict-results-header">
                <h4>Predicted Values</h4>
                <button
                  className="download-csv-btn"
                  onClick={() => {
                    const predictions = result.future_predictions || [];
                    const coinName = COIN_LABELS[result.coin] || result.coin;
                    const csvHeader = 'Timestamp,Predicted Price (USD)\n';
                    const csvRows = predictions.map(p =>
                      `${p.timestamp},${p.predicted_price.toFixed(2)}`
                    ).join('\n');
                    const csvContent = csvHeader + csvRows;
                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${coinName}_${result.horizon}_prediction_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  📥 Download CSV
                </button>
              </div>
              {result.future_predictions?.slice(0, 10).map((p, i) => (
                <div key={i} className="predict-result-item">
                  <span className="predict-result-time">
                    {new Date(p.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </span>
                  <span className="predict-result-price">{formatPrice(p.predicted_price, currency)}</span>
                </div>
              ))}
              {result.future_predictions?.length > 10 && (
                <p className="predict-more">
                  ... and {result.future_predictions.length - 10} more predictions
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Model Insights Section
function ModelInsights() {
  return (
    <div className="insights-container">
      <h2>Model Insights</h2>
      <p className="insights-subtitle">Understanding our LSTM prediction model</p>

      <div className="insights-grid">
        {/* Model Architecture */}
        <div className="insight-card">
          <h3>🧠 Model Architecture</h3>
          <ul>
            <li><strong>Type:</strong> LSTM (Long Short-Term Memory)</li>
            <li><strong>Sequence Length:</strong> 48 timesteps</li>
            <li><strong>Features:</strong> 8 input features</li>
            <li><strong>Horizons:</strong> 1-hour and 24-hour predictions</li>
          </ul>
        </div>

        {/* Training Data */}
        <div className="insight-card">
          <h3>📊 Training Data</h3>
          <ul>
            <li><strong>Source:</strong> Binance Historical Data</li>
            <li><strong>Period:</strong> 5 years of hourly data</li>
            <li><strong>Split:</strong> 70% train, 15% validation, 15% test</li>
            <li><strong>Scaling:</strong> MinMax normalization</li>
          </ul>
        </div>

        {/* Features Used */}
        <div className="insight-card">
          <h3>📈 Input Features</h3>
          <ul>
            <li>Close Price</li>
            <li>Volume</li>
            <li>1h Return</li>
            <li>24h Volatility</li>
            <li>24h & 168h Moving Averages</li>
            <li>MA Ratio & Volume Change</li>
          </ul>
        </div>

        {/* Supported Coins */}
        <div className="insight-card">
          <h3>🪙 Supported Cryptocurrencies</h3>
          <ul>
            <li>₿ Bitcoin (BTC)</li>
            <li>Ξ Ethereum (ETH)</li>
            <li>◎ Solana (SOL)</li>
            <li>₳ Cardano (ADA)</li>
            <li>🔶 Binance Coin (BNB)</li>
          </ul>
        </div>

        {/* How It Works */}
        <div className="insight-card insight-card-wide">
          <h3>⚙️ How Predictions Work</h3>
          <ol>
            <li><strong>Data Collection:</strong> Fetch latest 48 hours of price data from Binance API</li>
            <li><strong>Feature Engineering:</strong> Calculate technical indicators (returns, volatility, MAs)</li>
            <li><strong>Normalization:</strong> Scale features using pre-fitted MinMax scaler</li>
            <li><strong>Prediction:</strong> Feed sequence into trained LSTM model</li>
            <li><strong>Iterative Forecasting:</strong> Use each prediction as input for next timestep</li>
          </ol>
        </div>

        {/* Disclaimer */}
        <div className="insight-card insight-card-wide insight-warning">
          <h3>⚠️ Important Disclaimer</h3>
          <p>
            This model is for <strong>educational and research purposes only</strong>.
            Cryptocurrency markets are highly volatile and unpredictable.
            Past performance does not guarantee future results.
            Never invest more than you can afford to lose.
          </p>
        </div>
      </div>
    </div>
  );
}

// Investment Simulator - Historical Returns & Future Predictions
function InvestmentSimulator() {
  const [mode, setMode] = useState("future"); // "historical" or "future"
  const [coin, setCoin] = useState("bitcoin");
  const [investDate, setInvestDate] = useState("2020-01-01");
  const [amount, setAmount] = useState(1000);
  const [horizon, setHorizon] = useState("1h");
  const [stepsAhead, setStepsAhead] = useState(6);
  const [currency, setCurrency] = useState("USD");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const USD_TO_INR = 89;

  // Historical prices for simulation (approximate prices on key dates)
  const HISTORICAL_PRICES = {
    bitcoin: {
      "2013-01-01": 13, "2014-01-01": 770, "2015-01-01": 315, "2016-01-01": 430,
      "2017-01-01": 1000, "2018-01-01": 14000, "2019-01-01": 3700, "2020-01-01": 7200,
      "2021-01-01": 29000, "2022-01-01": 47000, "2023-01-01": 16500, "2024-01-01": 42000,
      "2024-06-01": 67000, "2024-12-01": 97000, current: 97500
    },
    ethereum: {
      "2016-01-01": 1, "2017-01-01": 8, "2018-01-01": 750, "2019-01-01": 130,
      "2020-01-01": 130, "2021-01-01": 730, "2022-01-01": 3700, "2023-01-01": 1200,
      "2024-01-01": 2300, "2024-06-01": 3800, "2024-12-01": 3400, current: 3400
    },
    solana: {
      "2020-06-01": 0.50, "2021-01-01": 1.50, "2021-06-01": 35, "2022-01-01": 170,
      "2023-01-01": 10, "2024-01-01": 100, "2024-06-01": 150, "2024-12-01": 220, current: 220
    },
    cardano: {
      "2018-01-01": 1.20, "2019-01-01": 0.04, "2020-01-01": 0.03, "2021-01-01": 0.18,
      "2022-01-01": 1.35, "2023-01-01": 0.25, "2024-01-01": 0.60, "2024-12-01": 0.90, current: 0.90
    },
    binancecoin: {
      "2018-01-01": 8, "2019-01-01": 6, "2020-01-01": 14, "2021-01-01": 38,
      "2022-01-01": 520, "2023-01-01": 250, "2024-01-01": 310, "2024-12-01": 700, current: 700
    }
  };

  const COIN_OPTIONS = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC", icon: "₿", color: "#f7931a" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "Ξ", color: "#627eea" },
    { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "#9945ff" },
    { id: "cardano", name: "Cardano", symbol: "ADA", icon: "₳", color: "#0033ad" },
    { id: "binancecoin", name: "BNB", symbol: "BNB", icon: "🔶", color: "#f3ba2f" }
  ];

  const formatPrice = (price) => {
    if (!price && price !== 0) return "-";
    const converted = currency === "INR" ? price * USD_TO_INR : price;
    const symbol = currency === "INR" ? "₹" : "$";
    if (Math.abs(converted) >= 1000000) return `${symbol}${(converted / 1000000).toFixed(2)}M`;
    if (Math.abs(converted) >= 1000) return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (Math.abs(converted) >= 1) return `${symbol}${converted.toFixed(2)}`;
    return `${symbol}${converted.toFixed(4)}`;
  };

  const findClosestPrice = (coinId, targetDate) => {
    const prices = HISTORICAL_PRICES[coinId];
    if (!prices) return null;
    const dates = Object.keys(prices).filter(d => d !== "current").sort();
    let closestDate = dates[0];
    for (const date of dates) {
      if (date <= targetDate) closestDate = date;
      else break;
    }
    return { date: closestDate, price: prices[closestDate] };
  };

  const calculateHistorical = () => {
    setLoading(true);
    setTimeout(() => {
      const historical = findClosestPrice(coin, investDate);
      if (!historical) {
        setResult({ error: "No historical data available for this date" });
        setLoading(false);
        return;
      }
      const currentPrice = HISTORICAL_PRICES[coin]?.current || 0;
      const coinsBought = amount / historical.price;
      const currentValue = coinsBought * currentPrice;
      const profit = currentValue - amount;
      const percentChange = ((currentValue - amount) / amount) * 100;
      setResult({
        mode: "historical",
        investDate: historical.date,
        priceAtInvest: historical.price,
        coinsBought,
        currentPrice,
        currentValue,
        profit,
        percentChange
      });
      setLoading(false);
    }, 300);
  };

  const calculateFuture = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin,
          horizon,
          steps_ahead: stepsAhead,
          use_live_data: true
        })
      });
      const data = await response.json();

      if (data.error || data.detail) {
        setResult({ error: data.error || data.detail });
        setLoading(false);
        return;
      }

      const currentPrice = data.last_observed_close;
      const predictedPrice = data.future_predictions?.[data.future_predictions.length - 1]?.predicted_price || 0;
      const coinsBought = amount / currentPrice;
      const predictedValue = coinsBought * predictedPrice;
      const profit = predictedValue - amount;
      const percentChange = ((predictedValue - amount) / amount) * 100;
      const timeframe = horizon === "1h" ? `${stepsAhead} hour${stepsAhead > 1 ? "s" : ""}` : `${stepsAhead} day${stepsAhead > 1 ? "s" : ""}`;

      // Calculate best and worst case scenarios (+/- 15% variance)
      const bestCasePrice = predictedPrice * 1.15;
      const worstCasePrice = predictedPrice * 0.85;
      const bestCaseValue = coinsBought * bestCasePrice;
      const worstCaseValue = coinsBought * worstCasePrice;
      const bestCaseProfit = bestCaseValue - amount;
      const worstCaseProfit = worstCaseValue - amount;

      setResult({
        mode: "future",
        timeframe,
        currentPrice,
        predictedPrice,
        coinsBought,
        predictedValue,
        profit,
        percentChange,
        bestCase: { price: bestCasePrice, value: bestCaseValue, profit: bestCaseProfit },
        worstCase: { price: worstCasePrice, value: worstCaseValue, profit: worstCaseProfit },
        predictions: data.future_predictions
      });
    } catch (err) {
      setResult({ error: "Failed to fetch prediction. Please try again." });
    }
    setLoading(false);
  };

  const handleCalculate = () => {
    setResult(null);
    if (mode === "historical") {
      calculateHistorical();
    } else {
      calculateFuture();
    }
  };

  const selectedCoin = COIN_OPTIONS.find(c => c.id === coin);

  return (
    <div className="simulator-container">
      <h2>Investment Simulator</h2>
      <p className="simulator-subtitle">Calculate historical returns or predict future gains</p>

      {/* Mode Toggle */}
      <div className="simulator-mode-toggle">
        <button className={mode === "future" ? "active" : ""} onClick={() => setMode("future")}>
          Future Prediction
        </button>
        <button className={mode === "historical" ? "active" : ""} onClick={() => setMode("historical")}>
          Historical Returns
        </button>
      </div>

      <div className="simulator-form">
        <div className="simulator-row">
          <div className="simulator-field">
            <label>Cryptocurrency</label>
            <select value={coin} onChange={(e) => setCoin(e.target.value)}>
              {COIN_OPTIONS.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          {mode === "historical" ? (
            <div className="simulator-field">
              <label>Investment Date</label>
              <input
                type="date"
                value={investDate}
                onChange={(e) => setInvestDate(e.target.value)}
                min="2013-01-01"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          ) : (
            <>
              <div className="simulator-field">
                <label>Time Horizon</label>
                <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                  <option value="1h">Hourly</option>
                  <option value="24h">Daily</option>
                </select>
              </div>
              <div className="simulator-field">
                <label>Steps Ahead</label>
                <select value={stepsAhead} onChange={(e) => setStepsAhead(Number(e.target.value))}>
                  <option value={1}>{horizon === "1h" ? "1 Hour" : "1 Day"}</option>
                  <option value={3}>{horizon === "1h" ? "3 Hours" : "3 Days"}</option>
                  <option value={6}>{horizon === "1h" ? "6 Hours" : "6 Days"}</option>
                  <option value={12}>{horizon === "1h" ? "12 Hours" : "12 Days"}</option>
                  <option value={24}>{horizon === "1h" ? "24 Hours" : "24 Days"}</option>
                </select>
              </div>
            </>
          )}

          <div className="simulator-field">
            <label>Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min="1"
              step="100"
            />
          </div>
          <div className="simulator-field">
            <label>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">$ USD</option>
              <option value="INR">₹ INR</option>
            </select>
          </div>
        </div>

        <button className="simulator-btn" onClick={handleCalculate} disabled={loading}>
          {loading ? "Calculating..." : mode === "future" ? "Predict Future Value" : "Calculate Returns"}
        </button>
      </div>

      {/* Results */}
      {result && !result.error && (
        <div className="simulator-results">
          <div className="simulator-result-header">
            <span className="result-coin-icon" style={{ color: selectedCoin?.color }}>
              {selectedCoin?.icon}
            </span>
            <div>
              <h3>{selectedCoin?.name} {result.mode === "future" ? "Prediction" : "Investment"}</h3>
              <span className="result-date">
                {result.mode === "future" ? `In ${result.timeframe}` : `Since ${result.investDate}`}
              </span>
            </div>
          </div>

          <div className="simulator-stats">
            <div className="sim-stat">
              <span className="sim-stat-label">Investment</span>
              <span className="sim-stat-value">{formatPrice(amount)}</span>
            </div>
            <div className="sim-stat">
              <span className="sim-stat-label">{result.mode === "future" ? "Current Price" : "Price at Purchase"}</span>
              <span className="sim-stat-value">{formatPrice(result.mode === "future" ? result.currentPrice : result.priceAtInvest)}</span>
            </div>
            <div className="sim-stat">
              <span className="sim-stat-label">Coins {result.mode === "future" ? "Purchased" : "Bought"}</span>
              <span className="sim-stat-value">{result.coinsBought.toFixed(6)} {selectedCoin?.symbol}</span>
            </div>
            <div className="sim-stat">
              <span className="sim-stat-label">{result.mode === "future" ? "Predicted Price" : "Current Price"}</span>
              <span className="sim-stat-value">{formatPrice(result.mode === "future" ? result.predictedPrice : result.currentPrice)}</span>
            </div>
          </div>

          <div className="simulator-profit-box" style={{
            background: result.profit >= 0
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))",
            borderColor: result.profit >= 0 ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"
          }}>
            <div className="profit-row">
              <span>{result.mode === "future" ? "Predicted Value" : "Current Value"}</span>
              <span className="profit-value">{formatPrice(result.mode === "future" ? result.predictedValue : result.currentValue)}</span>
            </div>
            <div className="profit-row">
              <span>{result.profit >= 0 ? "Expected Profit" : "Expected Loss"}</span>
              <span className={`profit-value ${result.profit >= 0 ? "positive" : "negative"}`}>
                {result.profit >= 0 ? "+" : ""}{formatPrice(result.profit)}
              </span>
            </div>
            <div className="profit-row">
              <span>Return</span>
              <span className={`profit-value ${result.percentChange >= 0 ? "positive" : "negative"}`}>
                {result.percentChange >= 0 ? "↑" : "↓"} {Math.abs(result.percentChange).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Best Case & Worst Case for Future mode */}
          {result.mode === "future" && result.bestCase && result.worstCase && (
            <div className="scenario-boxes">
              <div className="scenario-box best">
                <div className="scenario-header">Best Case (+15%)</div>
                <div className="scenario-row">
                  <span>Predicted Price</span>
                  <span>{formatPrice(result.bestCase.price)}</span>
                </div>
                <div className="scenario-row">
                  <span>Portfolio Value</span>
                  <span>{formatPrice(result.bestCase.value)}</span>
                </div>
                <div className="scenario-row">
                  <span>Profit</span>
                  <span className="positive">+{formatPrice(result.bestCase.profit)}</span>
                </div>
              </div>
              <div className="scenario-box worst">
                <div className="scenario-header">Worst Case (-15%)</div>
                <div className="scenario-row">
                  <span>Predicted Price</span>
                  <span>{formatPrice(result.worstCase.price)}</span>
                </div>
                <div className="scenario-row">
                  <span>Portfolio Value</span>
                  <span>{formatPrice(result.worstCase.value)}</span>
                </div>
                <div className="scenario-row">
                  <span>{result.worstCase.profit >= 0 ? "Profit" : "Loss"}</span>
                  <span className={result.worstCase.profit >= 0 ? "positive" : "negative"}>
                    {result.worstCase.profit >= 0 ? "+" : ""}{formatPrice(result.worstCase.profit)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className="simulator-disclaimer">
            {result.mode === "future"
              ? "*ML-based prediction. Cryptocurrency markets are volatile. This is not financial advice."
              : "*Based on approximate historical prices. Actual returns may vary."
            }
          </p>
        </div>
      )}

      {result?.error && (
        <div className="simulator-error">{result.error}</div>
      )}
    </div>
  );
}

// Compare Coins Section
const COINS_LIST = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", icon: "₿", color: "#f7931a" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "Ξ", color: "#627eea" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "#9945ff" },
  { id: "cardano", name: "Cardano", symbol: "ADA", icon: "₳", color: "#0033ad" },
  { id: "binancecoin", name: "BNB", symbol: "BNB", icon: "🔶", color: "#f3ba2f" },
];

function CompareCoins({ currentPrices, historicalData, fetchHistorical }) {
  const [coinA, setCoinA] = useState("bitcoin");
  const [coinB, setCoinB] = useState("ethereum");
  const [currency, setCurrency] = useState("USD");
  const [historicalA, setHistoricalA] = useState([]);
  const [historicalB, setHistoricalB] = useState([]);
  const [loadingPredA, setLoadingPredA] = useState(false);
  const [loadingPredB, setLoadingPredB] = useState(false);
  const [predictionA, setPredictionA] = useState(null);
  const [predictionB, setPredictionB] = useState(null);

  // All Time High/Low data (as of Dec 2024)
  const ATH_ATL_DATA = {
    bitcoin: { ath: 108786, athDate: "Dec 2024", atl: 67.81, atlDate: "Jul 2013" },
    ethereum: { ath: 4878, athDate: "Nov 2021", atl: 0.42, atlDate: "Oct 2015" },
    solana: { ath: 263, athDate: "Nov 2024", atl: 0.50, atlDate: "May 2020" },
    cardano: { ath: 3.10, athDate: "Sep 2021", atl: 0.017, atlDate: "Mar 2020" },
    binancecoin: { ath: 793, athDate: "Dec 2024", atl: 0.10, atlDate: "Aug 2017" },
  };

  const USD_TO_INR = 89;

  const formatPrice = (price) => {
    if (!price) return "...";
    const converted = currency === "INR" ? price * USD_TO_INR : price;
    const symbol = currency === "INR" ? "₹" : "$";
    if (converted >= 100000) return `${symbol}${(converted / 1000).toFixed(0)}K`;
    if (converted >= 1000) return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (converted >= 1) return `${symbol}${converted.toFixed(2)}`;
    return `${symbol}${converted.toFixed(4)}`;
  };

  const getCoinData = (coinId) => COINS_LIST.find(c => c.id === coinId);
  const coinAData = getCoinData(coinA);
  const coinBData = getCoinData(coinB);

  // Fetch historical data for both coins
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resA = await fetch(`http://127.0.0.1:8000/historical/${coinA}?limit=168`);
        const dataA = await resA.json();
        // API returns {prices: [{timestamp, price}, ...]} - convert to expected format
        const histA = dataA.prices?.map(p => ({ close: p.price, timestamp: p.timestamp })) || [];
        setHistoricalA(histA);
        console.log(`Historical data for ${coinA}:`, histA.length, 'points');

        const resB = await fetch(`http://127.0.0.1:8000/historical/${coinB}?limit=168`);
        const dataB = await resB.json();
        const histB = dataB.prices?.map(p => ({ close: p.price, timestamp: p.timestamp })) || [];
        setHistoricalB(histB);
        console.log(`Historical data for ${coinB}:`, histB.length, 'points');
      } catch (err) {
        console.error("Error fetching historical data:", err);
      }
    };
    fetchData();
  }, [coinA, coinB]);

  // Calculate metrics
  const priceA = currentPrices?.[coinA] || 0;
  const priceB = currentPrices?.[coinB] || 0;

  const calcChange = (data) => {
    if (!data || data.length < 24) return 0;
    const latest = data[data.length - 1]?.close || data[data.length - 1]?.price || 0;
    const prev = data[data.length - 24]?.close || data[data.length - 24]?.price || latest;
    return prev ? ((latest - prev) / prev) * 100 : 0;
  };

  const changeA = calcChange(historicalA);
  const changeB = calcChange(historicalB);

  const calcVolatility = (data) => {
    if (!data || data.length < 24) return 0;
    const returns = [];
    for (let i = 1; i < Math.min(24, data.length); i++) {
      const curr = data[data.length - i]?.close || data[data.length - i]?.price || 0;
      const prev = data[data.length - i - 1]?.close || data[data.length - i - 1]?.price || curr;
      if (prev) returns.push((curr - prev) / prev);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100;
  };

  const volatilityA = calcVolatility(historicalA);
  const volatilityB = calcVolatility(historicalB);

  // Calculate 7-day change
  const calc7DayChange = (data) => {
    if (!data || data.length < 168) return 0; // 24 * 7 = 168 hours
    const latest = data[data.length - 1]?.close || data[data.length - 1]?.price || 0;
    const prev = data[0]?.close || data[0]?.price || latest;
    return prev ? ((latest - prev) / prev) * 100 : 0;
  };

  const change7DayA = calc7DayChange(historicalA);
  const change7DayB = calc7DayChange(historicalB);

  // Momentum Score (based on price trend - MA crossover concept)
  const calcMomentum = (data) => {
    if (!data || data.length < 48) return 50; // Neutral if not enough data
    const recent = data.slice(-24); // Last 24 points
    const older = data.slice(-48, -24); // Previous 24 points
    const recentAvg = recent.reduce((a, d) => a + (d.close || d.price || 0), 0) / recent.length;
    const olderAvg = older.reduce((a, d) => a + (d.close || d.price || 0), 0) / older.length;
    // Score from 0-100, 50 is neutral
    const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
    return Math.max(0, Math.min(100, 50 + momentum * 10));
  };

  const momentumA = calcMomentum(historicalA);
  const momentumB = calcMomentum(historicalB);

  // Risk Level (inverse of volatility, normalized)
  const calcRiskLevel = (volatility) => {
    if (volatility < 1) return { level: "Low", score: 20, color: "#34d399" };
    if (volatility < 2) return { level: "Moderate", score: 40, color: "#fbbf24" };
    if (volatility < 3) return { level: "High", score: 70, color: "#f97316" };
    return { level: "Very High", score: 90, color: "#ef4444" };
  };

  const riskA = calcRiskLevel(volatilityA);
  const riskB = calcRiskLevel(volatilityB);

  // Trend Direction
  const calcTrend = (data) => {
    if (!data || data.length < 12) return { direction: "Neutral", strength: 50 };
    const recent = data.slice(-12);
    let upMoves = 0, downMoves = 0;
    for (let i = 1; i < recent.length; i++) {
      const curr = recent[i]?.close || recent[i]?.price || 0;
      const prev = recent[i - 1]?.close || recent[i - 1]?.price || 0;
      if (curr > prev) upMoves++;
      else if (curr < prev) downMoves++;
    }
    const total = upMoves + downMoves || 1;
    const strength = Math.abs(upMoves - downMoves) / total * 100;
    if (upMoves > downMoves) return { direction: "Bullish", strength: 50 + strength / 2, color: "#34d399", icon: "📈" };
    if (downMoves > upMoves) return { direction: "Bearish", strength: 50 - strength / 2, color: "#ef4444", icon: "📉" };
    return { direction: "Neutral", strength: 50, color: "#94a3b8", icon: "➡️" };
  };

  const trendA = calcTrend(historicalA);
  const trendB = calcTrend(historicalB);

  // Calculate investment recommendation score (0-100)
  const calcRecommendation = (change24h, change7Day, volatility, momentum, trend) => {
    let score = 50; // Start neutral
    // Positive change is good (+/-15 points)
    score += Math.min(15, Math.max(-15, change24h * 2));
    // 7-day trend matters (+/-10 points)
    score += Math.min(10, Math.max(-10, change7Day / 2));
    // Lower volatility is better for stability (+/-10 points)
    score -= Math.min(10, volatility * 2);
    // Momentum contributes (+/-10 points)
    score += (momentum - 50) / 5;
    // Trend direction (+/-5 points)
    if (trend.direction === "Bullish") score += 5;
    else if (trend.direction === "Bearish") score -= 5;

    return Math.max(0, Math.min(100, score));
  };

  const recommendationA = calcRecommendation(changeA, change7DayA, volatilityA, momentumA, trendA);
  const recommendationB = calcRecommendation(changeB, change7DayB, volatilityB, momentumB, trendB);

  const getRecommendationLabel = (score) => {
    // More subtle, glassmorphic colors
    if (score >= 70) return { label: "Strong Buy", bg: "rgba(34, 197, 94, 0.2)", color: "#4ade80", icon: "🚀" };
    if (score >= 55) return { label: "Buy", bg: "rgba(52, 211, 153, 0.2)", color: "#6ee7b7", icon: "✅" };
    if (score >= 45) return { label: "Hold", bg: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", icon: "⏸" };
    if (score >= 30) return { label: "Sell", bg: "rgba(251, 146, 60, 0.2)", color: "#fb923c", icon: "⚠" };
    return { label: "Strong Sell", bg: "rgba(248, 113, 113, 0.2)", color: "#f87171", icon: "🔻" };
  };

  const recLabelA = getRecommendationLabel(recommendationA);
  const recLabelB = getRecommendationLabel(recommendationB);

  // Prediction handler
  const handlePredict = async () => {
    setLoadingPredA(true);
    setLoadingPredB(true);
    setPredictionA(null);
    setPredictionB(null);

    try {
      const [resA, resB] = await Promise.all([
        fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coin: coinA, horizon: "24h", steps_ahead: 6, use_live_data: true }),
        }),
        fetch("http://127.0.0.1:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coin: coinB, horizon: "24h", steps_ahead: 6, use_live_data: true }),
        }),
      ]);

      const dataA = await resA.json();
      const dataB = await resB.json();

      if (dataA.future_predictions?.length) {
        const lastPred = dataA.future_predictions[dataA.future_predictions.length - 1];
        const basePrice = dataA.last_observed_close || dataA.base_price;
        const pctChange = basePrice ? ((lastPred.predicted_price - basePrice) / basePrice) * 100 : 0;
        setPredictionA({ price: lastPred.predicted_price, change: pctChange });
      }

      if (dataB.future_predictions?.length) {
        const lastPred = dataB.future_predictions[dataB.future_predictions.length - 1];
        const basePrice = dataB.last_observed_close || dataB.base_price;
        const pctChange = basePrice ? ((lastPred.predicted_price - basePrice) / basePrice) * 100 : 0;
        setPredictionB({ price: lastPred.predicted_price, change: pctChange });
      }
    } catch (err) {
      console.error("Prediction error:", err);
    } finally {
      setLoadingPredA(false);
      setLoadingPredB(false);
    }
  };

  const MetricCard = ({ label, valueA, valueB, formatFn, higherIsBetter = true, suffix = "" }) => {
    const numA = parseFloat(valueA) || 0;
    const numB = parseFloat(valueB) || 0;
    const winnerA = higherIsBetter ? numA > numB : numA < numB;
    const winnerB = higherIsBetter ? numB > numA : numB < numA;

    return (
      <div className="metric-row">
        <div className="metric-label">{label}</div>
        <div className={`metric-value-a ${winnerA ? "winner" : ""}`}>
          {formatFn ? formatFn(valueA) : valueA}{suffix}
        </div>
        <div className={`metric-value-b ${winnerB ? "winner" : ""}`}>
          {formatFn ? formatFn(valueB) : valueB}{suffix}
        </div>
      </div>
    );
  };

  return (
    <div className="compare-container">
      {/* Header with Selectors */}
      <div className="compare-header">
        <h2>Compare Cryptocurrencies</h2>
        <div className="compare-controls">
          <div className="compare-selectors">
            <div className="coin-select-wrapper" style={{ borderColor: coinAData?.color }}>
              <span className="coin-select-icon" style={{ color: coinAData?.color }}>{coinAData?.icon}</span>
              <select value={coinA} onChange={(e) => setCoinA(e.target.value)} className="coin-select">
                {COINS_LIST.map(c => (
                  <option key={c.id} value={c.id} disabled={c.id === coinB}>{c.name}</option>
                ))}
              </select>
            </div>
            <span className="vs-badge">VS</span>
            <div className="coin-select-wrapper" style={{ borderColor: coinBData?.color }}>
              <span className="coin-select-icon" style={{ color: coinBData?.color }}>{coinBData?.icon}</span>
              <select value={coinB} onChange={(e) => setCoinB(e.target.value)} className="coin-select">
                {COINS_LIST.map(c => (
                  <option key={c.id} value={c.id} disabled={c.id === coinA}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="currency-toggle">
            <button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")}>USD</button>
            <button className={currency === "INR" ? "active" : ""} onClick={() => setCurrency("INR")}>INR</button>
          </div>
        </div>
      </div>

      {/* Quick Recommendation Summary */}
      <div className="compare-recommendation-compact">
        <div className="rec-item" style={{ borderLeft: `3px solid ${recLabelA.color}` }}>
          <span className="rec-coin">{coinAData?.name}</span>
          <span className="rec-badge" style={{ background: recLabelA.bg, color: recLabelA.color, border: `1px solid ${recLabelA.color}40` }}>{recLabelA.icon} {recLabelA.label}</span>
          <span className="rec-score">{recommendationA.toFixed(0)}/100</span>
        </div>
        <div className="rec-item" style={{ borderLeft: `3px solid ${recLabelB.color}` }}>
          <span className="rec-coin">{coinBData?.name}</span>
          <span className="rec-badge" style={{ background: recLabelB.bg, color: recLabelB.color, border: `1px solid ${recLabelB.color}40` }}>{recLabelB.icon} {recLabelB.label}</span>
          <span className="rec-score">{recommendationB.toFixed(0)}/100</span>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="metrics-table">
        <div className="metrics-table-header">
          <div className="th-metric">Metric</div>
          <div className="th-coin" style={{ color: coinAData?.color }}>{coinAData?.icon} {coinAData?.name}</div>
          <div className="th-coin" style={{ color: coinBData?.color }}>{coinBData?.icon} {coinBData?.name}</div>
        </div>

        <div className="metrics-section">
          <div className="section-label">📊 Price</div>
          <MetricCard label="Current Price" valueA={priceA} valueB={priceB} formatFn={formatPrice} />
          <MetricCard label="24h Change" valueA={changeA} valueB={changeB} formatFn={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`} suffix="%" />
          <MetricCard label="7-Day Change" valueA={change7DayA} valueB={change7DayB} formatFn={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`} suffix="%" />
          <MetricCard label="All Time High" valueA={ATH_ATL_DATA[coinA]?.ath} valueB={ATH_ATL_DATA[coinB]?.ath} formatFn={formatPrice} />
          <MetricCard label="All Time Low" valueA={ATH_ATL_DATA[coinA]?.atl} valueB={ATH_ATL_DATA[coinB]?.atl} formatFn={formatPrice} higherIsBetter={false} />
        </div>

        <div className="metrics-section">
          <div className="section-label">📈 Technical</div>
          <MetricCard label="Momentum" valueA={momentumA} valueB={momentumB} formatFn={(v) => v.toFixed(0)} suffix="/100" />
          <MetricCard label="Volatility" valueA={volatilityA} valueB={volatilityB} formatFn={(v) => v.toFixed(2)} suffix="%" higherIsBetter={false} />
          <MetricCard label="Stability" valueA={100 - volatilityA * 20} valueB={100 - volatilityB * 20} formatFn={(v) => Math.max(0, v).toFixed(0)} suffix="/100" />
          <div className="metric-row">
            <div className="metric-label">Trend</div>
            <div className="metric-value-a" style={{ color: trendA.color }}>{trendA.icon} {trendA.direction}</div>
            <div className="metric-value-b" style={{ color: trendB.color }}>{trendB.icon} {trendB.direction}</div>
          </div>
        </div>

        <div className="metrics-section">
          <div className="section-label">⚠️ Risk</div>
          <div className="metric-row">
            <div className="metric-label">Risk Level</div>
            <div className={`metric-value-a ${riskA.score < riskB.score ? "winner" : ""}`} style={{ color: riskA.color }}>
              {riskA.level}
            </div>
            <div className={`metric-value-b ${riskB.score < riskA.score ? "winner" : ""}`} style={{ color: riskB.color }}>
              {riskB.level}
            </div>
          </div>
        </div>
      </div>

      {/* AI Predictions */}
      <div className="compare-predictions-compact">
        <div className="predictions-header-compact">
          <span>🤖 AI Predictions (24h)</span>
          <button className="predict-btn-sm" onClick={handlePredict} disabled={loadingPredA || loadingPredB}>
            {loadingPredA || loadingPredB ? "..." : "Generate"}
          </button>
        </div>
        {(predictionA || predictionB) && (
          <div className="predictions-inline">
            <MetricCard label="Predicted Price" valueA={predictionA?.price || 0} valueB={predictionB?.price || 0} formatFn={formatPrice} />
            <MetricCard label="Expected Change" valueA={predictionA?.change || 0} valueB={predictionB?.change || 0} formatFn={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`} suffix="%" />
          </div>
        )}
      </div>
    </div>
  );
}


export default function Dashboard({ user, onLogout, darkMode, setDarkMode }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [currency, setCurrency] = useState("USD");

  // Coin & prediction state
  const [coin, setCoin] = useState("bitcoin");
  const [horizon, setHorizon] = useState("1h");
  const [stepsAhead, setStepsAhead] = useState(6);
  const [useLiveData, setUseLiveData] = useState(true);

  // Data state
  const [currentPrices, setCurrentPrices] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [chartHours, setChartHours] = useState(168); // Default 7D
  const [history, setHistory] = useState([]);

  // Loading state
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Result & error
  const [predictionResult, setPredictionResult] = useState(null);

  // Ref to prevent double auto-predict (React Strict Mode runs effects twice)
  const hasAutoPredicted = useRef(false);
  const [predictionError, setPredictionError] = useState("");

  // Fetch current prices
  const fetchPrices = useCallback(async () => {
    try {
      const data = await getCurrentPrices();
      const priceMap = {};
      data.prices?.forEach((p) => {
        priceMap[p.coin] = p.price_usd;
      });
      setCurrentPrices(priceMap);
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    }
  }, []);

  // Fetch historical data for selected coin
  const fetchHistorical = useCallback(async (coinId, hours = 168) => {
    setLoadingHistorical(true);
    try {
      // Binance API limit is 1000, so cap at 1000 hours
      const limit = Math.min(hours, 1000);
      const data = await getHistoricalPrices(coinId, limit);
      console.log(`[Dashboard] Historical data received for ${hours}h:`, data);
      setHistoricalData(data.prices || []);
    } catch (err) {
      console.error("Failed to fetch historical:", err);
      setHistoricalData([]);
    } finally {
      setLoadingHistorical(false);
    }
  }, []);

  // Handle chart period change - fetch silently without loading indicator
  const handleChartPeriodChange = useCallback(async (hours) => {
    setChartHours(hours);
    // Fetch without setting loading state for smooth transition
    try {
      const limit = Math.min(hours, 1000);
      const data = await getHistoricalPrices(coin, limit);
      setHistoricalData(data.prices || []);
    } catch (err) {
      console.error("Failed to fetch historical:", err);
    }
  }, [coin]);

  // Fetch prediction history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getHistory();
      setHistory(data.history || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Run prediction
  const handlePredict = async () => {
    setPredictionError("");
    setLoadingPrediction(true);
    setPredictionResult(null);

    try {
      const data = await predictPrice(coin, horizon, stepsAhead, useLiveData);
      // Add generated_at timestamp so it doesn't change on re-render
      data.generated_at = new Date().toISOString();
      setPredictionResult(data);
      setPredictions(data.future_predictions || []);

      // Save to history - only for logged-in users, not guests
      if (user) {
        try {
          // Extract target timestamps from predictions, or generate them if not present
          const targetTimestamps = (data.future_predictions || []).map((p, i) => {
            if (p.timestamp) return p.timestamp;
            // Generate timestamp based on horizon
            const now = new Date();
            const hoursPerStep = horizon === "24h" ? 24 : 1;
            const targetTime = new Date(now.getTime() + (i + 1) * hoursPerStep * 3600000);
            return targetTime.toISOString();
          });

          await saveHistory({
            coin,
            horizon,
            steps_ahead: stepsAhead,
            use_live_data: useLiveData,
            last_observed_close: data.last_observed_close,
            first_predicted_price: data.future_predictions?.[0]?.predicted_price,
            last_predicted_price: data.future_predictions?.[data.future_predictions.length - 1]?.predicted_price,
            predictions: data.future_predictions,
            target_timestamps: targetTimestamps,
          });
          fetchHistory();
        } catch (e) {
          console.error("Failed to save history:", e);
        }
      }
    } catch (err) {
      setPredictionError(err.message);
    } finally {
      setLoadingPrediction(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = async (updates) => {
    return await updateProfile(updates);
  };

  // Handle history rerun
  const handleHistoryRerun = (item) => {
    setCoin(item.coin);
    setHorizon(item.horizon);
    setStepsAhead(item.steps_ahead);
    setActiveSection("predict");
  };

  // Handle history delete
  const handleHistoryDelete = async (id) => {
    try {
      await deleteHistory(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete history:", err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchPrices();
    fetchHistory();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices, fetchHistory]);

  // Re-fetch history when user changes (login/logout)
  // This ensures each user sees their own prediction history
  useEffect(() => {
    fetchHistory();
  }, [user, fetchHistory]);

  // Fetch historical when coin changes
  useEffect(() => {
    fetchHistorical(coin, chartHours);
  }, [coin, fetchHistorical]);

  // Note: Auto-predict removed to prevent double-prediction issues
  // Users can manually click "Generate Prediction" on the dashboard

  return (
    <div className={`dashboard-layout ${darkMode ? 'dark' : 'light'}`}>
      {/* Animated background orbs (matching landing page) */}
      <div className="dashboardBg">
        <div className="gradientOrb orb1" />
        <div className="gradientOrb orb2" />
        <div className="gradientOrb orb3" />
      </div>

      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        user={user}
        onLogout={onLogout}
      />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>
            {activeSection === "dashboard" && "Dashboard"}
            {activeSection === "predict" && "Price Prediction"}
            {activeSection === "compare" && "Compare Coins"}
            {activeSection === "simulator" && "Investment Simulator"}
            {activeSection === "history" && "Prediction History"}
            {activeSection === "insights" && "Model Insights"}
            {activeSection === "profile" && "User Profile"}
          </h1>

          <div className="dashboard-header-controls">
            {/* Profile Avatar - click to go to profile */}
            <button
              className="header-profile-btn"
              onClick={() => setActiveSection("profile")}
              title="Your Profile"
            >
              {user?.picture ? (
                <img src={user.picture} alt={user?.name || "User"} className="header-profile-avatar" />
              ) : (
                <span className="header-profile-initial">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </span>
              )}
            </button>

            {/* Dark Mode Toggle - same style as landing page */}
            <button
              className="themeToggle"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <div className="toggleTrack">
                <div className={`toggleThumb ${darkMode ? 'dark' : ''}`}>
                  {darkMode ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          </div>
        </header>

        {/* Live Prices Bar - Show only on predict and history sections */}
        {(activeSection === "predict" || activeSection === "history") && (
          <div className="live-prices-bar">
            <span className="live-indicator">🔴 LIVE</span>
            {Object.keys(currentPrices).length === 0 ? (
              <span className="live-loading">Loading prices...</span>
            ) : (
              Object.entries(currentPrices).map(([coinId, price]) => (
                <div key={coinId} className="live-price-item">
                  <span className="live-price-coin">
                    {coinId === "bitcoin" && "₿"}
                    {coinId === "ethereum" && "Ξ"}
                    {coinId === "solana" && "◎"}
                    {coinId === "cardano" && "₳"}
                    {coinId === "binancecoin" && "🔶"}
                  </span>
                  <span className="live-price-name">
                    {coinId === "bitcoin" && "BTC"}
                    {coinId === "ethereum" && "ETH"}
                    {coinId === "solana" && "SOL"}
                    {coinId === "cardano" && "ADA"}
                    {coinId === "binancecoin" && "BNB"}
                  </span>
                  <span className="live-price-value">
                    {formatPrice(price, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="dashboard-content">
          {activeSection === "dashboard" && (
            <DashboardHome
              coin={coin}
              setCoin={setCoin}
              currentPrices={currentPrices}
              historicalData={historicalData}
              predictions={predictions}
              loadingHistorical={loadingHistorical}
              loadingPrediction={loadingPrediction}
              onPredict={handlePredict}
              currency={currency}
              onCurrencyChange={setCurrency}
              onPeriodChange={handleChartPeriodChange}
            />
          )}

          {activeSection === "predict" && (
            <PredictSection
              coin={coin}
              setCoin={setCoin}
              horizon={horizon}
              setHorizon={setHorizon}
              stepsAhead={stepsAhead}
              setStepsAhead={setStepsAhead}
              useLiveData={useLiveData}
              setUseLiveData={setUseLiveData}
              currentPrices={currentPrices}
              onPredict={handlePredict}
              loading={loadingPrediction}
              result={predictionResult}
              error={predictionError}
              currency={currency}
              onCurrencyChange={setCurrency}
            />
          )}

          {activeSection === "history" && (
            <PredictionHistory
              history={history}
              loading={loadingHistory}
              onRerun={handleHistoryRerun}
              onDelete={handleHistoryDelete}
              onRefresh={fetchHistory}
            />
          )}

          {activeSection === "compare" && (
            <CompareCoins
              currentPrices={currentPrices}
              historicalData={historicalData}
              fetchHistorical={fetchHistorical}
            />
          )}

          {activeSection === "simulator" && (
            <InvestmentSimulator currency={currency} />
          )}

          {activeSection === "insights" && (
            <ModelInsights />
          )}

          {activeSection === "profile" && (
            <UserProfile
              user={user}
              onUpdateProfile={handleUpdateProfile}
            />
          )}
        </div>
      </main>


    </div>
  );
}
