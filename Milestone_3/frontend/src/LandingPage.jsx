/**
 * LandingPage.jsx - Cryptocurrency Future Price Prediction Platform
 * 
 * A stunning landing page featuring:
 * - Glassmorphism design with frosted glass effects
 * - Dark/Light mode toggle
 * - Animated floating crypto symbols
 * - Feature showcase with glass cards
 * - Statistics section
 * - Smooth animations and micro-interactions
 */

import { useState, useEffect } from "react";

/* ========================================
   ICON COMPONENTS
   ======================================== */

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {/* Q Shape: Circle + Tail */}
      <path
        d="M12 21a9 9 0 1 1 9-9c0 1.1-.18 2.15-.5 3.12M17 17l4 4"
        stroke="url(#chartGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Rising Chart Line inside */}
      <path
        d="M8 12l2.5 2.5 5.5-5.5"
        stroke="url(#chartGrad)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="chartGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 4.5a2.5 2.5 0 00-4.96-.46 2.5 2.5 0 00-1.98 3 2.5 2.5 0 00.47 4.96v.01a2.5 2.5 0 002.96 2.46 2.5 2.5 0 003.02 1.52" stroke="url(#brainGrad1)" />
      <path d="M12 4.5a2.5 2.5 0 014.96-.46 2.5 2.5 0 011.98 3 2.5 2.5 0 01-.47 4.96v.01a2.5 2.5 0 01-2.96 2.46 2.5 2.5 0 01-3.02 1.52" stroke="url(#brainGrad2)" />
      <path d="M12 4.5v16" stroke="url(#brainGrad1)" strokeLinecap="round" />
      <defs>
        <linearGradient id="brainGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="brainGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconLightning() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="url(#lightGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="lightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="url(#shieldGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="url(#globeGrad)" strokeWidth="1.5" />
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="url(#globeGrad)" strokeWidth="1.5" />
      <defs>
        <linearGradient id="globeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Floating crypto icons
function IconBitcoin() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z" fill="#F7931A" />
      <path d="M17.3 10.4c.24-1.6-.98-2.46-2.64-3.03l.54-2.16-1.32-.33-.52 2.1c-.35-.09-.7-.17-1.06-.25l.53-2.11-1.32-.33-.54 2.16c-.29-.07-.57-.13-.85-.2l-1.82-.45-.35 1.41s.98.22.96.24c.53.13.63.49.61.77l-.61 2.46c.04.01.08.02.13.04l-.13-.03-.86 3.44c-.06.16-.23.4-.6.3.01.02-.96-.24-.96-.24l-.66 1.51 1.72.43c.32.08.63.16.94.24l-.55 2.2 1.32.33.54-2.17c.36.1.71.19 1.06.28l-.54 2.15 1.32.33.55-2.2c2.26.43 3.96.26 4.68-1.79.58-1.65-.03-2.6-1.22-3.22.87-.2 1.52-.77 1.7-1.95zm-3.04 4.26c-.41 1.65-3.18.76-4.08.53l.73-2.92c.9.22 3.78.67 3.35 2.39zm.41-4.29c-.37 1.5-2.68.74-3.43.55l.66-2.65c.75.19 3.16.54 2.77 2.1z" fill="#FFF" />
    </svg>
  );
}

function IconEthereum() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#627EEA" />
      <path d="M12.373 3v6.652l5.623 2.513L12.373 3z" fill="#FFF" fillOpacity=".602" />
      <path d="M12.373 3L6.75 12.165l5.623-2.513V3z" fill="#FFF" />
      <path d="M12.373 16.476v4.52l5.627-7.784-5.627 3.264z" fill="#FFF" fillOpacity=".602" />
      <path d="M12.373 20.996v-4.52L6.75 13.212l5.623 7.784z" fill="#FFF" />
    </svg>
  );
}

function IconSolana() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="url(#solGradBg)" />
      <path d="M7 15.5l2-2h8l-2 2H7zM7 8.5l2 2h8l-2-2H7zM7 12l2 2h8l-2-2H7z" fill="#FFF" />
      <defs>
        <linearGradient id="solGradBg" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconCardano() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#0033AD" />
      <circle cx="12" cy="12" r="2" fill="#FFF" />
      <circle cx="12" cy="6" r="1.2" fill="#FFF" />
      <circle cx="12" cy="18" r="1.2" fill="#FFF" />
      <circle cx="6.8" cy="9" r="1.2" fill="#FFF" />
      <circle cx="17.2" cy="9" r="1.2" fill="#FFF" />
      <circle cx="6.8" cy="15" r="1.2" fill="#FFF" />
      <circle cx="17.2" cy="15" r="1.2" fill="#FFF" />
    </svg>
  );
}

function IconBNB() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#F3BA2F" />
      <path d="M12 5l2.5 2.5-4.5 4.5L7.5 9.5 12 5zM16.5 9.5L19 12l-2.5 2.5-2.5-2.5 2.5-2.5zM7.5 9.5L5 12l2.5 2.5 2.5-2.5-2.5-2.5zM12 14l2.5 2.5L12 19l-2.5-2.5L12 14z" fill="#FFF" />
    </svg>
  );
}

export default function LandingPage({ onGetStarted, darkMode, setDarkMode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [prices, setPrices] = useState({
    BTC: { price: null, change: null },
    ETH: { price: null, change: null },
    SOL: { price: null, change: null },
    ADA: { price: null, change: null },
    BNB: { price: null, change: null },
  });

  // Fetch real-time prices from Binance API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'BNBUSDT'];
        const responses = await Promise.all(
          symbols.map(symbol =>
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
              .then(res => res.json())
          )
        );

        const newPrices = {
          BTC: {
            price: parseFloat(responses[0].lastPrice),
            change: parseFloat(responses[0].priceChangePercent)
          },
          ETH: {
            price: parseFloat(responses[1].lastPrice),
            change: parseFloat(responses[1].priceChangePercent)
          },
          SOL: {
            price: parseFloat(responses[2].lastPrice),
            change: parseFloat(responses[2].priceChangePercent)
          },
          ADA: {
            price: parseFloat(responses[3].lastPrice),
            change: parseFloat(responses[3].priceChangePercent)
          },
          BNB: {
            price: parseFloat(responses[4].lastPrice),
            change: parseFloat(responses[4].priceChangePercent)
          },
        };
        setPrices(newPrices);
      } catch (error) {
        console.error('Failed to fetch prices:', error);
      }
    };

    fetchPrices();
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: <IconBrain />,
      title: "AI-Powered Predictions",
      description: "Advanced LSTM neural networks trained on years of historical data for accurate price forecasting."
    },
    {
      icon: <IconLightning />,
      title: "Real-Time Data",
      description: "Live cryptocurrency prices from Binance API with instant updates and market insights."
    },
    {
      icon: <IconShield />,
      title: "Secure & Reliable",
      description: "Bank-grade security with OAuth authentication and encrypted data transmission."
    },
    {
      icon: <IconGlobe />,
      title: "Multi-Currency Support",
      description: "Track and predict prices for Bitcoin, Ethereum, Solana, Cardano, and Binance Coin."
    }
  ];

  const floatingCoins = [
    { Icon: IconBitcoin, size: 50, top: "15%", left: "10%", delay: 0 },
    { Icon: IconEthereum, size: 45, top: "25%", right: "12%", delay: 0.5 },
    { Icon: IconSolana, size: 40, top: "60%", left: "8%", delay: 1 },
    { Icon: IconCardano, size: 35, top: "70%", right: "10%", delay: 1.5 },
    { Icon: IconBNB, size: 42, top: "40%", left: "5%", delay: 2 },
    { Icon: IconBitcoin, size: 30, top: "80%", left: "15%", delay: 2.5 },
    { Icon: IconEthereum, size: 35, top: "10%", right: "25%", delay: 3 },
    { Icon: IconSolana, size: 28, top: "50%", right: "5%", delay: 3.5 },
  ];

  return (
    <div className={`landingPage ${darkMode ? 'dark' : 'light'}`}>
      {/* Animated background */}
      <div className="landingBg">
        <div className="gradientOrb orb1" />
        <div className="gradientOrb orb2" />
        <div className="gradientOrb orb3" />
        <div
          className="mouseGlow"
          style={{
            left: mousePos.x - 200,
            top: mousePos.y - 200,
          }}
        />
      </div>

      {/* Floating crypto icons */}
      <div className="floatingCoins">
        {floatingCoins.map((coin, index) => (
          <div
            key={index}
            className="floatingCoin"
            style={{
              width: coin.size,
              height: coin.size,
              top: coin.top,
              left: coin.left,
              right: coin.right,
              animationDelay: `${coin.delay}s`,
            }}
          >
            <coin.Icon />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <nav className={`landingNav ${isVisible ? 'visible' : ''}`}>
        <div className="navBrand">
          <IconChart />
          <span className="brandText">Quantara</span>
        </div>

        <div className="navActions">
          <button
            className="themeToggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            <div className="toggleTrack">
              <div className={`toggleThumb ${darkMode ? 'dark' : ''}`}>
                {darkMode ? <IconMoon /> : <IconSun />}
              </div>
            </div>
          </button>

          <button className="navLoginBtn" onClick={onGetStarted}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`heroSection ${isVisible ? 'visible' : ''}`}>
        <div className="heroContent">
          <div className="heroBadge">
            <span className="badgeDot" />
            <span>AI-Powered Cryptocurrency Forecasting</span>
          </div>

          <h1 className="heroTitle">
            Predict the Future of
            <span className="gradientText"> Crypto Markets</span>
          </h1>

          <p className="heroSubtitle">
            Harness the power of advanced machine learning to forecast cryptocurrency prices
            with unprecedented accuracy. Make informed decisions with real-time predictions.
          </p>

          <div className="heroButtons">
            <button className="primaryBtn" onClick={onGetStarted}>
              <span>Get Started Free</span>
              <IconArrowRight />
            </button>
          </div>

          {/* Live price ticker */}
          <div className="priceTicker">
            <div className="tickerItem">
              <IconBitcoin />
              <span className="tickerName">BTC</span>
              <span className="tickerPrice">
                {prices.BTC.price ? `$${prices.BTC.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '...'}
              </span>
              <span className={`tickerChange ${prices.BTC.change >= 0 ? 'positive' : 'negative'}`}>
                {prices.BTC.change !== null ? `${prices.BTC.change >= 0 ? '+' : ''}${prices.BTC.change.toFixed(2)}%` : ''}
              </span>
            </div>
            <div className="tickerItem">
              <IconEthereum />
              <span className="tickerName">ETH</span>
              <span className="tickerPrice">
                {prices.ETH.price ? `$${prices.ETH.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '...'}
              </span>
              <span className={`tickerChange ${prices.ETH.change >= 0 ? 'positive' : 'negative'}`}>
                {prices.ETH.change !== null ? `${prices.ETH.change >= 0 ? '+' : ''}${prices.ETH.change.toFixed(2)}%` : ''}
              </span>
            </div>
            <div className="tickerItem">
              <IconSolana />
              <span className="tickerName">SOL</span>
              <span className="tickerPrice">
                {prices.SOL.price ? `$${prices.SOL.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '...'}
              </span>
              <span className={`tickerChange ${prices.SOL.change >= 0 ? 'positive' : 'negative'}`}>
                {prices.SOL.change !== null ? `${prices.SOL.change >= 0 ? '+' : ''}${prices.SOL.change.toFixed(2)}%` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Hero illustration */}
        <div className="heroVisual">
          <div className="dashboardPreview">
            <div className="previewHeader">
              <div className="previewDots">
                <span /><span /><span />
              </div>
              <span className="previewTitle">Price Forecast Dashboard</span>
            </div>
            <div className="previewContent">
              <div className="chartMock">
                <svg viewBox="0 0 400 200" className="mockChart">
                  <defs>
                    <linearGradient id="chartFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 150 Q50 120 100 130 T200 100 T300 80 T400 40"
                    stroke="url(#chartGrad)"
                    strokeWidth="3"
                    fill="none"
                    className="chartLine"
                  />
                  <path
                    d="M0 150 Q50 120 100 130 T200 100 T300 80 T400 40 V200 H0 Z"
                    fill="url(#chartFill)"
                    className="chartArea"
                  />
                  {/* Prediction zone */}
                  <rect x="300" y="0" width="100" height="200" fill="url(#chartFill)" opacity="0.5" />
                  <line x1="300" y1="0" x2="300" y2="200" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5,5" />
                  <text x="340" y="20" fill="#a78bfa" fontSize="12">Forecast</text>
                </svg>
              </div>
              <div className="previewStats">
                <div className="previewStat">
                  <span className="statLabel">Current</span>
                  <span className="statValue">$104,250</span>
                </div>
                <div className="previewStat">
                  <span className="statLabel">Predicted (24h)</span>
                  <span className="statValue positive">$107,800</span>
                </div>
                <div className="previewStat">
                  <span className="statLabel">Confidence</span>
                  <span className="statValue">94.2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={`featuresSection ${isVisible ? 'visible' : ''}`}>
        <div className="sectionHeader">
          <h2 className="sectionTitle">Why Choose CryptoPredict?</h2>
          <p className="sectionSubtitle">
            Advanced technology meets intuitive design for the ultimate crypto forecasting experience
          </p>
        </div>

        <div className="featuresGrid">
          {features.map((feature, index) => (
            <div key={index} className="featureCard" style={{ animationDelay: `${index * 0.15}s` }}>
              <div className="featureIcon">{feature.icon}</div>
              <h3 className="featureTitle">{feature.title}</h3>
              <p className="featureDesc">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className={`ctaSection ${isVisible ? 'visible' : ''}`}>
        <div className="ctaCard">
          <h2 className="ctaTitle">Ready to Predict the Future?</h2>
          <p className="ctaSubtitle">
            Join thousands of traders using AI-powered insights to make smarter investment decisions.
          </p>
          <button className="ctaBtn" onClick={onGetStarted}>
            <span>Start Predicting Now</span>
            <IconArrowRight />
          </button>
        </div>
      </section>
    </div>
  );
}
