import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Plane, Radio, ShieldCheck, ChevronRight } from 'lucide-react';

// 3D Helicopter Model Component
function Helicopter3DModel() {
  const helicopterRef = useRef();
  const rotorRef = useRef();
  const tailRotorRef = useRef();

  useFrame((state) => {
    if (helicopterRef.current) {
      // Smooth bobbing animation
      helicopterRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      // Slow rotation
      helicopterRef.current.rotation.y += 0.005;
    }
    
    // Fast main rotor rotation
    if (rotorRef.current) {
      rotorRef.current.rotation.y += 0.3;
    }
    
    // Fast tail rotor rotation
    if (tailRotorRef.current) {
      tailRotorRef.current.rotation.z += 0.4;
    }
  });

  return (
    <group ref={helicopterRef}>
      {/* Main fuselage */}
      <mesh position={[0, 0, 0]} castShadow>
        <capsuleGeometry args={[0.5, 2, 8, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Cockpit glass */}
      <mesh position={[0, 0.2, 0.6]} castShadow>
        <sphereGeometry args={[0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color="#00ccff" transparent opacity={0.4} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Landing skids */}
      <group position={[0, -0.5, 0]}>
        <mesh position={[-0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.08, 2]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.08, 2]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Skid connectors */}
        <mesh position={[0, 0, 0.6]} castShadow>
          <boxGeometry args={[1, 0.05, 0.05]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, 0, -0.6]} castShadow>
          <boxGeometry args={[1, 0.05, 0.05]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </group>

      {/* Main rotor mast */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Main rotor hub */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 16]} />
        <meshStandardMaterial color="#FFCC33" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Main rotor blades */}
      <group ref={rotorRef} position={[0, 0.9, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI), 0]} position={[1.5, 0, 0]} castShadow>
            <boxGeometry args={[3, 0.02, 0.15]} />
            <meshStandardMaterial color="#FFCC33" metalness={0.9} roughness={0.1} emissive="#FFCC33" emissiveIntensity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Tail boom */}
      <mesh position={[0, 0.1, -1.2]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.25, 1.2, 8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Tail fin */}
      <mesh position={[0, 0.3, -1.8]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.05, 0.4, 0.3]} />
        <meshStandardMaterial color="#FFCC33" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Tail rotor */}
      <group ref={tailRotorRef} position={[0.5, 0.1, -1.9]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 4]} position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.02, 0.6, 0.08]} />
            <meshStandardMaterial color="#FFCC33" metalness={0.9} roughness={0.1} emissive="#FFCC33" emissiveIntensity={0.3} />
          </mesh>
        ))}
      </group>

      {/* Engine exhausts */}
      <mesh position={[0.3, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-0.3, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

export default function LandingPage({ onEnter }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-surface to-background flex flex-col items-center justify-center overflow-hidden">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgb(var(--primary-500)) 1px, transparent 1px),
            linear-gradient(90deg, rgb(var(--primary-500)) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)'
        }}
      />

      {/* Radial Glow */}
      <div className="absolute inset-0 bg-gradient-radial from-primary-500/10 via-transparent to-transparent" />

      {/* 3D Helicopter Canvas */}
      <div className="w-full h-2/3 relative z-10">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[4, 2, 4]} fov={50} />
          
          {/* Lighting Setup */}
          <ambientLight intensity={0.3} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={1} 
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <pointLight position={[-10, 5, -10]} intensity={0.5} color="#FFCC33" />
          <spotLight 
            position={[0, 10, 0]} 
            angle={0.3} 
            penumbra={0.5} 
            intensity={0.5}
            color="#FFCC33"
            castShadow
          />
          
          {/* Helicopter Model */}
          <Helicopter3DModel />
          
          {/* Ground plane with shadow */}
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.3} roughness={0.8} />
          </mesh>
          
          {/* Fog for depth */}
          <fog attach="fog" args={['rgb(var(--background))', 8, 20]} />
          
          {/* Orbit Controls */}
          <OrbitControls 
            enablePan={false} 
            enableZoom={false}
            autoRotate={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
          />
        </Canvas>

        {/* Corner HUD Elements */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary-500 opacity-60" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary-500 opacity-60" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary-500 opacity-60" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary-500 opacity-60" />
      </div>

      {/* Content Section */}
      <div className="relative z-20 text-center space-y-6 px-6 max-w-3xl">
        {/* Brand Header */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-400 to-primary-600 flex items-center justify-center shadow-gold-glow-strong">
            <Radio className="w-8 h-8 text-white animate-pulse-gold" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight font-mono">
              HeliXpert
            </h1>
            <p className="gold-accent text-sm font-mono tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500 inline-block animate-pulse-gold"></span>
              OFFLINE AI INTELLIGENCE
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="text-lg text-muted leading-relaxed max-w-2xl mx-auto">
          Advanced helicopter technical analysis platform powered by local AI. 
          Query real datasets, analyze engine health, review maintenance records, and perform prognostics — 
          <strong className="gold-accent"> 100% offline</strong>.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/50 backdrop-blur border border-border">
            <ShieldCheck className="w-4 h-4 text-success-light dark:text-success-dark" />
            <span className="text-muted">Local Datasets</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/50 backdrop-blur border border-border">
            <Radio className="w-4 h-4 gold-accent" />
            <span className="text-muted">AI Analyst</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/50 backdrop-blur border border-border">
            <Plane className="w-4 h-4 text-primary-500" />
            <span className="text-muted">Real Engine Data</span>
          </div>
        </div>

        {/* Enter Button */}
        {!loading && (
          <button
            onClick={onEnter}
            className="btn-primary text-lg px-8 py-4 inline-flex items-center space-x-3 mt-8 animate-fade-in"
          >
            <span>Enter HeliXpert</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {loading && (
          <div className="flex items-center justify-center space-x-2 text-primary-500">
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}

        {/* Version Info */}
        <p className="text-xs text-muted font-mono opacity-60">
          HeliXpert v1.0.0 • Premium Edition • Real Dataset Intelligence
        </p>
      </div>
    </div>
  );
}
