
varying vec2 vUv;
varying vec3 vColor;
varying float vDepth;

// Simple hash for subtle texture
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

void main() {
    // Simple leaf shape mask from UV
    vec2 center = vUv - 0.5;
    float dist = length(center);
    
    // Create a leaf shape (pointed oval)
    // equation: x^2 + (y/2)^2 < r^2 ish
    
    float shape = 1.0 - smoothstep(0.28, 0.52, length(vec2(center.x * 1.5, center.y)));
    
    // Vein line
    float vein = 1.0 - smoothstep(0.008, 0.02, abs(center.x));
    
    if (shape < 0.1) discard;
    
    // Final color mixing
    vec3 color = vColor;

    // Subtle gradient: brighter tip, darker base
    color = mix(color * 0.85, color * 1.08, smoothstep(0.0, 1.0, vUv.y));

    // Add faint organic texture
    float grain = hash21(vUv * 50.0) * 0.06;
    color += grain;
    
    // Darken vein
    color = mix(color, color * 0.45, vein * 0.6);
    
    // Soft alpha at edges
    float alpha = smoothstep(0.0, 0.6, shape);

    gl_FragColor = vec4(color, alpha * 0.9);
}
