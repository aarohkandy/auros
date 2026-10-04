/* aurora.js — the sky behind the laptop.
 *
 * One hand-written fragment shader, WebGL 1, no library. It is meant
 * to read as a long exposure rather than a screensaver: curtains with
 * a sharp lower edge and vertical rays that fade upward from green
 * (oxygen, ~100 km) to a dim violet-red (higher, thinner air); stars
 * that sit behind the light rather than on top of it; two ridges in
 * silhouette; film grain; and a tone curve that never lets anything
 * clip into neon.
 *
 * It is a progressive enhancement. The page paints a still of this
 * same shader first (assets/sky/still-*.{avif,webp}, made by
 * website/tools/stills.mjs); the canvas fades in over it only once it
 * has drawn a frame. Resolution is capped (no devicePixelRatio, and
 * 0.5–0.65 of the CSS size — the sky is soft anyway), it runs at
 * about 30 fps, and it stops when it is off screen or the tab is
 * hidden. With prefers-reduced-motion it draws one frame and stops.
 */
(function () {
  "use strict";

  var VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes;",
    "uniform float uTime;",
    "uniform float uRidge;",   // y of the far ridge, 0..1 from the bottom
    "uniform float uGrain;",

    "float h1(float n){return fract(sin(n)*43758.5453123);}",
    "float h2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    "  float a=h2(i),b=h2(i+vec2(1,0)),c=h2(i+vec2(0,1)),d=h2(i+vec2(1,1));",
    "  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}",
    "float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.01+vec2(7.3,3.1);a*=.5;}return s;}",

    // The light is a set of thin vertical sheets standing on wavy lines
    // on the ground plane, 100 km up and some distance away. Each ray from
    // the eye is intersected with horizontal slices of that sheet at
    // rising altitude; a slice adds light where it is close to the
    // ribbon's line. That is what gives the curtains their perspective:
    // farther ribbons sit lower and narrower, folds brighten where the
    // sheet turns edge-on, and the rays (noise along the ribbon only)
    // stay vertical all the way up.
    "vec3 aurora(vec3 rd, float t){",
    "  vec3 acc=vec3(0.);",
    "  if(rd.y<=0.) return acc;",
    "  float j=h2(gl_FragCoord.xy+fract(t)*31.);",   // dither the slices: banding becomes grain
    "  for(int i=0;i<30;i++){",
    "    float fi=float(i)+j;",
    "    float alt=1.+.010*fi+.0016*fi*fi;",       // slice altitude: dense low, where the border is sharp
    "    float dw=(.010+.0032*fi)/.05;",           // and each slice weighted by its thickness
    "    float tt=alt/rd.y;",
    "    vec2 P=rd.xz*tt;",                         // where this slice is crossed
    "    float lum=0.;",
    "    for(int k=0;k<3;k++){",
    "      float fk=float(k);",
    "      float z0=2.9+fk*1.9;",                    // the ribbon's distance
    "      float sx=P.x*(.42-.08*fk)+fk*5.3;",
    "      float line=z0*(1.+.36*(fbm3(vec2(sx*.8,t*.012+fk))-.5)*2.+.12*sin(sx*2.3+t*.03+fk));",
    "      float d=abs(P.y-line);",
    "      float band=exp(-d*d*(90.-fk*24.));",
    "      float rays=.25+1.1*pow(vn(vec2(sx*38.,t*.09+fk*9.)),2.)+.4*vn(vec2(sx*9.,t*.04));",
    "      float patch=smoothstep(.2,.65,fbm3(vec2(sx*.7+t*.008,fk*3.1)));",
    "      lum+=band*rays*patch*(1.-fk*.2);",
    "    }",
    "    float h=alt-1.;",
    "    float fall=exp(-h*2.5)*smoothstep(0.,.025,h+.004)*dw;",
    "    vec3 c=mix(vec3(.46,.98,.55),vec3(.20,.88,.44),smoothstep(0.,.2,h));",
    "    c=mix(c,vec3(.52,.22,.62),smoothstep(.3,1.1,h));",
    "    acc+=c*lum*fall;",
    "  }",
    "  return acc*.55*smoothstep(0.,.08,rd.y);",
    "}",

    "float ridge(float x,float base,float s,float k){",
    "  float r=1.-abs(fbm(vec2(x*s,3.7*k))*2.-1.);",           // ridged: peaks, not hills
    "  return base+k*(r-.55)+k*.25*(fbm(vec2(x*s*3.,9.1))-.5);",
    "}",

    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/uRes;",
    "  float asp=uRes.x/uRes.y;",
    "  vec2 p=vec2((uv.x-.5)*asp,uv.y);",
    "  float t=uTime;",
    "  float hz=uRidge;",

    // sky: near-black at the zenith, a little warmth of airglow low down
    "  vec3 zen=vec3(.008,.012,.024);",
    "  vec3 hor=vec3(.022,.040,.055);",
    "  vec3 col=mix(hor,zen,pow(clamp((uv.y-hz)/(1.-hz),0.,1.),.55));",
    "  col+=vec3(.010,.030,.022)*exp(-max(uv.y-hz,0.)*9.);",

    // stars: two layers, behind everything
    "  for(int l=0;l<2;l++){",
    "    float sc=l==0?190.:70.;",
    "    vec2 g=p*sc+float(l)*31.7;",
    "    vec2 id=floor(g),f=fract(g);",
    "    float h=h2(id);",
    "    float th=l==0?.82:.965;",
    "    if(h>th){",
    "      vec2 o=vec2(h2(id+3.1),h2(id+7.7))*.7+.15;",
    "      float px=sc/uRes.y;",                                  // cell size in px, inverted
    "      float d=length((f-o))/px;",
    "      float b=pow((h-th)/(1.-th),2.2)*(l==0?.35:1.1);",
    "      b*=.86+.14*sin(t*(1.+h*3.)+h*40.);",
    "      vec3 sc3=mix(vec3(.78,.84,1.),vec3(1.,.88,.76),h2(id+1.3));",
    "      col+=sc3*b*exp(-d*d*1.6)*smoothstep(hz-.02,hz+.25,uv.y);",
    "    }",
    "  }",

    // the aurora
    "  vec3 rd=normalize(vec3(p.x*.95,(uv.y-hz)*1.05+.015,1.));",
    "  vec3 a=aurora(rd,t*.6);",
    "  a+=vec3(.012,.05,.032)*exp(-max(uv.y-hz,0.)*6.);",            // glow low on the horizon
    "  a*=.88+.12*sin(t*.07);",
    "  col+=a*smoothstep(hz-.01,hz+.04,uv.y);",

    // ridges: a far one that catches a little of the light, a near one that does not
    "  float rf=ridge(p.x,hz,1.7,.15);",
    "  float rn=ridge(p.x+11.,hz-.08,.8,.14)-.02;",
    "  float px1=1.5/uRes.y;",
    "  float mf=smoothstep(rf+px1,rf-px1,uv.y);",
    "  vec3 farc=mix(hor*.55,vec3(.02,.05,.045),.5)+a*.05;",
    "  farc*=.55+.45*smoothstep(rf-.12,rf,uv.y);",
    "  col=mix(col,farc,mf);",
    "  float mn=smoothstep(rn+px1,rn-px1,uv.y);",
    "  vec3 nearc=vec3(.010,.013,.016)+vec3(.006,.012,.010)*smoothstep(rn-.2,rn,uv.y);",
    "  col=mix(col,nearc,mn);",

    // tone: soft shoulder, no clipping, a little desaturation
    "  col=1.-exp(-col*1.55);",
    "  float lum=dot(col,vec3(.2126,.7152,.0722));",
    "  col=mix(col,vec3(lum),.12);",
    // vignette and grain
    "  vec2 q=uv-.5;",
    "  col*=1.-.42*dot(q*vec2(.9,1.2),q*vec2(.9,1.2));",
    "  float n=h2(gl_FragCoord.xy+fract(t*7.13)*113.)-.5;",
    "  col+=n*uGrain;",
    "  col=pow(max(col,0.),vec3(.95));",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "shader");
    }
    return s;
  }

  /* start(canvas, opts) -> controller | null */
  function start(canvas, opts) {
    opts = opts || {};
    var gl;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false,
                                        preserveDrawingBuffer: !!opts.still, powerPreference: "low-power" });
    } catch (e) { gl = null; }
    if (!gl) return null;

    var prog = gl.createProgram();
    try {
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    } catch (e) { if (window.console) console.warn("aurora:", e.message); return null; }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "uRes"),
        uTime = gl.getUniformLocation(prog, "uTime"),
        uRidge = gl.getUniformLocation(prog, "uRidge"),
        uGrain = gl.getUniformLocation(prog, "uGrain");

    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var scale = opts.scale || (small ? 0.5 : 0.62);
    var t0 = opts.time != null ? opts.time : 40 + Math.random() * 400;
    var running = false, raf = 0, last = 0, visible = true, drew = false;

    function size() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(2, Math.round(r.width * scale)), h = Math.max(2, Math.round(r.height * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    }
    function ridgeY() {
      // where the far ridge sits: lower on a landscape screen, a little
      // higher on a phone so the laptop has ground to stand on
      var r = canvas.getBoundingClientRect();
      return opts.ridge != null ? opts.ridge : (r.width / r.height < 0.8 ? 0.30 : 0.26);
    }
    function draw(now) {
      var t = t0 + (opts.time != null ? 0 : now / 1000);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uRidge, ridgeY());
      gl.uniform1f(uGrain, opts.grain != null ? opts.grain : 0.028);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!drew) { drew = true; if (opts.onFirstFrame) opts.onFirstFrame(); }
    }
    // An old laptop's integrated graphics is exactly who visits this page.
    // If frames are coming slowly, draw fewer pixels; if that is still
    // slow at the smallest size, keep the last frame and stop.
    var slow = 0, n = 0;
    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;      // ~30 fps is plenty for light that moves this slowly
      var gap = last ? now - last : 33;
      last = now;
      if (++n > 4) {
        slow = slow * 0.85 + (gap > 60 ? 1 : 0) * 0.15;
        if (slow > 0.6) {
          slow = 0; n = 0;
          if (scale > 0.3) { scale = Math.max(0.3, scale * 0.72); size(); }
          else { pause(); return; }
        }
      }
      draw(now);
    }
    function play() {
      if (running || opts.still || !visible || document.hidden) return;
      running = true; raf = requestAnimationFrame(loop);
    }
    function pause() { running = false; cancelAnimationFrame(raf); }

    size();
    draw(performance.now());
    if (!opts.still && !opts.reduce) {
      play();
      document.addEventListener("visibilitychange", function () { document.hidden ? pause() : play(); });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting; visible ? play() : pause();
        }).observe(canvas);
      }
    }
    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { size(); draw(performance.now()); }, 120);
    });
    return { play: play, pause: pause, draw: function () { draw(performance.now()); } };
  }

  window.AurOSAurora = { start: start };
})();
