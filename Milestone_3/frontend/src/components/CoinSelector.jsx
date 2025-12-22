/**
 * CoinSelector.jsx - Dropdown selectors for coin and currency
 */

import { useState, useRef, useEffect } from "react";

const COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", icon: "₿", color: "#f7931a" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "Ξ", color: "#627eea" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎", color: "#9945ff" },
  { id: "cardano", name: "Cardano", symbol: "ADA", icon: "₳", color: "#0033ad" },
  { id: "binancecoin", name: "BNB", symbol: "BNB", icon: "🔶", color: "#f3ba2f" },
];

const CURRENCIES = [
  { id: "USD", name: "US Dollar", symbol: "$" },
  { id: "INR", name: "Indian Rupee", symbol: "₹" },
];

function formatPrice(price, currency = "USD") {
  if (!price) return "...";
  const USD_TO_INR = 89;
  const converted = currency === "INR" ? price * USD_TO_INR : price;
  const symbol = currency === "INR" ? "₹" : "$";

  if (converted >= 100000) return `${symbol}${(converted / 1000).toFixed(0)}K`;
  if (converted >= 1000) return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (converted >= 1) return `${symbol}${converted.toFixed(2)}`;
  return `${symbol}${converted.toFixed(4)}`;
}

function Dropdown({ options, value, onChange, renderOption, renderSelected, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className="dropdown-container" ref={dropdownRef}>
      {label && <label className="dropdown-label">{label}</label>}
      <button
        className={`dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="dropdown-selected">
          {renderSelected ? renderSelected(selectedOption) : selectedOption?.name}
        </span>
        <svg
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              key={option.id}
              className={`dropdown-item ${value === option.id ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              type="button"
            >
              {renderOption ? renderOption(option) : option.name}
              {value === option.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoinSelector({
  selectedCoin,
  onSelectCoin,
  currentPrices,
  currency = "USD",
  onCurrencyChange
}) {
  const selectedCoinData = COINS.find(c => c.id === selectedCoin);
  const currentPrice = currentPrices?.[selectedCoin];

  return (
    <div className="coin-currency-selectors">
      {/* Coin Dropdown */}
      <Dropdown
        label="Cryptocurrency"
        options={COINS}
        value={selectedCoin}
        onChange={onSelectCoin}
        renderSelected={(coin) => (
          <div className="coin-dropdown-selected">
            <span className="coin-icon" style={{ color: coin?.color }}>{coin?.icon}</span>
            <span className="coin-name">{coin?.name}</span>
            <span className="coin-symbol">({coin?.symbol})</span>
          </div>
        )}
        renderOption={(coin) => (
          <div className="coin-dropdown-option">
            <span className="coin-icon" style={{ color: coin.color }}>{coin.icon}</span>
            <div className="coin-info">
              <span className="coin-name">{coin.name}</span>
              <span className="coin-symbol">{coin.symbol}</span>
            </div>
            <span className="coin-price">{formatPrice(currentPrices?.[coin.id], currency)}</span>
          </div>
        )}
      />

      {/* Currency Dropdown */}
      {onCurrencyChange && (
        <Dropdown
          label="Currency"
          options={CURRENCIES}
          value={currency}
          onChange={onCurrencyChange}
          renderSelected={(curr) => (
            <div className="currency-dropdown-selected">
              <span className="currency-symbol">{curr?.symbol}</span>
              <span className="currency-id">{curr?.id}</span>
            </div>
          )}
          renderOption={(curr) => (
            <div className="currency-dropdown-option">
              <span className="currency-symbol">{curr.symbol}</span>
              <span className="currency-name">{curr.name}</span>
            </div>
          )}
        />
      )}

      {/* Current Price Display */}
      {currentPrice && (
        <div className="selected-coin-price">
          <span className="price-label">Current Price:</span>
          <span className="price-value" style={{ color: selectedCoinData?.color }}>
            {formatPrice(currentPrice, currency)}
          </span>
        </div>
      )}
    </div>
  );
}
