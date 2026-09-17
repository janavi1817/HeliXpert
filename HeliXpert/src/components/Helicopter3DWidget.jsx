import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, ArrowRight } from 'lucide-react';

// Simplified Helicopter Model for Widget
function SimpleHelicopterModel() {
  const helicopterRef = useRef();
  const rotorRef = useRef();
  const tailRotorRef = useRef();

  useFrame(() => {
    if (helicopterRef.current) helicopterRef.current.rotation.y += 0.01;
    if (rotorRef.current) rotorRef.current.rotation.y += 0.5;
    if (tailRotorRef.current) tailRotorRef.current.rotation.z += 0.4;
  });

  return (
    <group ref={helicopterRef}>
      {/* Fuselage */}
      <mesh position={[0, 0, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.5, 6, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Cockpit glass — gold tint */}
      <mesh position={[0, 0.1, 0.5]} castShadow>
        <sphereGeometry args={[0.35, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#FFCC33" transparent opacity={0.35} />
      </mesh>

      {/* Landing skids */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, -0.4, 0]} castShadow>
          <boxGeometry args={[0.05, 0.05, 1.5]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}

      {/* Main rotor mast */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Main rotor blades */}
      <group ref={rotorRef} position={[0, 0.7, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} rotation={[0, i * Math.PI, 0]} position={[1.2, 0, 0]} castShadow>
            <boxGeometry args={[2.4, 0.01, 0.1]} />
            <meshStandardMaterial color="#FFCC33" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>

      {/* Tail boom */}
      <mesh position={[0, 0.1, -1]} castShadow>
        <cylinderGeometry args={[0.1, 0.2, 1, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Tail rotor */}
      <group ref={tailRotorRef} position={[0.4, 0.1, -1.5]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.01, 0.5, 0.05]} />
            <meshStandardMaterial color="#FFCC33" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function Helicopter3DWidget({ onOpenFullView, className = "" }) {
  return (
    <div className={`relative bg-black rounded-xl overflow-hidden border border-primary-500/30 ${className}`}>
      {/* Canvas */}
      <div className="h-48">
        <Canvas
          camera={{ position: [3, 2, 3], fov: 50 }}
          style={{ background: 'radial-gradient(circle at center, #0a0a0a 0%, #000 100%)' }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
          <pointLight position={[-5, 2, -5]} intensity={0.3} color="#FFCC33" />
          <SimpleHelicopterModel />
          <fog attach="fog" args={['#000000', 5, 20]} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate={false} enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>

      {/* Badge */}
      <div className="absolute top-3 left-3 flex items-center space-x-2">
        <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse-gold"></div>
        <span className="text-xs font-mono text-primary-500">3D MODEL</span>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-primary-500 font-mono">Interactive Helicopter</h4>
            <p className="text-xs text-muted">360° Rotating Model</p>
          </div>
          <button
            onClick={onOpenFullView}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-primary-500/20 border border-primary-500/30 text-primary-500 hover:bg-primary-500/30 transition-all text-xs font-mono"
          >
            <Box className="w-3 h-3" />
            <span>Full View</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-primary-500 opacity-40 pointer-events-none"></div>
      <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-primary-500 opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-primary-500 opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-primary-500 opacity-40 pointer-events-none"></div>
    </div>
  );
}
