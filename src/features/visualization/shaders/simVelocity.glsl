
uniform float uTime;
uniform float uDelta;
uniform float uSpeed;
uniform float uCurlFreq;
uniform vec4 uSeed;

// ASHIMA WEBGL-NOISE (Simplex 3D)
// https://github.com/ashima/webgl-noise/blob/master/src/noise3D.glsl
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);

    vec3 p_x0 = vec3(snoise(p - dx), snoise(p - dx + vec3(13.5)), snoise(p - dx + vec3(27.1)));
    vec3 p_x1 = vec3(snoise(p + dx), snoise(p + dx + vec3(13.5)), snoise(p + dx + vec3(27.1)));
    vec3 p_y0 = vec3(snoise(p - dy), snoise(p - dy + vec3(13.5)), snoise(p - dy + vec3(27.1)));
    vec3 p_y1 = vec3(snoise(p + dy), snoise(p + dy + vec3(13.5)), snoise(p + dy + vec3(27.1)));
    vec3 p_z0 = vec3(snoise(p - dz), snoise(p - dz + vec3(13.5)), snoise(p - dz + vec3(27.1)));
    vec3 p_z1 = vec3(snoise(p + dz), snoise(p + dz + vec3(13.5)), snoise(p + dz + vec3(27.1)));

    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

    const float divisor = 1.0 / (2.0 * e);
    return normalize(vec3(x, y, z) * divisor);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

  // Forces
  // Break up coherent patterns by offsetting the noise domain per-leaf using pos.w and a random seed.
  float id = pos.w; // 0..1 per-particle seed from initialization
  vec3 domainOffset = vec3(uSeed.x, uSeed.y, uSeed.z) * 37.0 + vec3(id * 19.1, id * 7.7, id * 13.3);
  vec3 curl = curlNoise((pos.xyz + domainOffset) * uCurlFreq + uTime * 0.08);
    
    // Gravity (soft)
    vec3 gravity = vec3(0.0, -0.65, 0.0);
    
  // Wind push (combine curl with global wind direction)
  // Add tiny per-leaf side drift so the flow doesn't look "tiley".
  vec3 drift = vec3(sin(uTime * 0.22 + id * 6.283) * 0.14, 0.0, cos(uTime * 0.18 + id * 6.283) * 0.10);
  vec3 wind = (curl + drift) * 0.75;

  // Global gentle flow
  vec3 flowDir = normalize(vec3(1.0, 0.0, 0.35));
  vec3 flow = flowDir * (uSpeed * 0.25);
    
    // Target velocity: Gravity + Wind
  vec3 targetVel = gravity * uSpeed + wind * (uSpeed * 0.45) + flow;
    
    // Apply Drag / Inertia (Lerp towards target)
  vec3 newVel = mix(vel.xyz, targetVel, 0.08); // smoother motion

    gl_FragColor = vec4(newVel, 1.0);
}
