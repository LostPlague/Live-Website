import React, { useEffect, useRef, useState } from 'react';
import { Experience } from '../experience/Experience';
import { HUDOverlay } from './HUDOverlay';
import { track } from '../analytics';

export const ThreeExperience: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const webglRef = useRef<HTMLDivElement>(null);
  const cssRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Experience instance reference
  const experienceInstanceRef = useRef<Experience | null>(null);

  // React UI States
  const [progress, setProgress] = useState(0);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [loadingDone, setLoadingDone] = useState(false);
  const [booted, setBooted] = useState(false);
  const [cameraState, setCameraState] = useState<'loading' | 'idle' | 'desk' | 'monitor' | 'orbit'>('loading');
  const [isMuted, setIsMuted] = useState(false);

  // Typewriter queue refs
  const targetLinesRef = useRef<string[]>([]);
  const isTypingRef = useRef<boolean>(false);

  // Process next line in queue
  const processQueue = () => {
    if (isTypingRef.current || targetLinesRef.current.length === 0) return;

    isTypingRef.current = true;
    const nextLine = targetLinesRef.current.shift()!;
    let typedText = '';
    let charIdx = 0;

    // Add a new empty line to display, keeping at most the last 8 lines
    setDisplayedLines((prev) => [...prev.slice(-7), '']);

    const typeNextChar = () => {
      if (charIdx < nextLine.length) {
        typedText += nextLine[charIdx];
        setDisplayedLines((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = typedText;
          return updated;
        });
        charIdx++;

        // BIOS typing is silent (matches Henry) and — critically — this stops the
        // BIOS queue's clicks from leaking in after Start, which kept playing for
        // seconds. Only the HUD name/title/time typing plays the ccType click.
        setTimeout(typeNextChar, 25);
      } else {
        isTypingRef.current = false;
        processQueue();
      }
    };

    typeNextChar();
  };

  useEffect(() => {
    if (!containerRef.current || !webglRef.current || !cssRef.current) return;

    // Instantiate modular Experience orchestrator
    const experience = new Experience({
      container: containerRef.current,
      webglContainer: webglRef.current,
      cssContainer: cssRef.current,
      overlayContainer: overlayRef.current,   // ADD THIS
      onProgress: (prog) => setProgress(prog),
      onBiosLine: (line) => {
        targetLinesRef.current.push(line);
        processQueue();
      },
      onLoad: () => setLoadingDone(true),
      onCameraStateChange: (state) => setCameraState(state),
    });

    experienceInstanceRef.current = experience;

    return () => {
      experience.destroy();
      experienceInstanceRef.current = null;
    };
  }, []);

  const handleDocumentClick = (e: React.MouseEvent) => {
    const experience = experienceInstanceRef.current;
    if (!experience) return;

    // Henry's prevent-click pattern (Camera.ts:39)
    const target = e.target as HTMLElement;
    if (target.id === 'prevent-click') return;
    if (target.closest('#prevent-click')) return;
    if (target.closest('.control-btn') || target.closest('.boot-button') || target.closest('.hud-overlay')) return;

    // Don't let clicking the monitor iframe trigger idle/desk transitions
    if (target.id === 'computer-screen' || target.closest('iframe')) return;

    if (experience.camera.state === 'idle') {
      experience.camera.triggerTransition('desk', 1000);
    } else if (experience.camera.state === 'desk') {
      experience.camera.triggerTransition('idle', 4000);
    }
  };

  const handleStartBoot = () => {
    // No startup chime here. Henry's intro audio is the typewriter clicks on the
    // HUD name/title/time typing (see HUDOverlay → ccType), which begin right after
    // boot and stop on their own when the typing finishes.
    track('experience_started'); // funnel: BIOS → clicked start → into the room
    setBooted(true);
    experienceInstanceRef.current?.camera.triggerTransition('idle', 2500);
    experienceInstanceRef.current?.audioManager.startAmbient();
    experienceInstanceRef.current?.world.startVideos();
  };

  const handleMuteToggle = (muted: boolean) => {
    setIsMuted(muted);
    experienceInstanceRef.current?.audioManager.setMuted(muted);
  };

  const handleFreeCamToggle = () => {
    const cam = experienceInstanceRef.current?.camera;
    if (cam) {
      if (cam.state === 'orbit') {
        cam.triggerTransition('idle', 2500, { userInitiated: true });
      } else {
        cam.triggerTransition('orbit', 750, { userInitiated: true });
      }
    }
  };

  return (
    <div 
      id="experience-container" 
      ref={containerRef}
      onClick={handleDocumentClick}
    >
      {/* Dynamic Status Indicator */}
      <div className="status-indicator">
        CAMERA: {cameraState.toUpperCase()} | INTERACTIVE: {cameraState === 'monitor' ? 'IFRAME (OS)' : 'DESK'}
      </div>

      {booted && (
        <HUDOverlay
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
          onFreeCamToggle={handleFreeCamToggle}
          isOrbit={cameraState === 'orbit'}
          visible={cameraState !== 'monitor'}
        />
      )}

      {/* WebGL 3D Canvas Layer */}
      <div
        id="webgl"
        ref={webglRef}
        className={cameraState === 'orbit' ? 'interactive' : ''}
      />

      {/* CSS3D Renderer Layer */}
      <div id="css" ref={cssRef} />

      {/* Overlay — noise grain, soft-light CSS blend */}
      <div id="overlay" ref={overlayRef} />

      {/* Retro BIOS Loading Overlay */}
      {!booted && (
        <div className="loader-overlay">
          <div className="bios-terminal">
            {displayedLines.map((line, idx) => (
              <div key={idx} className="bios-line">&gt; {line}</div>
            ))}
          </div>
          
          {!loadingDone ? (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          ) : (
            <button className="boot-button" onClick={handleStartBoot}>
              [ Click to Start TabariOS ]
            </button>
          )}
        </div>
      )}

    </div>
  );
};
