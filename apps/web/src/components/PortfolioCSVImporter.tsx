import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/firebase';
import { 
  Upload, 
  Check, 
  AlertCircle, 
  FileSpreadsheet, 
  Trash2, 
  Info
} from 'lucide-react';

interface CSVRow {
  ticker: string;
  name: string;
  exchange: string;
  assetClass: string;
  currency: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
}

interface ValidationError {
  row: number;
  message: string;
  level: 'error' | 'warning';
}

interface PortfolioCSVImporterProps {
  onClose: () => void;
  onImportComplete: () => void;
}

export const PortfolioCSVImporter: React.FC<PortfolioCSVImporterProps> = ({ onClose, onImportComplete }) => {
  const { user } = useAuth();
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const cleanHeader = (h: string): string => {
    return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      alert('Please upload a valid CSV file (.csv).');
      return;
    }
    
    setFile(selectedFile);
    setErrors([]);
    setParsedData([]);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(selectedFile);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) {
      setErrors([{ row: 0, message: 'CSV file appears to be empty or lacks headers.', level: 'error' }]);
      return;
    }

    // Parse headers
    const rawHeaders = lines[0].split(',');
    const headers = rawHeaders.map(cleanHeader);
    
    // Find column indexes
    const tickerIdx = headers.findIndex(h => h === 'ticker' || h === 'symbol' || h === 'asset');
    const quantityIdx = headers.findIndex(h => h === 'quantity' || h === 'qty' || h === 'count');
    const priceIdx = headers.findIndex(h => h === 'purchaseprice' || h === 'price' || h === 'cost' || h === 'avgcost');
    
    // Optional column indexes
    const nameIdx = headers.findIndex(h => h === 'name' || h === 'company');
    const exchangeIdx = headers.findIndex(h => h === 'exchange' || h === 'market');
    const classIdx = headers.findIndex(h => h === 'assetclass' || h === 'class' || h === 'type');
    const currencyIdx = headers.findIndex(h => h === 'currency' || h === 'coin');
    const dateIdx = headers.findIndex(h => h === 'purchasedate' || h === 'date');

    const parseErrors: ValidationError[] = [];
    
    if (tickerIdx === -1) parseErrors.push({ row: 1, message: 'Missing required column: Ticker/Symbol', level: 'error' });
    if (quantityIdx === -1) parseErrors.push({ row: 1, message: 'Missing required column: Quantity/Qty', level: 'error' });
    if (priceIdx === -1) parseErrors.push({ row: 1, message: 'Missing required column: Purchase Price/Price', level: 'error' });

    if (parseErrors.length > 0) {
      setErrors(parseErrors);
      return;
    }

    const rows: CSVRow[] = [];
    const tickerMap = new Map<string, CSVRow>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip blank lines

      // Basic comma split (does not handle nested commas inside quotes, but standard for plain assets)
      const values = line.split(',');
      if (values.length < Math.max(tickerIdx, quantityIdx, priceIdx) + 1) {
        parseErrors.push({ row: i + 1, message: `Malformed row: incomplete columns.`, level: 'error' });
        continue;
      }

      const ticker = values[tickerIdx]?.trim().toUpperCase() || '';
      const rawQty = parseFloat(values[quantityIdx]?.trim() || '');
      const rawPrice = parseFloat(values[priceIdx]?.trim() || '');

      // Validation
      if (!ticker) {
        parseErrors.push({ row: i + 1, message: `Ticker symbol cannot be blank.`, level: 'error' });
        continue;
      }
      
      // Symbol character check
      if (!/^[A-Z0-9.\-_]+$/.test(ticker)) {
        parseErrors.push({ row: i + 1, message: `Ticker "${ticker}" contains invalid characters.`, level: 'error' });
        continue;
      }

      if (isNaN(rawQty) || rawQty <= 0) {
        parseErrors.push({ row: i + 1, message: `Quantity must be a positive number. Got "${values[quantityIdx]}"`, level: 'error' });
        continue;
      }

      if (isNaN(rawPrice) || rawPrice < 0) {
        parseErrors.push({ row: i + 1, message: `Price must be a non-negative number. Got "${values[priceIdx]}"`, level: 'error' });
        continue;
      }

      // Optional parameters resolving defaults
      const name = nameIdx !== -1 ? values[nameIdx]?.trim() : '';
      let exchange = exchangeIdx !== -1 ? values[exchangeIdx]?.trim().toUpperCase() : '';
      let assetClass = classIdx !== -1 ? values[classIdx]?.trim() : '';
      let currency = currencyIdx !== -1 ? values[currencyIdx]?.trim().toUpperCase() : '';
      const purchaseDate = dateIdx !== -1 && values[dateIdx]?.trim() ? values[dateIdx].trim() : new Date().toISOString().split('T')[0];

      // Resolve defaults if blank
      if (!assetClass) {
        if (exchange === 'CRYPTO' || ['BTC', 'ETH', 'SOL'].includes(ticker)) {
          assetClass = 'Crypto';
        } else {
          assetClass = 'Equity';
        }
      }
      
      if (!exchange) {
        if (assetClass.toLowerCase() === 'crypto') {
          exchange = 'CRYPTO';
        } else if (assetClass.toLowerCase() === 'cash') {
          exchange = 'CASH';
        } else if (['RELIANCE', 'TCS', 'INFY', 'TATASTEEL'].includes(ticker)) {
          exchange = 'NSE';
        } else {
          exchange = 'NASDAQ';
        }
      }

      if (!currency) {
        currency = (exchange === 'NSE' || exchange === 'BSE') ? 'INR' : 'USD';
      }

      const key = `${ticker}:${exchange}`;

      // Combine duplicate entries
      if (tickerMap.has(key)) {
        const existing = tickerMap.get(key)!;
        const totalQty = existing.quantity + rawQty;
        // Weighted average cost basis
        const totalCost = (existing.quantity * existing.purchasePrice) + (rawQty * rawPrice);
        const avgPrice = totalCost / totalQty;
        
        existing.quantity = totalQty;
        existing.purchasePrice = avgPrice;
        
        parseErrors.push({ 
          row: i + 1, 
          message: `Duplicate asset details found for ${ticker}:${exchange}. Combined entries into quantity: ${totalQty.toFixed(2)}, avg price: ${avgPrice.toFixed(2)}.`, 
          level: 'warning' 
        });
      } else {
        const rowData: CSVRow = {
          ticker,
          name: name || `${ticker} Asset`,
          exchange,
          assetClass,
          currency,
          quantity: rawQty,
          purchasePrice: rawPrice,
          purchaseDate
        };
        tickerMap.set(key, rowData);
        rows.push(rowData);
      }
    }

    setParsedData(rows);
    setErrors(parseErrors);
  };

  const handleImportConfirm = async () => {
    if (!user || parsedData.length === 0) return;
    setLoading(true);
    try {
      // Add each holding parsed
      for (const row of parsedData) {
        await dbService.addHolding(user.uid, {
          symbol: row.ticker,
          name: row.name,
          ticker: row.ticker,
          exchange: row.exchange,
          assetClass: row.assetClass,
          currency: row.currency,
          quantity: row.quantity,
          purchasePrice: row.purchasePrice,
          purchaseDate: row.purchaseDate,
          currentPrice: row.purchasePrice // Default live price on initial ledger import
        });
      }
      onImportComplete();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Import process encountered database write failures.');
    } finally {
      setLoading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const resetImporter = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
  };

  const hasErrors = errors.some(e => e.level === 'error');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(34, 34, 34, 0.4)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '2px solid var(--text-primary)',
        width: '90%',
        maxWidth: '640px',
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '2.5rem',
        boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
        textAlign: 'left'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <span className="mono-tag" style={{ color: 'var(--color-accent)' }}>Holdings Importer</span>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-serif)', margin: '0.25rem 0 0 0' }}>
              Import Ledger via CSV
            </h2>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </div>

        {/* Info tip about CSV format */}
        <div style={{
          background: '#FCFAF6',
          border: '1px solid #E2DACD',
          padding: '0.75rem 1rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <Info size={16} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span>
            CSV header requirements: <strong>Ticker/Symbol</strong>, <strong>Quantity/Qty</strong>, <strong>Purchase Price/Price</strong>. Optional fields: Exchange, Currency, Purchase Date.
          </span>
        </div>

        {/* Upload State */}
        {!file ? (
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            style={{
              border: '2px dashed #E2DACD',
              background: '#FCFAF6',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              transition: 'all 0.15s ease'
            }}
          >
            <Upload size={32} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p style={{ margin: '0 0 0.25rem 0', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                Drag and drop your spreadsheet here, or click to browse
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                SUPPORTED FORMAT: COMMA-SEPARATED CSV ONLY
              </span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              style={{ display: 'none' }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* File info card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FCFAF6', border: '1px solid #E2DACD', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileSpreadsheet size={16} style={{ color: 'var(--color-accent)' }} />
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{file.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button 
                onClick={resetImporter}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-danger-text)', cursor: 'pointer', padding: '0.25rem' }}
                title="Remove File"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Validation Alerts */}
            {errors.length > 0 && (
              <div style={{ 
                maxHeight: '120px', 
                overflowY: 'auto',
                border: '1px solid #E2DACD',
                padding: '0.75rem 1rem',
                backgroundColor: hasErrors ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)'
              }}>
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.4rem', color: hasErrors ? 'var(--color-danger-text)' : 'var(--color-warning-text)' }}>
                  {hasErrors ? 'CSV Critical Parsing Failures Found:' : 'Import Warnings & Adjustments:'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {errors.map((err, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', fontSize: '0.7rem', color: err.level === 'error' ? 'var(--color-danger-text)' : 'var(--color-warning-text)' }}>
                      <AlertCircle size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
                      <span>Row {err.row}: {err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table Preview */}
            {parsedData.length > 0 && (
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Assets Staged For Import ({parsedData.length})
                </span>
                <div style={{ border: '1px solid #E2DACD', maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="financial-table" style={{ margin: 0 }}>
                    <thead>
                      <tr style={{ background: '#FCFAF6' }}>
                        <th>Ticker</th>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Exchange</th>
                        <th className="num-val">Qty</th>
                        <th className="num-val">Purchase Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold' }}>{row.ticker}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{row.name}</td>
                          <td style={{ fontSize: '0.75rem' }}>{row.assetClass}</td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{row.exchange}</td>
                          <td className="num-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{row.quantity.toFixed(2)}</td>
                          <td className="num-val" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{row.purchasePrice.toFixed(2)} {row.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Importer Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #E2DACD', paddingTop: '1.25rem' }}>
              <button 
                onClick={resetImporter} 
                className="btn btn-secondary btn-sm"
                disabled={loading}
              >
                Reset
              </button>
              
              <button
                onClick={handleImportConfirm}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                disabled={loading || parsedData.length === 0 || hasErrors}
              >
                {loading ? (
                  <span>Importing ledger...</span>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm Import ({parsedData.length} positions)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default PortfolioCSVImporter;
