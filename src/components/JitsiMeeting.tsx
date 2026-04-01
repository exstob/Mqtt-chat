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
          prejoinPageEnabled: false,
          startWithAudioMuted: true,
          startWithVideoMuted: false,
          // Fix for Android/WebView audio device issues
          disableAudioLevels: true,
          enableNoAudioDetection: false,
          enableNoisyMicDetection: false,
          disableAGC: true,
          stereo: false,
          opusMaxAverageBitrate: 20000,
          // Allow other apps to play audio (don't hog audio focus)
          disableAP: true, // Disable audio processing to reduce conflicts
          disableHPF: true, // Disable high pass filter
          // Mobile-friendly constraints
          constraints: {
            video: {
              height: { ideal: 360, max: 480 },
              frameRate: { max: 24 }
            },
            audio: {
              autoGainControl: false,
              echoCancellation: true,
              noiseSuppression: true,
              // Use shared audio mode on mobile
              deviceId: 'default'
            }
          },
          // Disable features that cause issues in WebView
          disableSimulcast: true,
          enableLayerSuspension: false,
          // Don't request exclusive audio focus (helps other apps play sound)
          startSilent: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_MEETING_NAME: false, // Hide the room name overlay
          SHOW_TOPIC: false, // Hide topic
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

      // Log errors for debugging audio/device issues
      apiRef.current.on('errorOccurred', (err: any) => {
        console.error('Jitsi error:', err);
      });

      // Handle audio problems gracefully
      apiRef.current.on('audioAvailabilityChanged', (available: boolean) => {
        console.log('Audio availability changed:', available);
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
      

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
