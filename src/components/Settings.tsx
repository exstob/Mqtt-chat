import React, { useState } from 'react';
import { SettingsConfig } from '../types';
import { Settings as SettingsIcon, Save, ArrowLeft, Wifi } from 'lucide-react';

interface SettingsProps {
  initialConfig: SettingsConfig;
  onSave: (config: SettingsConfig) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ initialConfig, onSave, onClose }) => {
  const [config, setConfig] = useState<SettingsConfig>(initialConfig);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      <header className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 -ml-2 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg shadow-gray-900/10">
            <SettingsIcon className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 leading-tight">Settings</h2>
            <span className="text-xs text-gray-500 font-medium">Configure Application Preferences</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex justify-center items-start">
        <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 border border-black/5 space-y-6">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">MQTT Broker URL</label>
            <div className="relative">
              <Wifi className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={config.brokerUrl}
                onChange={(e) => setConfig({ ...config, brokerUrl: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
                placeholder="wss://broker.emqx.io:8084/mqtt"
                required
              />
            </div>
            <p className="text-[10px] text-gray-500 ml-1">
              Default: wss://broker.emqx.io:8084/mqtt
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setConfig({ brokerUrl: 'wss://broker.emqx.io:8084/mqtt' })}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-semibold transition-colors"
            >
              Reset Default
            </button>
            <button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
