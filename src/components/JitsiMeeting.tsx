import React, { useEffect, useRef, useState } from 'react';
import { X, PhoneOff } from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
}

export const JitsiMeeting: React.FC<JitsiMeetingProps> = ({ roomName, displayName, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    try {
      const domain = 'meet.jit.si';
      const options = {
        roomName: roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: displayName,
        },
        configOverwrite: {
          startWithAudioMuted: true,
          startWithVideoMuted: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'security'
          ],
        },
      };

      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      apiRef.current.on('readyToClose', () => {
        onClose();
      });

      apiRef.current.on('videoConferenceJoined', () => {
        setIsReady(true);
      });

    } catch (error) {
      console.error('Failed to initialize Jitsi:', error);
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomName, displayName, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={onClose}
          className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
          title="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <p className="text-white">Joining meeting...</p>
          </div>
        </div>
      )}
      
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
