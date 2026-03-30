import React, { useState, useEffect } from 'react';
import { ConnectionConfig, RoomInfo } from '../types';
import { Fingerprint, UserPlus, LogOut, Copy, Check, Info, Settings as SettingsIcon } from 'lucide-react';

interface DashboardProps {
  config: ConnectionConfig;
  onJoinRoom: (roomInfo: RoomInfo) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ config, onJoinRoom, onLogout, onOpenSettings }) => {
  const [inviteId, setInviteId] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentRooms, setRecentRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('mqtt_recent_rooms');
    if (saved) {
      try {
        setRecentRooms(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent rooms');
      }
    }
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(config.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteId.trim() || inviteId === config.userId) return;
    
    // Create direct topic based on both UUIDs sorted alphabetically
    const sortedIds = [config.userId, inviteId].sort();
    const topic = `chat/${sortedIds[0]}_${sortedIds[1]}`;
    
    onJoinRoom({
      id: topic,
      name: `Private Chat`,
      type: 'private'
    });
  };



  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hello, {config.username}</h1>
          <p className="text-gray-500 text-sm">Welcome to your dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onOpenSettings}
            className="p-3 bg-white hover:bg-gray-50 text-gray-600 rounded-xl transition-colors shadow-sm border border-black/5"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-3 bg-white hover:bg-red-50 text-red-500 rounded-xl transition-colors shadow-sm border border-red-100"
            title="Disconnect"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* User Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-indigo-600">
            <Fingerprint className="w-6 h-6" />
            <h2 className="text-lg font-semibold text-gray-900">Your User ID</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Share this ID with others so they can invite you to a private chat.</p>
          
          <div className="mt-auto relative group">
            <code className="block w-full text-xs font-mono bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 text-indigo-900 break-all select-all">
              {config.userId}
            </code>
            <button
              onClick={handleCopyId}
              className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm shadow-sm border border-indigo-100 rounded-lg text-indigo-600 hover:bg-white transition-colors"
              title="Copy ID"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Private Chat */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
           <div className="flex items-center gap-3 mb-4 text-emerald-500">
            <UserPlus className="w-6 h-6" />
            <h2 className="text-lg font-semibold text-gray-900">Private Chat</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6">Enter a User ID to start a secure direct chat.</p>
          
          <form onSubmit={handleInvite} className="space-y-3">
            <input
              type="text"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="Paste User ID here..."
              className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
            />
            <button
              type="submit"
              disabled={!inviteId.trim() || inviteId === config.userId}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm"
            >
              Connect
            </button>
          </form>
        </div>



      </div>
    </div>
  );
};
