import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../types';
import { User, Globe, Fingerprint, Info, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';

interface ConnectionFormProps {
  onConnect: (config: ConnectionConfig) => void;
  onOpenSettings: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect, onOpenSettings }) => {
  const [config, setConfig] = useState<ConnectionConfig>(() => {
    const saved = localStorage.getItem('mqtt_chat_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved config', e);
      }
    }
    return {
      userId: '',
      username: '',
      clientId: '',
    };
  });

  const [step, setStep] = useState<1 | 2>(config.userId ? 2 : 1);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.username.trim() && !config.userId) {
      const newUserId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      const sanitized = config.username.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
      const newClientId = `chat_v2_${sanitized}_${newUserId.substring(0, 8)}`;
      setConfig(prev => ({ ...prev, userId: newUserId, clientId: newClientId }));
      setStep(2);
    } else if (config.userId) {
      setStep(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.username.trim() && config.clientId && config.userId) {
      localStorage.setItem('mqtt_chat_user', JSON.stringify(config));
      onConnect(config);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-8 border border-black/5 relative">
        <button
          type="button"
          onClick={onOpenSettings}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <Globe className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">MQTT Global Chat</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            {step === 1 ? 'Register to enter the network' : 'Your registration is ready'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={config.username}
                  onChange={(e) => setConfig({ ...config, username: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
                  placeholder="Choose a username"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-2"
            >
              Generate User ID
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
             <div className="space-y-2">
               <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Registered Username</label>
               <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                 <input
                   type="text"
                   value={config.username}
                   disabled
                   className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-transparent rounded-xl text-gray-700 text-sm font-medium cursor-not-allowed"
                 />
                 <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
               </div>
             </div>
  
            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-indigo-700">
                <Fingerprint className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Your Device ID</span>
              </div>
              <code className="block text-xs font-mono bg-white/80 p-2 rounded-lg border border-indigo-100 text-indigo-800 break-all">
                {config.userId}
              </code>
              <p className="text-[10px] text-indigo-600/70 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                This persistent UUID allows others to invite you to private chats. Keep it safe!
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] mt-2"
            >
              Complete Registration
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
            Powered by MQTT Persistent Sessions
          </p>
        </div>
      </div>
    </div>
  );
};

