import React, { useState, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { Message, ConnectionConfig, SettingsConfig, RoomInfo } from '../types';
import { Send, LogOut, Hash, Users, ShieldCheck, AlertCircle, Phone, PhoneCall, PhoneOff } from 'lucide-react';
import { JitsiMeeting } from './JitsiMeeting';
import { format } from 'date-fns';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
interface ChatRoomProps {
  config: ConnectionConfig;
  settings: SettingsConfig;
  roomInfo: RoomInfo;
  onDisconnect: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ config, settings, roomInfo, onDisconnect }) => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load history from LocalStorage on initial load
    const saved = localStorage.getItem(`mqtt_history_${roomInfo.id}`);
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
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [activeCall, setActiveCall] = useState<{ roomName: string; isCaller: boolean } | null>(null);
  const [incomingCallFrom, setIncomingCallFrom] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAcceptCall = () => {
    setShowCallDialog(false);
    // Generate room name based on both user IDs (consistent for both parties)
    const topicParts = roomInfo.id.replace('chat/', '').split('_');
    const otherId = topicParts.find(id => id !== config.userId) || '';
    const sortedIds = [config.userId, otherId].sort();
    const roomName = `mqttchat-${sortedIds[0].slice(0, 8)}-${sortedIds[1].slice(0, 8)}`;
    setActiveCall({ roomName, isCaller: false });
    setIncomingCallFrom(null);
  };

  const handleDeclineCall = () => {
    setShowCallDialog(false);
    
    // Notify the caller that we declined
    if (client && incomingCallFrom) {
      const declineMessage: Message = {
        id: crypto.randomUUID(),
        sender: config.username,
        senderId: config.userId,
        text: 'Call declined',
        timestamp: Date.now(),
        topic: roomInfo.id,
        type: 'call_declined',
      };
      client.publish(roomInfo.id, JSON.stringify(declineMessage), { qos: 1 });
    }
    
    setIncomingCallFrom(null);
  };

  const handleCloseMeeting = () => {
    setActiveCall(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to play a synthesized ringtone
  const playRingtone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (timeOffset: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + timeOffset); // 800Hz beep
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + timeOffset);
        gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + timeOffset + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + timeOffset + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime + timeOffset);
        oscillator.stop(audioCtx.currentTime + timeOffset + 0.5);
      };

      // Play 3 beeps
      playBeep(0);
      playBeep(0.7);
      playBeep(1.4);
    } catch (e) {
      console.error("Audio playback not supported", e);
    }
  };

  // Save messages to LocalStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`mqtt_history_${roomInfo.id}`, JSON.stringify(messages));
    scrollToBottom();
  }, [messages, roomInfo.id]);

  // Request notification permissions on Android
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      LocalNotifications.requestPermissions().catch(err => {
        console.error('Failed to request notification permission', err);
      });
    }
  }, []);

  useEffect(() => {
    // Use MQTT v5 for better session management
    const mqttClient = mqtt.connect(settings.brokerUrl, {
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
      mqttClient.subscribe(roomInfo.id, { qos: 1 }, (err) => {
        if (err) {
          setError('Failed to subscribe to topic: ' + roomInfo.id);
        }
      });
      
      if (connack.sessionPresent) {
        console.log('Persistent session restored from broker');
      }
    });

    mqttClient.on('message', (topic, payload) => {
      try {
        const message: Message = JSON.parse(payload.toString());
        
        // Handle Call Messages
        if (message.type === 'call') {
          // Play sound if someone else called
          if (message.senderId !== config.userId) {
            playRingtone();
            // Show accept/decline dialog
            setIncomingCallFrom(message.sender);
            setShowCallDialog(true);
          }
        }

        // Handle Call Declined
        if (message.type === 'call_declined') {
          // If we initiated the call and the other party declined
          if (activeCall?.isCaller && message.senderId !== config.userId) {
            setActiveCall(null);
            alert(`${message.sender} declined the call`);
          }
        }

        setMessages((prev) => {
          // Prevent duplicates (important for persistent sessions)
          if (prev.some(m => m.id === message.id)) return prev;

          // Trigger local notification on Android for new incoming messages
          if (message.senderId !== config.userId && Capacitor.getPlatform() === 'android') {
            LocalNotifications.schedule({
              notifications: [
                {
                  title: message.sender,
                  body: message.type === 'call' ? '☎️ Incoming Call' : message.text,
                  id: Math.floor(Math.random() * 1000000),
                  schedule: { at: new Date(Date.now() + 100) },
                }
              ]
            }).catch(e => console.error("Notification error:", e));
          }

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
  }, [config, settings, roomInfo.id]);

  const handleClearHistory = () => {
    if (window.confirm('Clear local chat history for this room?')) {
      setMessages([]);
      localStorage.removeItem(`mqtt_history_${roomInfo.id}`);
    }
  };

  const handleCall = () => {
    if (!client) return;
    // Generate consistent room name
    const topicParts = roomInfo.id.replace('chat/', '').split('_');
    const otherId = topicParts.find(id => id !== config.userId) || '';
    const sortedIds = [config.userId, otherId].sort();
    const roomName = `mqttchat-${sortedIds[0].slice(0, 8)}-${sortedIds[1].slice(0, 8)}`;
    
    const callMessage: Message = {
      id: crypto.randomUUID(),
      sender: config.username,
      senderId: config.userId,
      text: `☎️ Incoming Call / Дзвінок!`,
      timestamp: Date.now(),
      topic: roomInfo.id,
      type: 'call',
    };
    client.publish(roomInfo.id, JSON.stringify(callMessage), { qos: 1 });
    
    // Immediately join the meeting as caller
    setActiveCall({ roomName, isCaller: true });
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
      type: 'text'
    };

    client.publish(roomInfo.id, JSON.stringify(newMessage), { qos: 1 });
    setInputText('');
  };

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

      {activeCall && (
        <JitsiMeeting
          roomName={activeCall.roomName}
          displayName={config.username}
          onClose={handleCloseMeeting}
        />
      )}

      {/* Incoming Call Dialog */}
      {showCallDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <PhoneCall className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Incoming Call</h3>
              <p className="text-gray-500">{incomingCallFrom} is calling you</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeclineCall}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                Decline
              </button>
              <button
                onClick={handleAcceptCall}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <PhoneCall className="w-5 h-5" />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

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

