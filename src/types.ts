export interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  topic: string;
}

export interface ConnectionConfig {
  brokerUrl: string;
  username: string;
  room: string;
  clientId: string;
}
