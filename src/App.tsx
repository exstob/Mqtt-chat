/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ConnectionForm } from './components/ConnectionForm';
import { ChatRoom } from './components/ChatRoom';
import { ConnectionConfig } from './types';

export default function App() {
  const [config, setConfig] = useState<ConnectionConfig | null>(null);

  const handleConnect = (newConfig: ConnectionConfig) => {
    setConfig(newConfig);
  };

  const handleDisconnect = () => {
    setConfig(null);
  };

  if (!config) {
    return <ConnectionForm onConnect={handleConnect} />;
  }

  return <ChatRoom config={config} onDisconnect={handleDisconnect} />;
}

