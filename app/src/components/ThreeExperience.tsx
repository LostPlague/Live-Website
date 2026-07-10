import React, { useEffect, useRef, useState } from 'react';
import { Experience } from '../experience/Experience';
import { HUDOverlay } from './HUDOverlay';
import { track, hoverHandlers, roomMount, roomStarted, roomStateChange } from '../analytics';

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

    // room journey tracking starts the moment the intro is on screen
    roomMount();

    // Instantiate modular Experience orchestrator. If WebGL itself is broken
    // on this device, record it — an invisible-failure is the worst outcome.
    let experience: Experience;
    try {
      experience = new Experience({
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
        onCameraStateChange: (state) => {
          setCameraState(state);
          roomStateChange(state); // camera journey: time per view, orbit usage
        },
      });
    } catch (err) {
      track('webgl_failed', { message: String(err instanceof Error ? err.message : err).slice(0, 180) });
      return;
    }

    experienceInstanceRef.current = experience;

    return () => {
      experience.destroy();
      experienceInstanceRef.current = null;
    };
  }, []);

  // One FPS sample per visit: skip the boot transition (4s), then measure a
  // 10s window — average frame rate plus the worst 1-second bucket.
  useEffect(() => {
    if (!booted) return;
    let raf = 0;
    let frames = 0;
    let secFrames = 0;
    let minFps = Infinity;
    let measuring = false;
    let t0 = 0;
    let secT0 = 0;
    const loop = (t: number) => {
      if (!measuring) {
        if (t - start > 4000) { measuring = true; t0 = t; secT0 = t; }
        raf = requestAnimationFrame(loop);
        return;
      }
      frames += 1;
      secFrames += 1;
      if (t - secT0 >= 1000) {
        minFps = Math.min(minFps, secFrames);
        secFrames = 0;
        secT0 = t;
      }
      if (t - t0 >= 10_000) {
        track('fps_sample', { avg: Math.round((frames / (t - t0)) * 1000), min: minFps === Infinity ? undefined : minFps });
        return; // done — one sample only
      }
      raf = requestAnimationFrame(loop);
    };
    const start = performance.now();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [booted]);

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

  const mountedAtRef = useRef(Date.now());

  const handleStartBoot = () => {
    // No startup chime here. Henry's intro audio is the typewriter clicks on the
    // HUD name/title/time typing (see HUDOverlay → ccType), which begin right after
    // boot and stop on their own when the typing finishes.
    // funnel: BIOS → clicked start → into the room (+ how long they waited)
    track('experience_started', { introSeconds: Math.round((Date.now() - mountedAtRef.current) / 1000) });
    roomStarted();
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
            <button className="boot-button" onClick={handleStartBoot} {...hoverHandlers('start-button')}>
              [ Click to Start TabariOS ]
            </button>
          )}
        </div>
      )}

    </div>
  );
};
