
uniform float uTime;
uniform float uDelta;
uniform vec4 uBounds; // x: top, y: bottom, z: left, w: right

// Pseudo-random function
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

    // Integration: p = p + v * dt
    vec3 newPos = pos.xyz + vel.xyz * uDelta;
    
    // Boundary check (Bottom)
    if (newPos.y < uBounds.y) { // Below bottom edge
        newPos.y = uBounds.x + rand(vec2(uv.x, uTime)) * 1.5; // Respawn near top with variation
        
        // Randomize X and Z
        float seed = uTime + uv.x;
        float rX = (rand(vec2(seed, uv.y)) - 0.5) * (uBounds.w - uBounds.z); // Scale to width
        float rZ = (rand(vec2(seed * 0.5, uv.y)) - 0.5) * 10.0; // Depth spread
        
        newPos.x = rX;
        newPos.z = rZ;
    }

    gl_FragColor = vec4(newPos, 1.0); // W channel can store scale or variant index
}
