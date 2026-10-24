import React, { useState } from 'react';
import { Copy, Check, ExternalLink, QrCode, Smartphone, X, ShieldAlert } from 'lucide-react';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWsUrl: string;
  onUpdateWsUrl: (url: string) => void;
  pairingToken?: string;
  onUpdatePairingToken: (token: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  currentWsUrl,
  onUpdateWsUrl,
  pairingToken = '',
  onUpdatePairingToken,
}) => {
  const [copied, setCopied] = useState(false);
  const [tempWsUrl, setTempWsUrl] = useState(currentWsUrl);
  const [tempToken, setTempToken] = useState(pairingToken);

  if (!isOpen) return null;

  // Compute mobile controller URL
  const mobileUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/#/controller`
    : 'http://<computer-lan-ip>:5173/#/controller';

  const handleCopy = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onUpdateWsUrl(tempWsUrl.trim());
    onUpdatePairingToken(tempToken.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Connect Phone Controller</h2>
              <p className="text-xs text-slate-400">Pair your Android phone over Wi-Fi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Open on phone */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-300">1. Open this URL on your Android phone:</span>
          <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <input
              type="text"
              readOnly
              value={mobileUrl}
              className="bg-transparent text-xs text-cyan-300 font-mono flex-1 outline-none select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Step 2: WebSocket URL */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-300">2. WebSocket Relay Server URL:</span>
          <input
            type="text"
            value={tempWsUrl}
            onChange={(e) => setTempWsUrl(e.target.value)}
            placeholder="ws://192.168.1.100:8080"
            className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500 transition-colors"
          />
          <span className="text-[11px] text-slate-400">
            Ensure your computer's LAN IP is reachable from your phone on the same Wi-Fi.
          </span>
        </div>

        {/* Step 3: Optional Pairing Token */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-300">Pairing Token (Optional):</span>
          <input
            type="text"
            value={tempToken}
            onChange={(e) => setTempToken(e.target.value)}
            placeholder="Leave blank if server has no token"
            className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Browser Security Note */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-2xl flex items-start gap-2.5 text-[11px] text-cyan-200/90 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-cyan-300">HTTPS & Sensor Support: </span>
            Vite is configured with HTTPS support. When opening on your phone, navigate to{' '}
            <code className="text-[10px] bg-slate-950 px-1 py-0.5 rounded text-cyan-300 font-bold">
              https://&lt;your-ip&gt;:5173
            </code>{' '}
            (accept the self-signed certificate warning once). This unlocks Android phone gravity sensors, accelerometer, and camera access!
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20"
          >
            Save & Connect
          </button>
        </div>
      </div>
    </div>
  );
};
