import React, { useState } from 'react';
import { SettingsConfig } from '../types';
import { Settings as SettingsIcon, Save, ArrowLeft, Wifi, Trash2, AlertTriangle, Plus, Check, X } from 'lucide-react';

interface SettingsProps {
  initialConfig: SettingsConfig;
  onSave: (config: SettingsConfig) => void;
  onClose: () => void;
  onRemoveUser?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ initialConfig, onSave, onClose, onRemoveUser }) => {
  const [config, setConfig] = useState<SettingsConfig>(initialConfig);
  const [newBroker, setNewBroker] = useState('');
  const [showAddBroker, setShowAddBroker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  const handleSelectBroker = (brokerUrl: string) => {
    setConfig({ ...config, brokerUrl });
  };

  const handleAddBroker = () => {
    if (newBroker.trim() && !config.savedBrokers.includes(newBroker.trim())) {
      setConfig({
        ...config,
        brokerUrl: newBroker.trim(),
        savedBrokers: [...config.savedBrokers, newBroker.trim()]
      });
      setNewBroker('');
      setShowAddBroker(false);
    }
  };

  const handleDeleteBroker = (brokerToDelete: string) => {
    const updatedBrokers = config.savedBrokers.filter(b => b !== brokerToDelete);
    setConfig({
      ...config,
      savedBrokers: updatedBrokers,
      // If we deleted the current broker, switch to default or first available
      brokerUrl: config.brokerUrl === brokerToDelete
        ? (updatedBrokers[0] || 'wss://broker.emqx.io:8084/mqtt')
        : config.brokerUrl
    });
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
          
          {/* Saved Brokers List */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Saved MQTT Brokers</label>
            <div className="space-y-2">
              {config.savedBrokers.map((broker) => (
                <div
                  key={broker}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    config.brokerUrl === broker
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {config.brokerUrl === broker ? (
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Wifi className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className={`text-sm truncate ${config.brokerUrl === broker ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>
                      {broker}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {config.brokerUrl !== broker && (
                      <button
                        type="button"
                        onClick={() => handleSelectBroker(broker)}
                        className="p-2 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Select this broker"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteBroker(broker)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete broker"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Broker */}
            {showAddBroker ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBroker}
                  onChange={(e) => setNewBroker(e.target.value)}
                  placeholder="wss://broker.example.com:8084/mqtt"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddBroker}
                  disabled={!newBroker.trim()}
                  className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddBroker(false); setNewBroker(''); }}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddBroker(true)}
                className="w-full py-3 border border-dashed border-gray-300 text-gray-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Broker
              </button>
            )}
          </div>

          {/* Current Broker Display */}
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Wifi className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Active Broker</span>
            </div>
            <p className="text-sm text-emerald-900 font-medium break-all">{config.brokerUrl}</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setConfig({ ...config, brokerUrl: 'wss://broker.emqx.io:8084/mqtt', savedBrokers: ['wss://broker.emqx.io:8084/mqtt'] })}
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

          {onRemoveUser && (
            <div className="pt-6 border-t border-gray-100">
              <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
                    <p className="text-xs text-red-600 mt-1">
                      Remove your user account. Chat histories will be preserved, but you will need to register again.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRemoveUser}
                  className="w-full bg-red-100 hover:bg-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove User
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};
