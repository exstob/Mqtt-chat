import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../types';
import { Wifi, User, Hash, Globe, Fingerprint, Info } from 'lucide-react';

interface ConnectionFormProps {
  onConnect: (config: ConnectionConfig) => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect }) => {
  const [config, setConfig] = useState<ConnectionConfig>(() => {
    const saved = localStorage.getItem('mqtt_chat_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }
    return {
      brokerUrl: 'wss://broker.emqx.io:8084/mqtt',
      username: '',
      room: 'general-chat',
      clientId: '',
    };
  });

  // Generate a stable ClientID based on username
  useEffect(() => {
    if (config.username.trim()) {
      // Simple sanitization and stable ID generation
      const sanitized = config.username.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      const newClientId = `chat_v1_${sanitized}`;
      if (config.clientId !== newClientId) {
        setConfig(prev => ({ ...prev, clientId: newClientId }));
      }
    } else {
      setConfig(prev => ({ ...prev, clientId: '' }));
    }
  }, [config.username]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.username.trim() && config.room.trim() && config.clientId) {
      localStorage.setItem('mqtt_chat_config', JSON.stringify(config));
      onConnect(config);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 border border-black/5">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Globe className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">MQTT Global Chat</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">Persistent sessions enabled via stable ClientID</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Broker URL</label>
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
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
                placeholder="Enter your name"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Room / Topic</label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={config.room}
                onChange={(e) => setConfig({ ...config, room: e.target.value })}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
                placeholder="general-chat"
                required
              />
            </div>
          </div>

          {config.clientId && (
            <div className="bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <Fingerprint className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Your Unique Client ID</span>
              </div>
              <code className="block text-xs font-mono bg-white/80 p-2 rounded-lg border border-emerald-100 text-emerald-800 break-all">
                {config.clientId}
              </code>
              <p className="text-[10px] text-emerald-600/70 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                This ID allows the broker to remember your messages while you are offline.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-2"
          >
            Connect to Chat
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Powered by MQTT Persistent Sessions
          </p>
        </div>
      </div>
    </div>
  );
};

