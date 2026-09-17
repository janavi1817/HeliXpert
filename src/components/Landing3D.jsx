import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Bot, ArrowRight, ShieldCheck, Database, Radio, Sun, Moon, Sparkles, Cpu, Activity } from 'lucide-react';

export default function Landing3D({ onLaunch, theme, toggleTheme }) {
  const mountRef = useRef(null);
  const GOLD = theme === 'dark' ? 0xc9a84c : 0x9a7930;
  const GOLD_BRIGHT = theme === 'dark' ? 0xe8c96a : 0xc9a84c;
  const BG_COLOR = theme === 'dark' ? 0x000000 : 0xfafafa;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;

    // --- Scene ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.055);

    // --- Camera ---
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 120);
    camera.position.set(0, 2.8, 9);
    camera.lookAt(0, 0.5, 0);

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient);

    const rimLight = new THREE.PointLight(GOLD_BRIGHT, 4, 20);
    rimLight.position.set(5, 8, 5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(GOLD, 2, 18);
    fillLight.position.set(-5, 2, -3);
    scene.add(fillLight);

    // Glow light underneath (halo effect)
    const haloLight = new THREE.PointLight(GOLD, 3, 8);
    haloLight.position.set(0, -0.5, 0);
    scene.add(haloLight);

    // --- Wireframe material ---
    const wireMat = new THREE.MeshBasicMaterial({
      color: GOLD_BRIGHT,
      wireframe: true,
      opacity: theme === 'dark' ? 0.85 : 0.6,
      transparent: true,
    });

    // Solid ghost body (subtle fill)
    const ghostMat = new THREE.MeshPhongMaterial({
      color: theme === 'dark' ? 0x111008 : 0xf5e6b0,
      transparent: true,
      opacity: theme === 'dark' ? 0.18 : 0.12,
      emissive: new THREE.Color(GOLD),
      emissiveIntensity: 0.15,
      side: THREE.DoubleSide,
    });

    // Edge line material
    const edgeMat = new THREE.LineBasicMaterial({
      color: GOLD_BRIGHT,
      linewidth: 1,
      transparent: true,
      opacity: 1.0,
    });

    // Helper: build both wireframe + edge lines for a mesh
    const addHoloPart = (geo, position, rotation, scale, parent) => {
      const solidMesh = new THREE.Mesh(geo, ghostMat);
      solidMesh.position.copy(position || new THREE.Vector3());
      if (rotation) solidMesh.rotation.copy(rotation);
      if (scale) solidMesh.scale.copy(scale);
      parent.add(solidMesh);

      const wireMesh = new THREE.Mesh(geo, wireMat);
      wireMesh.position.copy(position || new THREE.Vector3());
      if (rotation) wireMesh.rotation.copy(rotation);
      if (scale) wireMesh.scale.copy(scale);
      parent.add(wireMesh);

      const edges = new THREE.EdgesGeometry(geo, 12);
      const lineSegs = new THREE.LineSegments(edges, edgeMat);
      lineSegs.position.copy(position || new THREE.Vector3());
      if (rotation) lineSegs.rotation.copy(rotation);
      if (scale) lineSegs.scale.copy(scale);
      parent.add(lineSegs);

      return { solid: solidMesh, wire: wireMesh, lines: lineSegs };
    };

    // ============================================================
    //  BLACK HAWK STYLE HELICOPTER  (proper silhouette)
    // ============================================================
    const heliGroup = new THREE.Group();

    const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const eu = (x, y, z) => new THREE.Euler(x, y, z);
    const sc = (x, y, z) => new THREE.Vector3(x, y, z);

    // === MAIN FUSELAGE — flat-sided military body ===
    // BoxGeometry gives sharp edges like a real Black Hawk
    const fuseGeo = new THREE.BoxGeometry(3.2, 0.9, 1.2, 6, 3, 4);
    addHoloPart(fuseGeo, v3(0, 0.5, 0), eu(0, 0, 0), null, heliGroup);

    // Forward nose section (tapered)
    const noseGeo = new THREE.CylinderGeometry(0, 0.45, 1.0, 6, 2, false);
    addHoloPart(noseGeo, v3(1.8, 0.45, 0), eu(0, 0, -Math.PI / 2), null, heliGroup);

    // Cockpit bubble (large flat canopy)
    const cockpitGeo = new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
    addHoloPart(cockpitGeo, v3(1.1, 0.8, 0), eu(-Math.PI / 2, 0, 0), sc(1.4, 1, 0.95), heliGroup);

    // Crew door panel (left)
    const doorGeo = new THREE.BoxGeometry(0.9, 0.55, 0.04);
    addHoloPart(doorGeo, v3(0.1, 0.5, 0.63), eu(0, 0, 0), null, heliGroup);

    // Cargo / cabin section (wider mid-body)
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.85, 1.35, 4, 2, 4);
    addHoloPart(cabinGeo, v3(-0.4, 0.5, 0), eu(0, 0, 0), null, heliGroup);

    // Engine nacelles on top (twin turbines)
    const nacelleGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.1, 10);
    addHoloPart(nacelleGeo, v3(0.2, 1.1, 0.35), eu(0, 0, Math.PI / 2), null, heliGroup);
    addHoloPart(nacelleGeo, v3(0.2, 1.1, -0.35), eu(0, 0, Math.PI / 2), null, heliGroup);

    // === TAIL BOOM — long tapered ===
    const tailBoomGeo = new THREE.CylinderGeometry(0.12, 0.38, 3.5, 8, 3);
    addHoloPart(tailBoomGeo, v3(-2.5, 0.55, 0), eu(0, 0, -Math.PI / 2), null, heliGroup);

    // Tail Pylon (vertical fin, tall)
    const tailFinGeo = new THREE.BoxGeometry(0.5, 1.4, 0.08, 3, 5, 2);
    addHoloPart(tailFinGeo, v3(-4.1, 1.1, 0), eu(0, 0, -Math.PI / 14), null, heliGroup);

    // Horizontal stabilizer (T-tail)
    const hStabGeo = new THREE.BoxGeometry(0.25, 0.04, 1.6, 2, 1, 5);
    addHoloPart(hStabGeo, v3(-4.0, 1.55, 0), eu(0, 0, 0), null, heliGroup);

    // === LANDING GEAR ===
    // Nose wheel strut
    const noseLegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    addHoloPart(noseLegGeo, v3(1.3, -0.2, 0), eu(0, 0, 0), null, heliGroup);
    const noseWheelGeo = new THREE.TorusGeometry(0.12, 0.04, 6, 10);
    addHoloPart(noseWheelGeo, v3(1.3, -0.52, 0), eu(Math.PI / 2, 0, 0), null, heliGroup);

    // Main gear struts (pair)
    const mainLegGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6);
    addHoloPart(mainLegGeo, v3(-0.3, -0.2, 0.55), eu(0, 0, Math.PI / 14), null, heliGroup);
    addHoloPart(mainLegGeo, v3(-0.3, -0.2, -0.55), eu(0, 0, -Math.PI / 14), null, heliGroup);
    const mainWheelGeo = new THREE.TorusGeometry(0.16, 0.055, 6, 12);
    addHoloPart(mainWheelGeo, v3(-0.3, -0.52, 0.6), eu(Math.PI / 2, 0, 0), null, heliGroup);
    addHoloPart(mainWheelGeo, v3(-0.3, -0.52, -0.6), eu(Math.PI / 2, 0, 0), null, heliGroup);

    // === MAIN ROTOR HUB ===
    const hubGeo = new THREE.CylinderGeometry(0.28, 0.3, 0.18, 12);
    addHoloPart(hubGeo, v3(0, 0.06, 0), eu(0, 0, 0), null, null); // add to rotorGroup

    // MAIN ROTOR GROUP
    const mainRotorGroup = new THREE.Group();
    mainRotorGroup.position.set(0.2, 1.52, 0);

    // Hub
    const hubGeoR = new THREE.CylinderGeometry(0.3, 0.32, 0.2, 12);
    const hubMeshR = new THREE.Mesh(hubGeoR, new THREE.MeshBasicMaterial({ color: GOLD_BRIGHT, wireframe: true }));
    mainRotorGroup.add(hubMeshR);
    const hubEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hubGeoR), edgeMat);
    mainRotorGroup.add(hubEdge);

    // 4 long blades (Black Hawk has 4 blades)
    for (let i = 0; i < 4; i++) {
      const bladeGeo = new THREE.BoxGeometry(5.2, 0.03, 0.32, 12, 1, 2);
      const pivot = new THREE.Group();
      pivot.rotation.y = (i * Math.PI) / 2;

      const blade = new THREE.Mesh(bladeGeo, wireMat);
      blade.position.x = 2.6;
      pivot.add(blade);

      const bladeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(bladeGeo), edgeMat);
      bladeEdge.position.x = 2.6;
      pivot.add(bladeEdge);

      mainRotorGroup.add(pivot);
    }
    heliGroup.add(mainRotorGroup);

    // TAIL ROTOR GROUP
    const tailRotorGroup = new THREE.Group();
    tailRotorGroup.position.set(-4.15, 1.52, 0.1);

    for (let i = 0; i < 4; i++) {
      const tBladeGeo = new THREE.BoxGeometry(1.1, 0.04, 0.18, 6, 1, 2);
      const tPivot = new THREE.Group();
      tPivot.rotation.z = (i * Math.PI) / 2;
      const tBlade = new THREE.Mesh(tBladeGeo, wireMat);
      tBlade.position.x = 0.55;
      tPivot.add(tBlade);
      const tEdge = new THREE.LineSegments(new THREE.EdgesGeometry(tBladeGeo), edgeMat);
      tEdge.position.x = 0.55;
      tPivot.add(tEdge);
      tailRotorGroup.add(tPivot);
    }
    heliGroup.add(tailRotorGroup);

    heliGroup.position.set(0.3, 0.5, 0);
    heliGroup.rotation.y = 0.25; // slight angle like in image
    scene.add(heliGroup);

    // ============================================================
    //  HEXAGONAL GRID FLOOR  (exactly like the image)
    // ============================================================
    const hexGroup = new THREE.Group();
    hexGroup.position.y = -0.85;

    const hexRadius = 0.55;
    const hexHeight = hexRadius * Math.sqrt(3);
    const cols = 12, rows = 8;

    const hexLineMat = new THREE.LineBasicMaterial({
      color: GOLD,
      transparent: true,
      opacity: 0.35,
    });

    const makeHex = (cx, cz) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        pts.push(new THREE.Vector3(
          cx + hexRadius * Math.cos(angle),
          0,
          cz + hexRadius * Math.sin(angle)
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, hexLineMat);
      hexGroup.add(line);
    };

    for (let row = -rows; row < rows; row++) {
      for (let col = -cols; col < cols; col++) {
        const x = col * hexRadius * 1.75;
        const z = row * hexHeight + (col % 2 === 0 ? 0 : hexHeight / 2);
        makeHex(x, z);
      }
    }
    scene.add(hexGroup);

    // Central bright hex ring
    const centerRingMat = new THREE.LineBasicMaterial({
      color: GOLD_BRIGHT,
      transparent: true,
      opacity: 0.9,
    });
    const ringPts = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      ringPts.push(new THREE.Vector3(
        hexRadius * 2 * Math.cos(angle),
        0,
        hexRadius * 2 * Math.sin(angle)
      ));
    }
    const centerRing = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPts),
      centerRingMat
    );
    hexGroup.add(centerRing);

    // Crosshair underneath
    const crossMat = new THREE.LineBasicMaterial({ color: GOLD_BRIGHT, transparent: true, opacity: 0.8 });
    const crossH = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([v3(-1.5, 0.01, 0), v3(1.5, 0.01, 0)]),
      crossMat
    );
    const crossV = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([v3(0, 0.01, -1.5), v3(0, 0.01, 1.5)]),
      crossMat
    );
    hexGroup.add(crossH);
    hexGroup.add(crossV);

    // ============================================================
    //  PARTICLE FIELD
    // ============================================================
    const particleCount = 220;
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 20;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: GOLD,
      size: 0.04,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ============================================================
    //  ANIMATION LOOP
    // ============================================================
    let animFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Rotors
      mainRotorGroup.rotation.y += 0.38;
      tailRotorGroup.rotation.z += 0.6;

      // Slow hovering
      heliGroup.position.y = 0.5 + Math.sin(t * 1.3) * 0.1;
      heliGroup.rotation.z = Math.sin(t * 1.1) * 0.028;
      heliGroup.rotation.x = Math.cos(t * 0.9) * 0.018;

      // Gentle y-axis swing
      heliGroup.rotation.y = 0.25 + Math.sin(t * 0.35) * 0.1;

      // Hex grid subtle bob
      hexGroup.position.y = -0.85 + Math.sin(t * 0.5) * 0.02;

      // Halo glow pulse
      haloLight.intensity = 2.5 + Math.sin(t * 2) * 0.8;

      // Particle slow drift
      particles.rotation.y = t * 0.04;

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animFrameId);
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [theme]);

  const goldText = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700';
  const goldBorder = theme === 'dark' ? 'border-yellow-500/40' : 'border-yellow-600/40';
  const goldBg = theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-600/10';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textMuted = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
  const panelBg = theme === 'dark' ? 'bg-black/70 border-yellow-500/20' : 'bg-white/80 border-yellow-600/20';
  const btnPrimary = theme === 'dark'
    ? 'bg-yellow-500 hover:bg-yellow-400 text-black font-bold shadow-[0_0_20px_rgba(201,168,76,0.5)]'
    : 'bg-yellow-600 hover:bg-yellow-500 text-white font-bold shadow-[0_4px_16px_rgba(154,121,48,0.4)]';

  return (
    <div className={`relative w-full h-screen overflow-hidden flex flex-col justify-between ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-white text-gray-900'
    }`}>
      {/* 3D Canvas */}
      <div ref={mountRef} className="absolute inset-0 z-0" />

      {/* HUD scan line overlay */}
      {theme === 'dark' && (
        <div className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(201,168,76,0.015) 4px)',
          }}
        />
      )}

      {/* HUD corner brackets */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className={`w-8 h-8 border-l-2 border-t-2 ${theme === 'dark' ? 'border-yellow-500/60' : 'border-yellow-600/60'}`} />
      </div>
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
        <div className={`w-8 h-8 border-r-2 border-t-2 ${theme === 'dark' ? 'border-yellow-500/60' : 'border-yellow-600/60'}`} />
      </div>
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className={`w-8 h-8 border-l-2 border-b-2 ${theme === 'dark' ? 'border-yellow-500/60' : 'border-yellow-600/60'}`} />
      </div>
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
        <div className={`w-8 h-8 border-r-2 border-b-2 ${theme === 'dark' ? 'border-yellow-500/60' : 'border-yellow-600/60'}`} />
      </div>

      {/* HUD data panel — top left */}
      <div className={`absolute top-16 left-6 z-10 pointer-events-none font-mono text-xs space-y-1 ${goldText} opacity-70`}>
        <div>HEL_XHTPTER//021.JZX</div>
        <div className="text-[10px] text-gray-500">00:00 02.59B</div>
        <div className={`mt-2 px-2 py-1 border ${goldBorder} ${goldBg} text-[10px]`}>◎ OFFLINE AI</div>
      </div>

      {/* HUD data panel — top right */}
      <div className={`absolute top-16 right-6 z-10 pointer-events-none font-mono text-xs text-right space-y-1 ${goldText} opacity-70`}>
        <div className="flex gap-1 justify-end">
          {[1,1,1,1,1,0.4,0.2].map((o, i) => (
            <div key={i} className="w-2 h-5 rounded-sm" style={{ background: `rgba(201,168,76,${o})` }} />
          ))}
        </div>
        <div className="text-[10px] text-gray-500">SYS NOMINAL</div>
        <div className="text-[10px]">EGT: 592°C</div>
        <div className="text-[10px]">TORQUE: 54%</div>
      </div>

      {/* Top Header */}
      <header className="relative z-10 p-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-xl border ${goldBorder} flex items-center justify-center ${goldBg}`}>
            <Radio className={`w-5 h-5 ${goldText} hud-pulse`} />
          </div>
          <div>
            <h1 className={`font-bold text-xl font-mono tracking-widest ${textPrimary}`}>HeliXpert</h1>
            <span className={`text-xs ${goldText} font-mono flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block animate-ping`} />
              OFFLINE INTELLIGENCE
            </span>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center space-x-2 transition-all duration-200 ${panelBg} ${goldText} hover:border-yellow-500/60`}
          title="Toggle Theme"
        >
          {theme === 'dark' ? (
            <><Sun className="w-4 h-4" /><span>Light</span></>
          ) : (
            <><Moon className="w-4 h-4" /><span>Dark</span></>
          )}
        </button>
      </header>

      {/* Main CTA — left-aligned like reference image */}
      <main className="relative z-10 px-8 pb-10 max-w-xl ml-4 md:ml-12 space-y-5 mb-8">
        <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-sm border ${goldBorder} ${goldBg} ${goldText} font-mono text-xs`}>
          <Sparkles className="w-3.5 h-3.5" />
          <span>HELICOPTER INTELLIGENCE PLATFORM</span>
        </div>

        <h2 className={`text-4xl md:text-5xl font-bold leading-tight tracking-tight ${textPrimary}`}>
          Your ultimate<br />
          <span className={`${goldText} gold-glow-text`}>private helicopter</span><br />
          intelligence
        </h2>

        <p className={`text-sm leading-relaxed ${textMuted} max-w-sm`}>
          AI-powered, fully offline helicopter analytics. Query your real dataset with natural language — no internet required.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            id="launch-helixpert"
            onClick={onLaunch}
            className={`px-6 py-3 rounded-sm text-sm font-mono flex items-center space-x-2 transition-all duration-200 ${btnPrimary}`}
          >
            <Bot className="w-4 h-4" />
            <span>Launch HeliXpert</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className={`flex items-center gap-2 text-xs font-mono ${textMuted}`}>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Online</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-5 pt-3">
          {[
            { icon: Database, label: '6,169', sub: 'Maintenance Logs' },
            { icon: Activity, label: '742K', sub: 'Sensor Records' },
            { icon: Cpu, label: '10', sub: 'Aircraft Profiles' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={sub} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded border ${goldBorder} flex items-center justify-center ${goldBg}`}>
                <Icon className={`w-3.5 h-3.5 ${goldText}`} />
              </div>
              <div>
                <div className={`font-bold font-mono text-sm ${goldText}`}>{label}</div>
                <div className={`text-[10px] ${textMuted}`}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
