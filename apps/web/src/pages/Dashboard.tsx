import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/firebase';
import type { Holding } from '../services/firebase';
import { 
  CheckCircle, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Briefcase,
  AlertCircle,
  X
} from 'lucide-react';

const ASSET_CLASS_COLORS: Record<string, string> = {
  'Equity': '#8c2a2a',        // Elegant burgundy
  'Crypto': '#B45309',        // Warm amber/gold
  'Cash': '#2C6B50',          // Sage green
  'Fixed Income': '#4A5568',  // Slate blue
  'Real Estate': '#B59963',   // Warm brass/gold
  'Other': '#555555'          // Muted charcoal
};

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loadingHoldings, setLoadingHoldings] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState('Equity');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const fetchHoldings = async () => {
    if (!user) return;
    setLoadingHoldings(true);
    try {
      const list = await dbService.getHoldings(user.uid);
      setHoldings(list);
    } catch (err: any) {
      console.error('Error fetching holdings:', err);
      setError('Failed to load portfolio holdings.');
    } finally {
      setLoadingHoldings(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHoldings();
    }
  }, [user]);

  const openAddModal = () => {
    setEditingHolding(null);
    setSymbol('');
    setName('');
    setAssetClass('Equity');
    setQuantity('');
    setPurchasePrice('');
    setCurrentPrice('');
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setEditingHolding(holding);
    setSymbol(holding.symbol);
    setName(holding.name);
    setAssetClass(holding.assetClass);
    setQuantity(holding.quantity.toString());
    setPurchasePrice(holding.purchasePrice.toString());
    setCurrentPrice(holding.currentPrice.toString());
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!symbol || !name || !quantity || !purchasePrice || !currentPrice) {
      setError('Please fill in all fields.');
      return;
    }

    const qty = parseFloat(quantity);
    const pPrice = parseFloat(purchasePrice);
    const cPrice = parseFloat(currentPrice);

    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }
    if (isNaN(pPrice) || pPrice < 0) {
      setError('Purchase price must be positive or zero.');
      return;
    }
    if (isNaN(cPrice) || cPrice < 0) {
      setError('Current price must be positive or zero.');
      return;
    }

    setSaving(true);
    setError(null);

    const data = {
      symbol: symbol.toUpperCase().trim(),
      name: name.trim(),
      assetClass,
      quantity: qty,
      purchasePrice: pPrice,
      currentPrice: cPrice
    };

    try {
      if (editingHolding) {
        await dbService.updateHolding(user.uid, editingHolding.id, data);
      } else {
        await dbService.addHolding(user.uid, data);
      }
      setIsModalOpen(false);
      await fetchHoldings();
    } catch (err: any) {
      console.error('Error saving holding:', err);
      setError(err.message || 'Failed to save holding.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHolding = async (holdingId: string) => {
    if (!user) return;
    if (window.confirm('Are you sure you want to remove this asset from your portfolio?')) {
      try {
        await dbService.deleteHolding(user.uid, holdingId);
        await fetchHoldings();
      } catch (err: any) {
        console.error('Error deleting holding:', err);
        alert('Failed to delete holding.');
      }
    }
  };

  // Calculations
  const totalCost = holdings.reduce((acc, h) => acc + (h.quantity * h.purchasePrice), 0);
  const totalValue = holdings.reduce((acc, h) => acc + (h.quantity * h.currentPrice), 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  // Allocation Map Calculations
  const allocationMap: Record<string, number> = {};
  holdings.forEach(h => {
    const val = h.quantity * h.currentPrice;
    allocationMap[h.assetClass] = (allocationMap[h.assetClass] || 0) + val;
  });

  const allocationList = Object.entries(allocationMap).map(([assetClass, val]) => {
    const percentage = totalValue > 0 ? (val / totalValue) * 100 : 0;
    return {
      assetClass,
      value: val,
      percentage
    };
  }).sort((a, b) => b.value - a.value);

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', textAlign: 'left' }}>
      
      {/* Editorial Header bar */}
      <div style={{ 
        borderBottom: '1px solid #222222', 
        paddingBottom: '1.5rem', 
        marginBottom: '2.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span className="mono-tag" style={{ color: 'var(--color-accent)', marginBottom: '0.25rem', display: 'block' }}>
            Daily Intelligence & Asset Ledger
          </span>
          <h1 style={{ border: 'none', padding: 0, margin: 0, fontSize: '2.5rem' }}>
            Portfolio Dashboard
          </h1>
        </div>
        
        {/* Newspaper Date Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Calendar size={14} />
            <span>{formattedDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-success-text)' }}>
            <CheckCircle size={12} />
            <span>PORTFOLIO LEDGER ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        
        {/* Left Column: Summary and Holdings Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Portfolio Metric Highlights */}
          <div className="metric-summary-grid">
            <div className="metric-card">
              <span className="metric-label">Total Portfolio Value</span>
              <div className="metric-value">{formatCurrency(totalValue)}</div>
              <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
                <span>Real-time net asset value</span>
              </div>
            </div>
            
            <div className="metric-card">
              <span className="metric-label">Invested Capital</span>
              <div className="metric-value">{formatCurrency(totalCost)}</div>
              <div className="metric-change" style={{ color: 'var(--text-secondary)' }}>
                <span>Total cost basis</span>
              </div>
            </div>
            
            <div className="metric-card success" style={{ borderTopColor: totalGainLoss >= 0 ? 'var(--color-success-border)' : 'var(--color-danger-border)' }}>
              <span className="metric-label">Total Gain / Loss</span>
              <div className="metric-value" style={{ color: totalGainLoss >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                {formatCurrency(totalGainLoss)}
              </div>
              <div className="metric-change" style={{ color: totalGainLoss >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                {totalGainLoss >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{formatPercent(totalGainLossPercent)}</span>
              </div>
            </div>
          </div>

          {/* Holdings Section */}
          <div className="card" style={{ padding: '2rem 2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #222222', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)' }}>
                Asset Ledger
              </h2>
              <button onClick={openAddModal} className="btn btn-primary btn-sm">
                <Plus size={16} />
                <span>Add Asset</span>
              </button>
            </div>

            {loadingHoldings ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <span className="mono-tag">Loading Holdings...</span>
              </div>
            ) : holdings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed #E2DACD', background: '#FCFAF6' }}>
                <Briefcase size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', marginBottom: '1rem' }}>No assets configured in this portfolio.</p>
                <button onClick={openAddModal} className="btn btn-secondary btn-sm">
                  Add your first asset
                </button>
              </div>
            ) : (
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Class</th>
                      <th className="num-val">Qty</th>
                      <th className="num-val">Avg Cost</th>
                      <th className="num-val">Current</th>
                      <th className="num-val">Value</th>
                      <th className="num-val">Gain/Loss</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding) => {
                      const value = holding.quantity * holding.currentPrice;
                      const cost = holding.quantity * holding.purchasePrice;
                      const gain = value - cost;
                      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
                      return (
                        <tr key={holding.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{holding.symbol}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{holding.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                              {holding.assetClass}
                            </span>
                          </td>
                          <td className="num-val">{holding.quantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}</td>
                          <td className="num-val">{formatCurrency(holding.purchasePrice)}</td>
                          <td className="num-val">{formatCurrency(holding.currentPrice)}</td>
                          <td className="num-val" style={{ fontWeight: 600 }}>{formatCurrency(value)}</td>
                          <td className="num-val" style={{ color: gain >= 0 ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span>{formatCurrency(gain)}</span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>{formatPercent(gainPercent)}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button 
                              onClick={() => openEditModal(holding)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: '0.75rem', padding: '0.25rem' }}
                              title="Edit Asset"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteHolding(holding.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger-text)', padding: '0.25rem' }}
                              title="Remove Asset"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Editorial Sidebars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Allocation Summary Card */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Allocation Summary
            </h3>
            {holdings.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Add assets to view portfolio allocation.
              </p>
            ) : (
              <>
                <div className="allocation-bar-container">
                  {allocationList.map((item, idx) => {
                    const color = ASSET_CLASS_COLORS[item.assetClass] || ASSET_CLASS_COLORS['Other'];
                    return (
                      <div 
                        key={idx}
                        className="allocation-segment"
                        style={{ 
                          width: `${item.percentage}%`,
                          backgroundColor: color 
                        }}
                        title={`${item.assetClass}: ${item.percentage.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                  {allocationList.map((item, idx) => {
                    const color = ASSET_CLASS_COLORS[item.assetClass] || ASSET_CLASS_COLORS['Other'];
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="color-indicator" style={{ backgroundColor: color }} />
                          <span style={{ fontWeight: 500 }}>{item.assetClass}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          <span style={{ marginRight: '0.5rem', color: 'var(--text-secondary)' }}>{formatCurrency(item.value)}</span>
                          <span style={{ fontWeight: 'bold' }}>{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Strategic Parameters Snapshot */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Strategic Parameters Snapshot
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Risk Profile Mode</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-accent)', display: 'block', textTransform: 'capitalize', fontFamily: 'var(--font-serif)' }}>
                  {profile?.riskProfile || 'Moderate'}
                </span>
              </div>
              <div>
                <span className="mono-tag" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Configured Timezone</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', fontFamily: 'var(--font-serif)' }}>
                  {profile?.timezone || 'UTC'}
                </span>
              </div>
            </div>
          </div>

          {/* Interests track widget */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Analysis Verticals
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Focus categories assigned to the scanning agent.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {profile?.interests && profile.interests.length > 0 ? (
                profile.interests.map((interest: string, idx: number) => (
                  <div key={idx} style={{
                    padding: '0.5rem 0.75rem',
                    background: '#FCFAF6',
                    border: '1px solid #E2DACD',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase'
                  }}>
                    {interest}
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No tracks configured.
                </span>
              )}
            </div>
          </div>

          {/* Alerts configuration state card */}
          <div className="card" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid #E2DACD', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              Dispatch Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Daily Briefing:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.dailyBriefing ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.dailyBriefing ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E2DACD', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Weekly Summary:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.weeklyReport ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.weeklyReport ? 'ON' : 'OFF'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>Critical Alerts:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', fontSize: '0.75rem', color: profile?.emailPreferences?.alerts ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>
                  {profile?.emailPreferences?.alerts ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Add/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <X size={20} />
            </button>
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>
              {editingHolding ? 'Modify Asset' : 'Add New Asset'}
            </h3>
            
            {error && (
              <div style={{ 
                background: 'var(--color-danger-bg)', 
                border: '1px solid var(--color-danger-border)', 
                color: 'var(--color-danger-text)', 
                padding: '0.75rem 1rem', 
                fontSize: '0.8rem', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSaveHolding} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ticker Symbol</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. AAPL, BTC, CASH" 
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Asset Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Apple Inc., Bitcoin, US Dollar" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Asset Class</label>
                <select 
                  className="form-input form-select"
                  value={assetClass}
                  onChange={(e) => setAssetClass(e.target.value)}
                >
                  <option value="Equity">Equity (Stock / ETF)</option>
                  <option value="Crypto">Cryptocurrency</option>
                  <option value="Cash">Cash & Equivalents</option>
                  <option value="Fixed Income">Fixed Income (Bonds)</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Other">Commodities & Other</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    placeholder="0.00" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Avg Buy Price ($)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-input" 
                    placeholder="0.00" 
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Current Price ($)</label>
                <input 
                  type="number" 
                  step="any"
                  className="form-input" 
                  placeholder="0.00" 
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
