export type MessageType = 'text' | 'invite' | 'accept' | 'call';

export interface Message {
  id: string;
  sender: string;
  senderId: string; // Add sender UUID for invites and identification
  text: string;
  timestamp: number;
  topic: string;
  type?: MessageType; // Text is default if undefined for backward compat
}

export interface ConnectionConfig {
  userId: string;
  username: string;
  clientId: string;
}

export interface SettingsConfig {
  brokerUrl: string;
  savedBrokers: string[];
}

export interface RoomInfo {
  id: string; // The topic ID
  name: string; // Display name
  type: 'private';
}
