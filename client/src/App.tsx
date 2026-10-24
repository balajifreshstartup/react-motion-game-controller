import React, { useEffect, useState } from 'react';
import { ConnectionModal } from './components/ConnectionModal.js';
import { Navbar, type AppMode } from './components/Navbar.js';
import { ControllerView } from './controller/ControllerView.js';
import { GameCanvas } from './game/GameCanvas.js';
import { getDefaultWsUrl } from './networking/useWebSocket.js';

export const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('game');
  const [wsUrl, setWsUrl] = useState<string>(getDefaultWsUrl());
  const [pairingToken, setPairingToken] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Sync mode from URL hash or query param on initial load
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase().replace('#/', '').replace('#', '');
      const params = new URLSearchParams(window.location.search);
      const queryMode = params.get('mode')?.toLowerCase();

      if (hash === 'controller' || queryMode === 'controller') {
        setMode('controller');
      } else if (hash === 'dual' || queryMode === 'dual') {
        setMode('dual');
      } else {
        setMode('game');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectMode = (newMode: AppMode) => {
    setMode(newMode);
    window.location.hash = `#/${newMode}`;
  };

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        currentMode={mode}
        onSelectMode={handleSelectMode}
        onOpenSettings={() => setIsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full relative overflow-y-auto overflow-x-hidden flex flex-col">
        {mode === 'game' && (
          <div className="flex-1 w-full h-full p-2 sm:p-4 flex items-center justify-center">
            <GameCanvas
              wsUrl={wsUrl}
              pairingToken={pairingToken}
              onOpenPairing={() => setIsModalOpen(true)}
            />
          </div>
        )}

        {mode === 'controller' && (
          <div className="flex-1 w-full h-full overflow-y-auto">
            <ControllerView wsUrl={wsUrl} pairingToken={pairingToken} />
          </div>
        )}

        {mode === 'dual' && (
          <div className="flex-1 w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
            {/* Desktop Game on the Left */}
            <div className="lg:col-span-7 xl:col-span-8 h-full flex flex-col items-center justify-center min-h-[460px]">
              <GameCanvas
                wsUrl={wsUrl}
                pairingToken={pairingToken}
                onOpenPairing={() => setIsModalOpen(true)}
              />
            </div>

            {/* Mobile Controller on the Right */}
            <div className="lg:col-span-5 xl:col-span-4 h-full bg-slate-900/50 rounded-3xl border border-slate-800/80 p-2 overflow-y-auto">
              <div className="text-center py-1">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                  Live Controller Preview
                </span>
              </div>
              <ControllerView wsUrl={wsUrl} pairingToken={pairingToken} />
            </div>
          </div>
        )}
      </main>

      {/* Pairing & Network Settings Modal */}
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentWsUrl={wsUrl}
        onUpdateWsUrl={(newUrl) => setWsUrl(newUrl)}
        pairingToken={pairingToken}
        onUpdatePairingToken={(newToken) => setPairingToken(newToken)}
      />
    </div>
  );
};
