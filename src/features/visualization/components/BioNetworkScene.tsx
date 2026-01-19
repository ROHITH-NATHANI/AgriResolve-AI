import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';
import * as THREE from 'three';

const Particles = (props: Record<string, unknown>) => {
    const ref = useRef<THREE.Points>(null);

    // Generate 2000 random points in a sphere
    const sphere = useMemo(() => random.inSphere(new Float32Array(2000 * 3), { radius: 1.5 }), []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10;
            ref.current.rotation.y -= delta / 15;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#16a34a"  // Green-600 to match brand
                    size={0.003}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={0.6}
                />
            </Points>
        </group>
    );
};

const Connections = () => {
    // A secondary slower moving layer for depth
    const ref = useRef<THREE.Points>(null);
    const sphere = useMemo(() => random.inSphere(new Float32Array(500 * 3), { radius: 2 }), []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta / 20;
            ref.current.rotation.y += delta / 25;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#86efac"  // Green-300
                    size={0.005}
                    sizeAttenuation={true}
                    depthWrite={false}
                    opacity={0.4}
                />
            </Points>
        </group>
    );
}


export const BioNetworkScene: React.FC = () => {
    return (
        <div className="fixed inset-0 w-full h-full -z-10 bg-gradient-to-br from-green-50/50 to-white/80 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <Particles />
                <Connections />
            </Canvas>
        </div>
    );
};
