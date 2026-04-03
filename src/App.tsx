import React, { useState, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionForm } from './components/ConnectionForm';
import { ChatRoom } from './components/ChatRoom';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { ConnectionConfig, SettingsConfig, RoomInfo, Message } from './types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { JitsiMeeting } from './components/JitsiMeeting';
import { PhoneCall, PhoneOff } from 'lucide-react';

// How often to poll for missed messages (ms). 5 minutes.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// How long to stay connected during a poll before disconnecting (ms).
const POLL_DURATION_MS = 15_000;

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig | null>(() => {
    const saved = localStorage.getItem('mqtt_chat_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [settings, setSettings] = useState<SettingsConfig>(() => {
    const saved = localStorage.getItem('mqtt_chat_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.savedBrokers) {
        parsed.savedBrokers = ['wss://broker.emqx.io:8084/mqtt'];
      }
      return parsed;
    }
    return { brokerUrl: 'wss://broker.emqx.io:8084/mqtt', savedBrokers: ['wss://broker.emqx.io:8084/mqtt'] };
  });

  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Invite-only client is still needed while the app is open (to send invites)
  const [inviteClient, setInviteClient] = useState<MqttClient | null>(null);

  // Global call state
  const [activeCall, setActiveCall] = useState<{ roomName: string; isCaller: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ sender: string, senderId: string, roomId: string } | null>(null);

  // Track the active room in a ref so the polling callback can read it without
  // being recreated every time the room changes.
  const activeRoomRef = useRef<RoomInfo | null>(null);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // ── Notification permission ─────────────────────────────────────────────────
  useEffect(() => {
    if (Capacitor.getPlatform() === 'android') {
      LocalNotifications.requestPermissions().catch(() => {});
    }
  }, []);

  const playRingtone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, 0.7, 1.4].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + offset);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + offset);
        gain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + offset + 0.1);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + offset + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + offset);
        osc.stop(audioCtx.currentTime + offset + 0.5);
      });
    } catch { /* not supported */ }
  };

  // ── Invite & Immediate Global Calls / lightweight always-on client ───────────────────────────────────
  useEffect(() => {
    if (!config || !settings.brokerUrl) return;

    const client = mqtt.connect(settings.brokerUrl, {
      clientId: config.clientId + '_inv',
      protocolVersion: 5,
      clean: true, // No session needed for invite-only client
      reconnectPeriod: 3000,
      connectTimeout: 8000,
    });

    client.on('connect', () => {
      client.subscribe(`invites/${config.userId}`, { qos: 1 });
    });

    client.on('message', (_topic, payload) => {
      try {
        const message: Message = JSON.parse(payload.toString());
        handleInviteChannelMessage(message, client);
      } catch { /* ignore */ }
    });

    setInviteClient(client);
    return () => { client.end(true); };
  }, [config?.userId, settings.brokerUrl]);

  // ── Global App Listener for Emitting Calls ───────────────────────────────────────
  useEffect(() => {
    const handleGlobalSendCall = (e: any) => {
      const { otherId, roomName, roomId } = e.detail;
      if (!inviteClient || !config) return;
      
      const bypassMsg: Message = {
        id: crypto.randomUUID(),
        sender: config.username,
        senderId: config.userId,
        text: 'ring',
        timestamp: Date.now(),
        topic: roomId,
        type: 'instant_call'
      };
      
      inviteClient.publish(`invites/${otherId}`, JSON.stringify(bypassMsg), { qos: 1 });
      setActiveCall({ roomName, isCaller: true });
    };

    window.addEventListener('mqtt_send_call', handleGlobalSendCall);
    return () => window.removeEventListener('mqtt_send_call', handleGlobalSendCall);
  }, [inviteClient, config]);

  // ── Polling: reconnect every POLL_INTERVAL_MS to drain buffered messages ────
  useEffect(() => {
    if (!config || !settings.brokerUrl) return;

    const poll = () => {
      const knownTopics = getKnownTopics().filter(
        t => t !== activeRoomRef.current?.id
      );
      if (knownTopics.length === 0) return;

      const client = mqtt.connect(settings.brokerUrl, {
        clientId: config.clientId,
        protocolVersion: 5,
        clean: false,
        properties: { sessionExpiryInterval: 86400 },
        reconnectPeriod: 0,
        connectTimeout: 8000,
      });

      let timer: ReturnType<typeof setTimeout>;

      client.on('connect', () => {
        client.subscribe(knownTopics, { qos: 1 });
        timer = setTimeout(() => client.end(true), POLL_DURATION_MS);
      });

      client.on('message', (topic, payload) => {
        try {
          const message: Message = JSON.parse(payload.toString());
          const isNew = saveToHistory(topic, message);
          const isSelf = message.senderId === config.userId;
          const isForActiveRoom = activeRoomRef.current?.id === topic;

          if (isNew && !isSelf) {
            window.dispatchEvent(new CustomEvent('mqtt_message_global', { detail: message }));

            // Show a notification only if the user isn't already looking at this room
            if (!isForActiveRoom) {
              showNotification(message);
            }
          }
        } catch { /* ignore */ }
      });

      client.on('error', () => {
        clearTimeout(timer);
        client.end(true);
      });
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [config?.userId, settings.brokerUrl]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getKnownTopics = (): string[] => {
    const topics: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('mqtt_history_')) {
        topics.push(key.replace('mqtt_history_', ''));
      }
    }
    return topics;
  };

  const saveToHistory = (topic: string, message: Message): boolean => {
    const key = `mqtt_history_${topic}`;
    let messages: Message[] = [];
    try { messages = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* */ }
    if (messages.some(m => m.id === message.id)) return false; // duplicate
    messages.push(message);
    localStorage.setItem(key, JSON.stringify(messages.slice(-200)));
    return true;
  };

  const showNotification = (message: Message) => {
    if (Capacitor.getPlatform() !== 'android') return;
    LocalNotifications.schedule({
      notifications: [{
        title: message.sender,
        body: message.type === 'call' ? '☎️ Incoming Call' : message.text,
        id: Math.floor(Math.random() * 2_000_000),
        schedule: { at: new Date(Date.now() + 200) },
        extra: { topic: message.topic },
      }],
    }).catch(() => {});
  };

  const handleInviteChannelMessage = (message: Message, client: MqttClient) => {
    if (!config) return;

    if (message.type === 'invite') {
      const isRecent = Date.now() - message.timestamp < 45_000;
      const approvedKey = `mqtt_approved_${config.userId}`;
      const approvedIds: string[] = JSON.parse(localStorage.getItem(approvedKey) || '[]');

      let accept = false;
      let isAutoAccept = false;

      if (approvedIds.includes(message.senderId)) {
        accept = true;
        isAutoAccept = true;
      } else if (isRecent) {
        accept = window.confirm(`User ${message.sender} has invited you to a direct chat! Accept?`);
        if (accept) {
          approvedIds.push(message.senderId);
          localStorage.setItem(approvedKey, JSON.stringify(approvedIds));
        }
      }

      if (accept) {
        const sortedIds = [config.userId, message.senderId].sort();
        const newTopic = `chat/${sortedIds[0]}_${sortedIds[1]}`;
        const acceptMsg: Message = {
          id: crypto.randomUUID(),
          sender: config.username,
          senderId: config.userId,
          text: 'Accepted',
          timestamp: Date.now(),
          topic: `invites/${message.senderId}`,
          type: 'accept',
        };
        client.publish(`invites/${message.senderId}`, JSON.stringify(acceptMsg), { qos: 1 });
        if (!isAutoAccept) {
          setActiveRoom({ id: newTopic, name: `Chat with ${message.sender}`, type: 'private' });
        }
      }
    } else if (message.type === 'accept') {
      const isRecent = Date.now() - message.timestamp < 45_000;
      if (isRecent) {
        const sortedIds = [config.userId, message.senderId].sort();
        const newTopic = `chat/${sortedIds[0]}_${sortedIds[1]}`;
        alert(`${message.sender} accepted your invite!`);
        setActiveRoom({ id: newTopic, name: `Chat with ${message.sender}`, type: 'private' });
      }
    } else if (message.type === 'instant_call') {
      const isRecent = Date.now() - message.timestamp < 45_000;
      if (isRecent) {
        playRingtone();
        setIncomingCall({ sender: message.sender, senderId: message.senderId, roomId: message.topic });
      }
    } else if (message.type === 'instant_call_declined') {
      const isRecent = Date.now() - message.timestamp < 45_000;
      if (isRecent) {
        setActiveCall(ac => {
          if (ac?.isCaller) { 
            alert(`${message.sender} declined the call`); 
            return null; 
          }
          return ac;
        });
      }
    }
  };

  // ── Global Call Actions ─────────────────────────────────────────────────────────

  const handleAcceptCall = () => {
    if (!incomingCall || !config) return;
    const sortedIds = [config.userId, incomingCall.senderId].sort();
    const roomName = `mqttchat-${sortedIds[0].slice(0, 8)}-${sortedIds[1].slice(0, 8)}`;
    setActiveCall({ roomName, isCaller: false });
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    if (!incomingCall || !inviteClient || !config) return;
    const declineMsg: Message = {
      id: crypto.randomUUID(),
      sender: config.username,
      senderId: config.userId,
      text: 'Declined',
      timestamp: Date.now(),
      topic: incomingCall.roomId,
      type: 'instant_call_declined'
    };
    inviteClient.publish(`invites/${incomingCall.senderId}`, JSON.stringify(declineMsg), { qos: 1 });
    setIncomingCall(null);
  };

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleConnect = (newConfig: ConnectionConfig) => setConfig(newConfig);

  const handleRemoveUser = () => {
    if (window.confirm('Remove this user? All chat histories will be preserved, but you will need to register again.')) {
      localStorage.removeItem('mqtt_chat_user');
      setConfig(null);
      setActiveRoom(null);
    }
  };

  const handleSaveSettings = (newSettings: SettingsConfig) => {
    setSettings(newSettings);
    localStorage.setItem('mqtt_chat_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const handleJoinRoom = (room: RoomInfo) => {
    if (room.type === 'private' && config && inviteClient) {
      const uuids = room.id.replace('chat/', '').split('_');
      const otherUuid = uuids.find(id => id !== config.userId);
      if (otherUuid) {
        const approvedKey = `mqtt_approved_${config.userId}`;
        const approvedIds: string[] = JSON.parse(localStorage.getItem(approvedKey) || '[]');
        if (!approvedIds.includes(otherUuid)) {
          approvedIds.push(otherUuid);
          localStorage.setItem(approvedKey, JSON.stringify(approvedIds));
        }
        const hasHistory = !!localStorage.getItem(`mqtt_history_${room.id}`);
        if (!hasHistory) {
          const inviteMsg: Message = {
            id: crypto.randomUUID(),
            sender: config.username,
            senderId: config.userId,
            text: 'Invite',
            timestamp: Date.now(),
            topic: `invites/${otherUuid}`,
            type: 'invite',
          };
          inviteClient.publish(`invites/${otherUuid}`, JSON.stringify(inviteMsg), { qos: 1 });
        }
      }
    }
    setActiveRoom(room);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden">
        {showSettings ? (
          <Settings
            initialConfig={settings}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
            onRemoveUser={config ? handleRemoveUser : undefined}
            userId={config?.userId}
          />
        ) : !config ? (
          <ConnectionForm onConnect={handleConnect} onOpenSettings={() => setShowSettings(true)} />
        ) : !activeRoom ? (
          <Dashboard
            config={config}
            onJoinRoom={handleJoinRoom}
            onOpenSettings={() => setShowSettings(true)}
          />
        ) : (
          <ChatRoom
            config={config}
            settings={settings}
            roomInfo={activeRoom}
            onDisconnect={() => setActiveRoom(null)}
          />
        )}
      </div>

      {activeCall && config && (
        <JitsiMeeting
          roomName={activeCall.roomName}
          displayName={config.username}
          onClose={() => setActiveCall(null)}
        />
      )}

      {incomingCall && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <PhoneCall className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Incoming Call</h3>
              <p className="text-gray-500">{incomingCall.sender} is calling you</p>
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
    </>
  );
}
