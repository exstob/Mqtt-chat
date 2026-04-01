import React, { useState, useEffect } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { ConnectionForm } from './components/ConnectionForm';
import { ChatRoom } from './components/ChatRoom';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { ConnectionConfig, SettingsConfig, RoomInfo, Message } from './types';

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
  
  // Global MQTT client for invites
  const [client, setClient] = useState<MqttClient | null>(null);

  // Initialize MQTT Client globally when we have config
  useEffect(() => {
    if (!config || !settings.brokerUrl) return;

    const mqttClient = mqtt.connect(settings.brokerUrl, {
      clientId: config.clientId + '_global', // slightly different to not conflict if user opens multiple tabs, though shouldn't
      protocolVersion: 5,
      clean: true, // We don't necessarily need persistent session for invites, or do we? Yes for missing invites. Let's keep it simple for now as true or false.
      reconnectPeriod: 1000,
    });

    mqttClient.on('connect', () => {
      // Subscribe to personal invite topic
      mqttClient.subscribe(`invites/${config.userId}`, { qos: 1 });
    });

    mqttClient.on('message', (topic, payload) => {
      if (topic === `invites/${config.userId}`) {
        try {
          const message: Message = JSON.parse(payload.toString());
          if (message.type === 'invite') {
            const isRecent = Date.now() - message.timestamp < 45000;
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
              // Create direct topic based on both UUIDs sorted alphabetically
              const sortedIds = [config.userId, message.senderId].sort();
              const newTopic = `chat/${sortedIds[0]}_${sortedIds[1]}`;
              // Send accept back
              const acceptMsg: Message = {
                id: crypto.randomUUID(),
                sender: config.username,
                senderId: config.userId,
                text: 'Accepted',
                timestamp: Date.now(),
                topic: `invites/${message.senderId}`,
                type: 'accept'
              };
              mqttClient.publish(`invites/${message.senderId}`, JSON.stringify(acceptMsg));
              
              if (!isAutoAccept) {
                setActiveRoom({
                  id: newTopic,
                  name: `Chat with ${message.sender}`,
                  type: 'private'
                });
              }
            }
          } else if (message.type === 'accept') {
            const isRecent = Date.now() - message.timestamp < 45000;
            if (isRecent) {
              const sortedIds = [config.userId, message.senderId].sort();
              const newTopic = `chat/${sortedIds[0]}_${sortedIds[1]}`;
              alert(`${message.sender} accepted your invite!`);
              setActiveRoom({
                id: newTopic,
                name: `Chat with ${message.sender}`,
                type: 'private'
              });
            }
          }
        } catch (e) {
          console.error("Failed to parse invite message");
        }
      }
    });

    setClient(mqttClient);

    return () => {
      mqttClient.end();
    };
  }, [config, settings.brokerUrl]);


  const handleConnect = (newConfig: ConnectionConfig) => {
    setConfig(newConfig);
  };

  const handleRemoveUser = () => {
    if (window.confirm('Remove this user? All chat histories will be preserved, but you will need to register again.')) {
      localStorage.removeItem('mqtt_chat_user');
      setConfig(null);
      setActiveRoom(null);
    }
  };

  const handleDisconnect = () => {
    setActiveRoom(null);
  };

  const handleSaveSettings = (newSettings: SettingsConfig) => {
    setSettings(newSettings);
    localStorage.setItem('mqtt_chat_settings', JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const handleJoinRoom = (room: RoomInfo) => {
    // Send invite notification in background if it's a new private chat
    if (room.type === 'private') {
      const uuids = room.id.replace('chat/', '').split('_');
      const otherUuid = uuids.find(id => id !== config?.userId);
      
      if (otherUuid && client && config) {
        // Automatically add them to our approved list since we are initiating/opening the room
        const approvedKey = `mqtt_approved_${config.userId}`;
        const approvedIds: string[] = JSON.parse(localStorage.getItem(approvedKey) || '[]');
        if (!approvedIds.includes(otherUuid)) {
           approvedIds.push(otherUuid);
           localStorage.setItem(approvedKey, JSON.stringify(approvedIds));
        }

        // Only send an invite message if this is a brand new chat (no history)
        const hasHistory = !!localStorage.getItem(`mqtt_history_${room.id}`);
        if (!hasHistory) {
          // Send invite notification (non-blocking)
          const inviteMsg: Message = {
             id: crypto.randomUUID(),
             sender: config.username,
             senderId: config.userId,
             text: 'Invite',
             timestamp: Date.now(),
             topic: `invites/${otherUuid}`,
             type: 'invite'
          };
          client.publish(`invites/${otherUuid}`, JSON.stringify(inviteMsg), { qos: 1 });
        }
      }
    }
    
    // Always join the room immediately
    setActiveRoom(room);
  };

  if (showSettings) {
    return (
      <Settings 
        initialConfig={settings} 
        onSave={handleSaveSettings} 
        onClose={() => setShowSettings(false)}
        onRemoveUser={config ? handleRemoveUser : undefined}
      />
    );
  }

  if (!config) {
    return <ConnectionForm onConnect={handleConnect} onOpenSettings={() => setShowSettings(true)} />;
  }

  if (!activeRoom) {
    return (
      <Dashboard 
        config={config} 
        onJoinRoom={handleJoinRoom} 
        onOpenSettings={() => setShowSettings(true)}
      />
    );
  }

  return (
    <ChatRoom 
      config={config} 
      settings={settings}
      roomInfo={activeRoom}
      onDisconnect={() => setActiveRoom(null)} 
    />
  );
}

