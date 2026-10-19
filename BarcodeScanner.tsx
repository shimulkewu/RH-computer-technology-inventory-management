/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  HelpCircle, 
  Barcode, 
  Scan, 
  RefreshCw, 
  Sparkles, 
  ArrowUpRight, 
  Package,
  PlusCircle,
  AlertCircle,
  QrCode,
  Layers,
  Check
} from 'lucide-react';
import { Product } from '../types';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
  products: Product[];
  onBarcodeScanned: (barcode: string) => void;
}

export default function BarcodeScanner({ products, onBarcodeScanned }: BarcodeScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'both' | '1d' | 'qr'>('both');
  const [justScannedSuccess, setJustScannedSuccess] = useState(false);
  
  // Real-time camera parser reference
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Execute actual scan callback
  const triggerScan = (barcode: string) => {
    if (!barcode.trim()) return;

    setScanStatus(`Scanning code ${barcode}...`);
    
    // Play a subtle notification beep or success indicator
    const match = products.find(p => p.barcode === barcode.trim());
    if (match) {
      setScanStatus(`Success! Found "${match.name}"`);
      setJustScannedSuccess(true);
      onBarcodeScanned(barcode.trim());
      // Reset successful scan indicator after 1200ms
      setTimeout(() => setJustScannedSuccess(false), 1200);
    } else {
      setScanStatus(`Warning: Code "${barcode}" not registered in inventory.`);
    }
    
    // Auto reset status message
    setTimeout(() => setScanStatus(null), 3500);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerScan(manualInput);
    setManualInput('');
  };

  // Real-time Webcam Stream Setup & Mode Configuration changes
  useEffect(() => {
    let isMounted = true;
    let html5QrcodeInstance: Html5Qrcode | null = null;

    if (isCameraActive) {
      // Configure formats based on toggle scanMode state to optimize rendering latency
      const formats: Html5QrcodeSupportedFormats[] = [];
      if (scanMode === 'both' || scanMode === 'qr') {
        formats.push(Html5QrcodeSupportedFormats.QR_CODE);
      }
      if (scanMode === 'both' || scanMode === '1d') {
        formats.push(Html5QrcodeSupportedFormats.CODE_128);
        formats.push(Html5QrcodeSupportedFormats.CODE_39);
        formats.push(Html5QrcodeSupportedFormats.EAN_13);
        formats.push(Html5QrcodeSupportedFormats.EAN_8);
        formats.push(Html5QrcodeSupportedFormats.UPC_A);
        formats.push(Html5QrcodeSupportedFormats.UPC_E);
        formats.push(Html5QrcodeSupportedFormats.CODE_93);
        formats.push(Html5QrcodeSupportedFormats.ITF);
      }

      // Briefly wait for rendering completion
      const timer = setTimeout(() => {
        if (!isMounted) return;
        const targetElement = document.getElementById('camera-viewfinder-screen');
        if (!targetElement) return;

        try {
          // Initialize scanner with formatsToSupport in the constructor config
          html5QrcodeInstance = new Html5Qrcode('camera-viewfinder-screen', { formatsToSupport: formats, verbose: false });
          qrScannerRef.current = html5QrcodeInstance;

          html5QrcodeInstance.start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: (videoWidth, videoHeight) => {
                const boxSize = Math.min(videoWidth, videoHeight) * 0.70;
                return { width: boxSize, height: boxSize };
              }
            },
            (decodedText) => {
              // Successfully scanned! Trigger downstream scan logic.
              triggerScan(decodedText);
            },
            () => {
              // Verbose frame failures. Suppressed to avoid log spamming.
            }
          ).then(() => {
            if (isMounted) setStreamError(null);
          }).catch((err) => {
            console.warn("Could not start html5Qrcode scanner:", err);
            if (isMounted) {
              setStreamError("Webcam stream is unsupported, inactive, or blocked. Please verify camera permissions. Simulator presets remain active!");
              setIsCameraActive(false);
            }
          });
        } catch (err) {
          console.warn("Html5Qrcode initialization warning (camera potentially blocked):", err);
          if (isMounted) {
            setStreamError("Failed to initialize system webcam framework. If in a sandboxed sandbox viewport, camera permission might be auto-dismissed.");
            setIsCameraActive(false);
          }
        }
      }, 150);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (html5QrcodeInstance) {
          try {
            if (html5QrcodeInstance.isScanning) {
              html5QrcodeInstance.stop().then(() => {
                html5QrcodeInstance?.clear();
              }).catch(err => console.warn("Failed stopping html5Qrcode device stream:", err));
            } else {
              html5QrcodeInstance.clear();
            }
          } catch (e) {
            console.warn("Html5Qrcode teardown warning:", e);
          }
        }
      };
    }
  }, [isCameraActive, scanMode]);

  return (
    <div className="space-y-6" id="barcode-scanner-widget">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Scan className="text-emerald-600 animate-pulse" />
            Hybrid 1D / 2D Scanner Console
          </h2>
          <p className="text-sm text-slate-400 font-medium">Scan commercial barcodes or custom physical QR asset tags instantly from webcams or handheld guns</p>
        </div>

        {/* Scan optimization toggle switch requested by the user */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold no-print self-start md:self-auto shadow-sm">
          <button
            type="button"
            onClick={() => setScanMode('both')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              scanMode === 'both' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Scan both barcodes and QR codes"
          >
            <Layers size={13} />
            Scan All Codes
          </button>
          <button
            type="button"
            onClick={() => setScanMode('1d')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              scanMode === '1d' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Disable QR codes to optimize scanning performance for only 1D barcodes"
            id="btn-toggle-1d-only"
          >
            <Barcode size={13} />
            1D Barcodes only
          </button>
          <button
            type="button"
            onClick={() => setScanMode('qr')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              scanMode === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Optimize scanner to search specifically for QR Code symbols"
            id="btn-toggle-qr-only"
          >
            <QrCode size={13} />
            QR Tags only
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Viewfinder and Camera Simulator Frame */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="camera-scan-frame">
          <div className="flex items-center justify-between mb-4">
            <div className="text-left">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5">
                <Camera size={16} className="text-emerald-600" />
                Live Camera Analyzer
              </h3>
              <p className="text-[10.5px] font-bold text-emerald-600 mt-0.5 uppercase tracking-wider font-mono">
                Active Decoding: {scanMode === 'both' ? 'Unified Barcode + QR' : scanMode === '1d' ? '1D Barcodes (Fast)' : '2D QR Codes (Asset)'}
              </p>
            </div>
            
            <button
              onClick={() => setIsCameraActive(!isCameraActive)}
              className={`text-xs px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isCameraActive 
                  ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border-emerald-700/25'
              }`}
            >
              <RefreshCw size={13} className={isCameraActive ? "animate-spin" : ""} />
              {isCameraActive ? 'Turn Off Stream' : 'Activate Live Webcam'}
            </button>
          </div>

          {/* Hologram Scanner Viewport */}
          <div className={`relative aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border-2 transition-all duration-300 shadow-inner ${
            justScannedSuccess 
              ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.55)]' 
              : 'border-slate-800'
          }`}>
            {isCameraActive ? (
              <div 
                id="camera-viewfinder-screen" 
                className="w-full h-full object-cover [&_video]:object-cover [&_video]:w-full [&_video]:h-full" 
              />
            ) : (
              <div className="text-center p-6 space-y-4 text-slate-500">
                <div className="flex items-center justify-center gap-2 text-slate-700">
                  <Barcode size={48} className="animate-pulse" />
                  <QrCode size={48} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Camera Feed is idle</p>
                  <p className="text-[10px] text-slate-500 max-w-xs mx-auto mt-1.5 leading-relaxed">
                    Click "Activate Live Webcam" to allow scan detection. Users can also type SKU strings below or tap direct items on the emulator grid to mock a successful scan.
                  </p>
                </div>
              </div>
            )}

            {/* Glowing Laser Scan overlay line (only visual overlay effect to look amazing, paused during success) */}
            {!justScannedSuccess && (
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-[bounce_3.5s_infinite] pointer-events-none z-10"></div>
            )}

            {/* Visual confirmation success overlay */}
            <AnimatePresence>
              {justScannedSuccess && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-emerald-500/15 border-4 border-emerald-500 rounded-xl pointer-events-none z-20 flex items-center justify-center"
                >
                  <motion.div 
                    initial={{ scale: 0.5, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                    className="bg-emerald-500 text-white rounded-full p-4 shadow-[0_0_30px_rgba(16,185,129,0.7)] flex items-center justify-center"
                  >
                    <Check size={36} className="stroke-[3.5px]" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Viewport Corners */}
            <div className={`absolute top-4 left-4 h-5 w-5 border-t-2 border-l-2 rounded-tl transition-colors duration-300 ${justScannedSuccess ? 'border-emerald-500' : 'border-emerald-600'}`}></div>
            <div className={`absolute top-4 right-4 h-5 w-5 border-t-2 border-r-2 rounded-tr transition-colors duration-300 ${justScannedSuccess ? 'border-emerald-500' : 'border-emerald-600'}`}></div>
            <div className={`absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 rounded-bl transition-colors duration-300 ${justScannedSuccess ? 'border-emerald-500' : 'border-emerald-600'}`}></div>
            <div className={`absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 rounded-br transition-colors duration-300 ${justScannedSuccess ? 'border-emerald-500' : 'border-emerald-600'}`}></div>
          </div>

          {streamError && (
            <div className="mt-3 p-3 bg-amber-50 text-amber-850 text-[11px] rounded-lg border border-amber-150 flex items-start gap-2.5 shadow-sm text-left font-sans">
              <AlertCircle size={15} className="shrink-0 text-amber-500 mt-0.5" />
              <span>{streamError}</span>
            </div>
          )}

          {/* Quick Manual text Scanner Input */}
          <form onSubmit={handleManualSubmit} className="mt-4 border-t border-slate-100 pt-4 flex gap-2">
            <div className="relative flex-1">
              <Barcode size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Simulate barcode gun scanner or input code manually..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full border border-slate-205 pl-10 pr-3 p-3 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
              />
            </div>
            <button 
              type="submit"
              className="bg-slate-900 text-white font-black text-xs px-5 py-3 rounded-xl hover:bg-slate-800 transition-colors shrink-0 cursor-pointer uppercase tracking-wider"
            >
              Simulate Scan
            </button>
          </form>

          {scanStatus && (
            <div className="mt-3 p-2.5 text-center text-xs font-bold leading-normal bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl font-sans">
              {scanStatus}
            </div>
          )}
        </div>

        {/* Emulator Presets Panel */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between" id="active-scanner-emulator">
          <div>
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-1.5 text-left">
              <Sparkles size={16} className="text-amber-500" />
              Preset Touch Simulator
            </h3>
            <p className="text-xs text-slate-400 mb-4 text-left">Clicking any computer asset below triggers an instant, successful hardware scanning sequence.</p>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {products.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border border-dashed border-slate-100 rounded-xl">
                  <Package size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">No active stock items to emulate scanner codes.</p>
                </div>
              ) : (
                products.map((item) => (
                  <motion.button
                    key={item.id}
                    onClick={() => triggerScan(item.barcode)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50/30 border border-slate-150 hover:border-emerald-150 rounded-xl text-left flex items-center justify-between text-xs transition-all group cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                       <span className="font-bold text-slate-700 block text-[11px] truncate">{item.name}</span>
                       <span className="text-[10px] text-slate-450 font-mono mt-0.5 block">SKU: {item.barcode}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 font-bold">RM {item.salePrice.toFixed(2)}</span>
                      <div className="bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 p-1.5 rounded-lg border border-emerald-100 transition-all">
                        <ArrowUpRight size={12} />
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-[11px] text-slate-500 font-sans mt-4 text-left leading-relaxed">
            <span className="font-extrabold block text-slate-700 mb-1">Integrating external physical hardware scanner gun?</span>
            Plug your desktop scanner gun into any USB port, focus/click inside the manual scanner text input field, and trigger raw asset stamps. The laser hardware enters characters quickly with automatic Enter carriage returns.
          </div>
        </div>

      </div>
    </div>
  );
}
