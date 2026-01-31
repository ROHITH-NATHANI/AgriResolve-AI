import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three-stdlib';

// Import Shaders

import simVelocity from '../shaders/simVelocity.glsl?raw';
import simPosition from '../shaders/simPosition.glsl?raw';
import leafVertex from '../shaders/leafVertex.glsl?raw';
import leafFragment from '../shaders/leafFragment.glsl?raw';

// Extend Three elements if necessary (though we use primitives mostly)

const TEXTURE_SIZE = 28; // 28x28 = 784 leaves (smoother flow)

export const FallingLeavesGPGPU: React.FC = () => {
    const { gl } = useThree();
    const gpuCompute = useRef<GPUComputationRenderer | null>(null);

    // Variables for GPGPU
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const velVar = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posVar = useRef<any>(null);

    // Visual Material Uniforms
    const uniforms = useMemo(() => ({
        uTexturePosition: { value: null },
        uTextureVelocity: { value: null },
        uTime: { value: 0 },
    }), []);

    // Initialize GPGPU
    useEffect(() => {
        if (!gl) return;

        const gpu = new GPUComputationRenderer(TEXTURE_SIZE, TEXTURE_SIZE, gl);



        // 1. Create Initial Data Textures
        const dtPos = gpu.createTexture();
        const dtVel = gpu.createTexture();

        const posArray = dtPos.image.data;
        const velArray = dtVel.image.data;

        for (let i = 0; i < posArray.length; i += 4) {
            // Random Initial Positions
            // Range: x: -10 to 10, y: -10 to 10, z: -5 to 0
            posArray[i + 0] = (Math.random() - 0.5) * 20;
            posArray[i + 1] = (Math.random() - 0.5) * 20;
            posArray[i + 2] = (Math.random() - 0.5) * 10 - 2;
            posArray[i + 3] = Math.random(); // Random seed/feature

            // Initial Velocity (Generic falling)
            velArray[i + 0] = (Math.random() - 0.5) * 0.2;
            velArray[i + 1] = -Math.random() * 0.5 - 0.1;
            velArray[i + 2] = (Math.random() - 0.5) * 0.2;
            velArray[i + 3] = 0;
        }

        // 2. Add Variables
        const velVariable = gpu.addVariable('textureVelocity', simVelocity, dtVel);
        const posVariable = gpu.addVariable('texturePosition', simPosition, dtPos);

        // 3. Dependencies
        gpu.setVariableDependencies(velVariable, [posVariable, velVariable]);
        gpu.setVariableDependencies(posVariable, [posVariable, velVariable]);

        // 4. Uniforms for Simulation Shaders
            velVariable.material.uniforms = {
            uTime: { value: 0 },
            uDelta: { value: 0 },
            uSpeed: { value: 0.05 }, // calmer fall speed
            uCurlFreq: { value: 0.10 }, // smoother curl noise
            uSeed: { value: new THREE.Vector4(Math.random(), Math.random(), Math.random(), Math.random()) },
            resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) }
        };

        posVariable.material.uniforms = {
            uTime: { value: 0 },
            uDelta: { value: 0 },
            // Visual Bounds: Top 7, Bottom -7, Left -10, Right 10
            uBounds: { value: new THREE.Vector4(7, -7, -10, 10) },
            resolution: { value: new THREE.Vector2(TEXTURE_SIZE, TEXTURE_SIZE) }
        };

        // 5. Initialize
        const errorInit = gpu.init();
        if (errorInit !== null) {
            console.error(errorInit);
        }

        gpuCompute.current = gpu;
        velVar.current = velVariable;
        posVar.current = posVariable;

    }, [gl]);


    // Simulation Loop
    useFrame((state, delta) => {
        if (!gpuCompute.current || !velVar.current || !posVar.current) return;

        const gpu = gpuCompute.current;

        // Update Uniforms
        velVar.current.material.uniforms.uTime.value = state.clock.elapsedTime;
        velVar.current.material.uniforms.uDelta.value = Math.min(delta, 0.1); // Clamp delta

        posVar.current.material.uniforms.uTime.value = state.clock.elapsedTime;
        posVar.current.material.uniforms.uDelta.value = Math.min(delta, 0.1);

        // Compute!
        gpu.compute();

        // Extract Results for Rendering
        uniforms.uTexturePosition.value = gpu.getCurrentRenderTarget(posVar.current).texture;
        uniforms.uTextureVelocity.value = gpu.getCurrentRenderTarget(velVar.current).texture;
        uniforms.uTime.value = state.clock.elapsedTime;
    });

    // Geometry: Create Attributes for Reference (UV mapping for texture lookup)
    const particlesGeom = useMemo(() => {
        // Determine Shape: Simple Plane for Leaf
        // We can use a PlaneBufferGeometry or a custom BufferGeometry
        const geometry = new THREE.PlaneGeometry(0.1, 0.1);
        // Alternatively, a slightly curved geometry if we wanted "High Fidelity 3D"
        // sticking to plane for performance/simplicity first, shader handles curvature via normal map or vertex displace if needed.

        const count = TEXTURE_SIZE * TEXTURE_SIZE;
        const references = new Float32Array(count * 2); // UV x,y

        for (let i = 0; i < TEXTURE_SIZE; i++) {
            for (let j = 0; j < TEXTURE_SIZE; j++) {
                const index = i * TEXTURE_SIZE + j;
                references[index * 2] = (j + 0.5) / TEXTURE_SIZE; // U
                references[index * 2 + 1] = (i + 0.5) / TEXTURE_SIZE; // V
            }
        }

        const instancedGeometry = new THREE.InstancedBufferGeometry();
        instancedGeometry.index = geometry.index;
        instancedGeometry.attributes.position = geometry.attributes.position;
        instancedGeometry.attributes.uv = geometry.attributes.uv;
        instancedGeometry.attributes.normal = geometry.attributes.normal;

        instancedGeometry.setAttribute('reference', new THREE.InstancedBufferAttribute(references, 2));

        return instancedGeometry;
    }, []);

    const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: leafVertex,
        fragmentShader: leafFragment,
        uniforms: uniforms,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false, // Don't occlude
    }), [uniforms]);


    return (
        <mesh>
            {/* We use primitives to mount the instanced mesh */}
            <primitive object={new THREE.InstancedMesh(particlesGeom, shaderMaterial, TEXTURE_SIZE * TEXTURE_SIZE)} />
        </mesh>
    );
};
