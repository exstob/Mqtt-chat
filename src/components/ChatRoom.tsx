import React, { useState, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { Message, ConnectionConfig, SettingsConfig, RoomInfo } from '../types';
import { Send, LogOut, Hash, Users, AlertCircle, Phone, PhoneCall, PhoneOff } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface ChatRoomProps {
  config: ConnectionConfig;
  settings: SettingsConfig;
  roomInfo: RoomInfo;
  onDisconnect: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ config, settings, roomInfo, onDisconnect }) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(`mqtt_history_${roomInfo.id}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Listen for messages discovered by the background poller ─────────────────
  useEffect(() => {
    const onGlobal = (e: Event) => {
      const message: Message = (e as CustomEvent).detail;
      if (message.topic !== roomInfo.id) return;
      addMessage(message);
    };
    window.addEventListener('mqtt_message_global', onGlobal);
    return () => window.removeEventListener('mqtt_message_global', onGlobal);
  }, [roomInfo.id]);

  // ── Own live MQTT connection for this room ───────────────────────────────────
  useEffect(() => {
    const mqttClient = mqtt.connect(settings.brokerUrl, {
      clientId: config.clientId,
      protocolVersion: 5,
      clean: false,
      properties: { sessionExpiryInterval: 86400 },
      connectTimeout: 5000,
      reconnectPeriod: 1000,
    });

    mqttClient.on('connect', (connack) => {
      setStatus('connected');
      setError(null);
      mqttClient.subscribe(roomInfo.id, { qos: 1 }, (err) => {
        if (err) setError('Failed to subscribe: ' + roomInfo.id);
      });
      if (connack.sessionPresent) {
        console.log('Session restored from broker');
      }
    });

    mqttClient.on('message', (_topic, payload) => {
      try {
        const message: Message = JSON.parse(payload.toString());
        addMessage(message);
      } catch {
        console.error('Failed to parse message');
      }
    });

    mqttClient.on('error', (err) => {
      setStatus('error');
      setError(err.message);
    });

    setClient(mqttClient);
    return () => { mqttClient.end(); };
  }, [config.clientId, settings.brokerUrl, roomInfo.id]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addMessage = (message: Message) => {
    const isRecent = Date.now() - message.timestamp < 45_000;

    setMessages((prev) => {
      if (prev.some(m => m.id === message.id)) return prev; // duplicate

      // Show Android notification only if a different chat is not already open
      // (ChatRoom IS the active chat, so we only notify for cross-topic events)
      if (message.senderId !== config.userId && Capacitor.getPlatform() === 'android' && isRecent) {
        LocalNotifications.schedule({
          notifications: [{
            title: message.sender,
            body: message.type === 'call' ? '☎️ Incoming Call' : message.text,
            id: Math.floor(Math.random() * 2_000_000),
            schedule: { at: new Date(Date.now() + 100) },
          }],
        }).catch(() => {});
      }

      return [...prev, message].slice(-200);
    });
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    localStorage.setItem(`mqtt_history_${roomInfo.id}`, JSON.stringify(messages));
    scrollToBottom();
  }, [messages, roomInfo.id]);

  // ── Call handlers ────────────────────────────────────────────────────────────

  const handleCall = () => {
    if (!client) return;
    const topicParts = roomInfo.id.replace('chat/', '').split('_');
    const otherId = topicParts.find(id => id !== config.userId) || '';
    const sortedIds = [config.userId, otherId].sort();
    const roomName = `mqttchat-${sortedIds[0].slice(0, 8)}-${sortedIds[1].slice(0, 8)}`;

    // Log the call locally in chat history
    const callMessage: Message = {
      id: crypto.randomUUID(),
      sender: config.username,
      senderId: config.userId,
      text: '☎️ Incoming Call / Дзвінок!',
      timestamp: Date.now(),
      topic: roomInfo.id,
      type: 'call',
    };
    client.publish(roomInfo.id, JSON.stringify(callMessage), { qos: 1 });
    
    // Trigger the bypass for an instantaneous call dialog across the whole app
    window.dispatchEvent(new CustomEvent('mqtt_send_call', { detail: { otherId, roomName, roomId: roomInfo.id } }));
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !inputText.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      sender: config.username,
      senderId: config.userId,
      text: inputText,
      timestamp: Date.now(),
      topic: roomInfo.id,
      type: 'text',
    };
    client.publish(roomInfo.id, JSON.stringify(newMessage), { qos: 1 });
    setInputText('');
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear local chat history for this room?')) {
      setMessages([]);
      localStorage.removeItem(`mqtt_history_${roomInfo.id}`);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      <header className="bg-white border-bottom border-black/5 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
            roomInfo.type === 'private' ? "bg-amber-500 shadow-amber-500/10" : "bg-emerald-500 shadow-emerald-500/10"
          )}>
            {roomInfo.type === 'private' ? <Users className="text-white w-5 h-5" /> : <Hash className="text-white w-5 h-5" />}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 leading-tight">{roomInfo.name}</h2>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                status === 'connected' ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
              )} />
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                {status === 'connected' ? 'Live' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {roomInfo.type === 'private' && status === 'connected' && (
            <button
              onClick={handleCall}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors shadow-sm flex items-center gap-2 px-4"
              title="Ring / Call via MQTT"
            >
              <Phone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase">Ring</span>
            </button>
          )}
          <button
            onClick={handleClearHistory}
            className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors"
            title="Clear Local History"
          >
            <AlertCircle className="w-5 h-5" />
          </button>
          <button
            onClick={onDisconnect}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {status === 'error' && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error || 'Connection failed'}</p>
          </div>
        )}

        {messages.length === 0 && status === 'connected' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <Users className="w-12 h-12 opacity-20" />
            <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.senderId === config.userId;
              const isCall = msg.type === 'call';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    isMe ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {isMe ? 'You' : msg.sender}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {format(msg.timestamp, 'HH:mm')}
                    </span>
                  </div>
                  <div className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                    isMe
                      ? "bg-emerald-500 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-black/5 rounded-tl-none",
                    isCall && "bg-amber-100 text-amber-900 border-amber-200 font-semibold flex items-center gap-2"
                  )}>
                    {isCall && <Phone className="w-4 h-4 animate-pulse" />}
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white border-t border-black/5 p-4 sm:p-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={status !== 'connected'}
            placeholder={status === 'connected' ? "Type a message..." : "Connecting to broker..."}
            className="flex-1 bg-gray-50 border border-transparent rounded-2xl px-5 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status !== 'connected' || !inputText.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 text-white p-3 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
};
