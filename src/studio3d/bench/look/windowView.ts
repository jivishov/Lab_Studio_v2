import * as THREE from "three";

/**
 * The view out of the lab's window (the natural room, you 2026-10-12): a lawn, a treeline across it and taller trees
 * behind, under the sky, out of focus. The lab is on the ground floor. Each pixel follows the ray from the eye through
 * the glass to the ground, to the treeline or the trees (planes parallel to the wall) or to the sky, so the view keeps
 * its depth as the camera moves (no backdrop to see the edges of, nothing past the far clip plane). The bench views
 * look down through the window, so they mostly see the lawn in front of the treeline. Unlit linear radiance, kept
 * under the bloom threshold (1.05) as the window has been since 2026-10-05, so it does not glare across the bench.
 */
export const WINDOW_VIEW = Object.freeze({
  /** The sky at the horizon and overhead, linear. */
  horizon: [0.95, 0.97, 1.0] as const,
  zenith: [0.55, 0.7, 0.92] as const,
  /** Sunlit lawn, its mowing stripes (± share, metres apart) and the treeline's shadow on it (shade, depth in m). */
  lawn: [0.28, 0.39, 0.13] as const,
  stripes: { amount: 0.05, width: 1.4 },
  shadow: { shade: 0.72, depth: 1.2 },
  /** The treeline: metres past the wall, its height over the ground and how much its crowns add. */
  treeline: { colour: [0.09, 0.135, 0.06] as const, distance: 12, height: 1.4, crowns: 1.3, crownWidth: 2.6 },
  /** The trees behind, hazed towards the sky with distance. */
  trees: { colour: [0.12, 0.17, 0.085] as const, distance: 45, height: 5, crowns: 4, crownWidth: 7, haze: 0.2 },
  /** The ground outside, below the lab's floor (m). */
  groundBelowFloor: 0.3,
  /** Out of focus: the half-width of every edge, as an angle (rad). */
  blur: 0.012,
});

const vec3 = (c: readonly number[]) => `vec3( ${c.map((x) => x.toFixed(3)).join(", ")} )`;
const f = (x: number) => x.toFixed(3);

/** `wall`: the z of the wall's outside face; `floor`: the lab's floor (both metres, world). */
export const windowViewMaterial = (place: { wall: number; floor: number }): THREE.ShaderMaterial => {
  const v = WINDOW_VIEW;
  const ground = place.floor - v.groundBelowFloor;
  const nearZ = place.wall - v.treeline.distance, farZ = place.wall - v.trees.distance;
  return new THREE.ShaderMaterial({
    name: "Window view",
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4( position, 1.0 );
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      const float GROUND = ${f(ground)};
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
      // Rounded crowns along x, 0 to 1, each its own height; two rows overlap so the line is uneven.
      float crowns( float x, float size, float seed ) {
        float f = fract( x / size ) - 0.5;
        return ( 0.45 + 0.55 * hash( vec2( floor( x / size ), seed ) ) ) * sqrt( max( 0.0, 1.0 - 4.0 * f * f ) );
      }
      float canopy( float x, float size, float seed ) {
        return max( crowns( x, size, seed ), 0.85 * crowns( x + 0.37 * size, size * 0.7, seed + 1.0 ) );
      }
      // Foliage: soft light and shade across the crowns, darker underneath.
      vec3 leaves( vec3 base, vec2 p ) {
        float light = 0.84 + 0.16 * sin( p.x * 1.7 + p.y * 2.3 ) * sin( p.x * 0.9 - p.y * 1.4 );
        return base * light * mix( 0.62, 1.0, smoothstep( GROUND, GROUND + 1.8, p.y ) );
      }
      void main() {
        vec3 o = cameraPosition;
        vec3 d = normalize( vWorld - cameraPosition );
        vec3 horizon = ${vec3(v.horizon)};
        vec3 c = mix( horizon, ${vec3(v.zenith)}, smoothstep( 0.0, 0.55, d.y ) );

        // The lawn, where a ray reaches the ground.
        float tG = ( GROUND - o.y ) / min( d.y, -1e-4 );
        vec3 pg = o + d * tG;
        float stripe = 1.0 + ${f(v.stripes.amount)} * sin( pg.x * 3.14159 / ${f(v.stripes.width)} );
        float shade = mix( ${f(v.shadow.shade)}, 1.0, smoothstep( 0.0, ${f(v.shadow.depth)}, pg.z - ${f(nearZ)} ) );
        vec3 lawn = ${vec3(v.lawn)} * stripe * shade;

        // The trees behind, then the lawn between them and the treeline.
        float tFar = ( ${f(farZ)} - o.z ) / min( d.z, -1e-4 );
        vec3 pf = o + d * tFar;
        float wFar = ${f(v.blur)} * tFar;
        float topFar = GROUND + ${f(v.trees.height)} + ${f(v.trees.crowns)} * canopy( pf.x, ${f(v.trees.crownWidth)}, 3.0 );
        c = mix( c, mix( leaves( ${vec3(v.trees.colour)}, pf.xy ), horizon, ${f(v.trees.haze)} ), 1.0 - smoothstep( topFar - wFar, topFar + wFar, pf.y ) );
        c = mix( c, lawn, 1.0 - smoothstep( GROUND - wFar, GROUND + wFar, pf.y ) );

        // The treeline, then the lawn in front of it.
        float tNear = ( ${f(nearZ)} - o.z ) / min( d.z, -1e-4 );
        vec3 pn = o + d * tNear;
        float wNear = ${f(v.blur)} * tNear;
        float topNear = GROUND + ${f(v.treeline.height)} + ${f(v.treeline.crowns)} * canopy( pn.x, ${f(v.treeline.crownWidth)}, 7.0 );
        c = mix( c, leaves( ${vec3(v.treeline.colour)}, pn.xy ), 1.0 - smoothstep( topNear - wNear, topNear + wNear, pn.y ) );
        c = mix( c, lawn, 1.0 - smoothstep( GROUND - wNear, GROUND + wNear, pn.y ) );

        c += ( hash( gl_FragCoord.xy ) - 0.5 ) / 512.0;
        gl_FragColor = vec4( c, 1.0 );
      }`,
    side: THREE.FrontSide,
    toneMapped: false,
  });
};
