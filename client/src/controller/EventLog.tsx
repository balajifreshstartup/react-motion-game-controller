import React from 'react';
import { Camera, Gamepad2, Radio } from 'lucide-react';
import type { ClientMessage } from '@motion-game/protocol';

interface EventLogItem {
  id: string;
  timestamp: number;
  message: ClientMessage;
}

interface EventLogProps {
  events: EventLogItem[];
  onClear?: () => void;
}

export const EventLog: React.FC<EventLogProps> = ({ events, onClear }) => {
  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 border border-slate-800 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
        <span>Transmitted Event Log</span>
        {events.length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 max-h-36 overflow-y-auto font-mono text-[11px] pr-1 scrollbar-thin">
        {events.length === 0 ? (
          <div className="text-slate-500 italic text-center py-3 text-xs">
            No events transmitted yet. Jump or press buttons to test.
          </div>
        ) : (
          events.map((item) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            if (item.message.type === 'gesture') {
              const { gesture, source, confidence } = item.message;
              const sourceIcon =
                source === 'camera' ? (
                  <Camera className="w-3 h-3 text-cyan-400" />
                ) : source === 'manual' ? (
                  <Gamepad2 className="w-3 h-3 text-indigo-400" />
                ) : (
                  <Radio className="w-3 h-3 text-amber-400" />
                );

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-slate-800/60 px-2 py-1 rounded border border-slate-700/50"
                >
                  <div className="flex items-center gap-1.5">
                    {sourceIcon}
                    <span className="font-bold text-cyan-300 uppercase">{gesture}</span>
                    <span className="text-[10px] text-slate-400">({source})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {confidence !== undefined && (
                      <span className="text-[10px] text-slate-400">{(confidence * 100).toFixed(0)}%</span>
                    )}
                    <span className="text-slate-500 text-[10px]">{timeStr}</span>
                  </div>
                </div>
              );
            }

            if (item.message.type === 'sensor') {
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-slate-800/40 px-2 py-1 rounded text-slate-400 border border-slate-700/30"
                >
                  <div className="flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-amber-400" />
                    <span>tilt: X={item.message.tiltX} Y={item.message.tiltY}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">{timeStr}</span>
                </div>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
};
