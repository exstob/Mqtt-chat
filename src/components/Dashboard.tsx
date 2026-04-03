import React, { useState, useEffect } from 'react';
import { ConnectionConfig, RoomInfo, Message } from '../types';
import { Fingerprint, UserPlus, Info, Settings as SettingsIcon, Trash2, MessageCircle } from 'lucide-react';

interface ChatHistory {
  roomId: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage?: string;
  messageCount: number;
  timestamp: number;
}

interface DashboardProps {
  config: ConnectionConfig;
  onJoinRoom: (roomInfo: RoomInfo) => void;
  onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ config, onJoinRoom, onOpenSettings }) => {
  const [inviteId, setInviteId] = useState('');
  const [recentRooms, setRecentRooms] = useState<RoomInfo[]>([]);
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('mqtt_recent_rooms');
    if (saved) {
      try {
        setRecentRooms(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent rooms');
      }
    }
    loadChatHistories();

    // Listen for global messages to refresh list
    const handleGlobalUpdate = () => loadChatHistories();
    window.addEventListener('mqtt_message_global', handleGlobalUpdate);
    return () => window.removeEventListener('mqtt_message_global', handleGlobalUpdate);
  }, []);

  const loadChatHistories = () => {
    const histories: ChatHistory[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('mqtt_history_')) {
        try {
          const messages = JSON.parse(localStorage.getItem(key) || '[]');
          const roomId = key.replace('mqtt_history_', '');
          const uuids = roomId.replace('chat/', '').split('_');
          const otherUserId = uuids.find(id => id !== config.userId) || 'unknown';

          // Find the other user's name from messages history
          const otherUserMessage = messages.find((m: Message) => m.senderId !== config.userId);
          const otherUserName = otherUserMessage ? otherUserMessage.sender : (otherUserId.slice(0, 12) + '...');

          histories.push({
            roomId,
            otherUserId: otherUserId,
            otherUserName: otherUserName,
            lastMessage: messages[messages.length - 1]?.text?.substring(0, 50),
            messageCount: messages.length,
            timestamp: messages[messages.length - 1]?.timestamp || 0,
          });
        } catch (e) {
          console.error('Failed to parse history', key);
        }
      }
    }
    // Sort by most recent
    histories.sort((a, b) => b.timestamp - a.timestamp);
    setChatHistories(histories);
  };

  const handleDeleteHistory = (roomId: string) => {
    if (window.confirm('Delete this chat history? This cannot be undone.')) {
      localStorage.removeItem(`mqtt_history_${roomId}`);
      loadChatHistories();
    }
  };

  const handleOpenChat = (history: ChatHistory) => {
    onJoinRoom({
      id: history.roomId,
      name: `Chat with ${history.otherUserName}`,
      type: 'private'
    });
  };


  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteId.trim() || inviteId === config.userId) return;

    // Create direct topic based on both UUIDs sorted alphabetically
    const sortedIds = [config.userId, inviteId].sort();
    const topic = `chat/${sortedIds[0]}_${sortedIds[1]}`;

    onJoinRoom({
      id: topic,
      name: `Add user`,
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
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-6">


        {/* Add user */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
          <div className="flex items-center gap-2 mb-3 text-emerald-500">
            <UserPlus className="w-5 h-5" />
            <h2 className="text-lg font-semibold text-gray-900 tracking-wider">Add user</h2>
          </div>

          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="text"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="User ID..."
              className="flex-1 px-3 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none text-sm font-medium"
            />
            <button
              type="submit"
              disabled={!inviteId.trim() || inviteId === config.userId}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm whitespace-nowrap"
            >
              Connect
            </button>
          </form>
        </div>

        {/* Chat History */}
        {chatHistories.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-3 mb-4 text-gray-700">
              <MessageCircle className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Chats</h2>
              <span className="text-sm text-gray-500">({chatHistories.length})</span>
            </div>

            <div className="space-y-1">
              {chatHistories.map((history) => (
                <div
                  key={history.roomId}
                  className="bg-white rounded-2xl p-3 shadow-sm border border-black/5 hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-semibold text-gray-900 cursor-help"
                          title={`User ID: ${history.otherUserId}`}
                        >
                          {history.otherUserName}
                        </span>
                        <span className="text-xs text-gray-400">
                          {history.messageCount} messages
                        </span>
                      </div>
                      {history.lastMessage && (
                        <p className="text-sm text-gray-500 truncate">
                          {history.lastMessage}
                        </p>
                      )}
                      {history.timestamp > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(history.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleOpenChat(history)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors"
                        title="Open Chat"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(history.roomId)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                        title="Delete History"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
