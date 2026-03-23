import React, { useState, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { Message, ConnectionConfig } from '../types';
import { Send, LogOut, Hash, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatRoomProps {
  config: ConnectionConfig;
  onDisconnect: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ config, onDisconnect }) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load history from LocalStorage on initial load
    const saved = localStorage.getItem(`mqtt_history_${config.room}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load history', e);
        return [];
      }
    }
    return [];
  });
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Save messages to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`mqtt_history_${config.room}`, JSON.stringify(messages));
    scrollToBottom();
  }, [messages, config.room]);

  useEffect(() => {
    // Use MQTT v5 for better session management
    const mqttClient = mqtt.connect(config.brokerUrl, {
      clientId: config.clientId,
      protocolVersion: 5,
      clean: false, // Persistent session: broker remembers subscriptions
      properties: {
        sessionExpiryInterval: 86400, // Request broker to keep session for 24 hours (if possible)
      },
      connectTimeout: 5000,
      reconnectPeriod: 1000,
    });

    mqttClient.on('connect', (connack) => {
      setStatus('connected');
      setError(null);
      
      // Subscribe with QoS 1. 
      // QoS 1 ensures the broker stores messages for this client while offline.
      mqttClient.subscribe(`chat/${config.room}`, { qos: 1 }, (err) => {
        if (err) {
          setError('Failed to subscribe to topic');
        }
      });
      
      if (connack.sessionPresent) {
        console.log('Persistent session restored from broker');
      }
    });

    mqttClient.on('message', (topic, payload) => {
      try {
        const message: Message = JSON.parse(payload.toString());
        setMessages((prev) => {
          // Prevent duplicates (important for persistent sessions)
          if (prev.some(m => m.id === message.id)) return prev;
          // Keep only last 200 messages in local storage to prevent bloat
          const next = [...prev, message];
          return next.slice(-200);
        });
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    });

    mqttClient.on('error', (err) => {
      setStatus('error');
      setError(err.message);
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, [config]);

  const handleClearHistory = () => {
    if (confirm('Clear local chat history for this room?')) {
      setMessages([]);
      localStorage.removeItem(`mqtt_history_${config.room}`);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !inputText.trim()) return;

    const newMessage: Message = {
      id: `${config.clientId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      sender: config.username,
      text: inputText,
      timestamp: Date.now(),
      topic: `chat/${config.room}`,
    };

    // Publish with QoS 1 to ensure delivery to the broker
    client.publish(`chat/${config.room}`, JSON.stringify(newMessage), { qos: 1 });
    setInputText('');
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-white border-bottom border-black/5 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <Hash className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 leading-tight">{config.room}</h2>
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
          <button
            onClick={handleClearHistory}
            className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-colors"
            title="Clear Local History"
          >
            <AlertCircle className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-gray-600">{config.username}</span>
          </div>
          <button
            onClick={onDisconnect}
            className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
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
              const isMe = msg.sender === config.username;
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
                      : "bg-white text-gray-800 border border-black/5 rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
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
