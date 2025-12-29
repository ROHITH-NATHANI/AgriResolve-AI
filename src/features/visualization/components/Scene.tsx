import { Canvas } from '@react-three/fiber'
import { HeroParticles } from './HeroParticles'
import { Environment } from '@react-three/drei'

export default function Scene3D() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 1] }} className="pointer-events-none" style={{ pointerEvents: 'none' }}>
                <HeroParticles />
                <Environment preset="city" />
            </Canvas>
        </div>
    )
}
