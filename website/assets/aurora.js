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
    "uniform float uRidge;",   // the waterline, 0..1 from the bottom
    "uniform float uGrain;",

    "float h2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    "  float a=h2(i),b=h2(i+vec2(1,0)),c=h2(i+vec2(0,1)),d=h2(i+vec2(1,1));",
    "  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}",
    "float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.01+vec2(7.3,3.1);a*=.5;}return s;}",

    // The light is a few thin vertical sheets standing on wavy lines a
    // long way off, starting ~100 km up. Each ray from the eye crosses
    // horizontal slices of the sheets at rising altitude, and a slice
    // adds light where it passes close to a sheet's line. That gives the
    // curtains real perspective (farther ones sit lower and narrower),
    // folds that brighten where a sheet turns edge-on, and rays (noise
    // along the sheet only) that stay vertical all the way up.
    "vec3 aurora(vec3 rd, float t, float j){",
    "  vec3 acc=vec3(0.);",
    "  if(rd.y<=0.) return acc;",
    "  for(int i=0;i<34;i++){",
    "    float fi=float(i)+j;",
    "    float alt=1.+.012*fi+.0019*fi*fi;",       // dense low, where the border is sharp
    "    float dw=.012+.0038*fi;",                 // each slice weighted by its thickness
    "    vec2 P=rd.xz*(alt/rd.y);",
    "    float h=alt-1.;",
    "    float lum=0.;",
    "    for(int k=0;k<3;k++){",
    "      float fk=float(k);",
    "      float z0=4.4+fk*2.3;",
    "      float sx=P.x*(.30-.05*fk)+fk*5.3;",
    "      float line=z0*(1.+.34*(fbm3(vec2(sx*2.1,t*.012+fk))-.5)*2.+.12*sin(sx*4.3+t*.03+fk*2.));",
    "      float d=abs(P.y-line);",
    "      float band=exp(-d*d*(42.-fk*11.));",
    "      float r1=vn(vec2(sx*34.,t*.08+fk*9.));",
    "      float r2=vn(vec2(sx*11.,t*.035+fk*3.));",
    "      float rays=.18+1.25*r1*r1+.55*r2;",
    "      float patch=.06+.94*smoothstep(.28,.66,fbm3(vec2(sx*.55+t*.006,fk*3.1)));",
    "      lum+=band*rays*patch*(1.-fk*.18);",
    "    }",
    "    float fall=exp(-h*1.15)*smoothstep(0.,.02,h+.004)*dw;",
    "    vec3 c=mix(vec3(.55,1.,.62),vec3(.22,.95,.55),smoothstep(0.,.12,h));",    // a pale bright border, then the green
    "    c=mix(c,vec3(.10,.62,.42),smoothstep(.25,.9,h));",
    "    c=mix(c,vec3(.50,.24,.66),smoothstep(.75,2.,h));",                         // violet-magenta at the tops
    "    acc+=c*lum*fall;",
    "  }",
    "  return acc*7.5*smoothstep(0.,.06,rd.y);",
    "}",

    "float ridge(float x,float s,float k,float seed){",
    "  float r=1.-abs(fbm(vec2(x*s,seed))*2.-1.);",              // ridged noise: peaks, not hills
    "  return k*(.25+.75*r*r)+k*.18*(fbm(vec2(x*s*4.,seed+9.1))-.5);",
    "}",

    // the sky above the waterline: gradient, stars, aurora, far mountains
    "vec3 sky(vec2 uv,vec2 p,float hz,float t,float j,bool stars){",
    "  float y=uv.y-hz;",
    "  vec3 col=mix(vec3(.020,.034,.046),vec3(.006,.009,.018),pow(clamp(y/(1.-hz),0.,1.),.5));",
    "  vec3 rd=normalize(vec3(p.x*.9,y*1.05+.012,1.));",
    "  vec3 a=aurora(rd,t*.6,j);",
    "  a+=vec3(.02,.09,.06)*exp(-max(y,0.)*7.)*(.6+.4*fbm3(vec2(p.x*1.5,t*.01)));",   // the glow it throws on the low sky
    "  a*=.9+.1*sin(t*.07);",
    "  float al=dot(a,vec3(.3,.6,.1));",
    "  if(stars){",
    // sparse, of very different brightness, slightly warm or cool, and
    // hidden where the aurora is bright (it is in front of them)
    "    for(int l=0;l<3;l++){",
    "      float sc=l==0?150.:l==1?60.:22.;",
    "      vec2 g=p*sc+float(l)*31.7;",
    "      vec2 id=floor(g),f=fract(g);",
    "      float h=h2(id);",
    "      float th=l==0?.91:l==1?.962:.985;",
    "      if(h>th){",
    "        vec2 o=vec2(h2(id+3.1),h2(id+7.7))*.7+.15;",
    "        float d=length(f-o)/(sc/uRes.y);",
    "        float m=pow((h-th)/(1.-th),2.5);",
    "        float b=l==0?.16*m:l==1?.45*m:1.1*m+.15;",
    "        float w=l==2?.55:1.25;",
    "        b*=.88+.12*sin(t*(1.3+h*3.)+h*40.);",
    "        vec3 tint=mix(vec3(.74,.82,1.),vec3(1.,.86,.72),h2(id+1.3));",
    "        col+=tint*b*(exp(-d*d*w)+(l==2?.08*exp(-d*.6):0.))*smoothstep(0.,.18,y)/(1.+al*14.);",
    "      }",
    "    }",
    "  }",
    "  col+=a;",
    // far mountains, standing on the water, lit very slightly from above
    "  float rf=ridge(p.x,1.6,.11,3.7)+.006;",
    "  float rf2=ridge(p.x+4.,2.6,.06,8.3)+.003;",
    "  float px1=1.2/uRes.y;",
    "  vec3 m1=vec3(.010,.016,.020)+a*.04;",
    "  vec3 m2=vec3(.004,.006,.008);",
    "  col=mix(col,m1,smoothstep(rf+px1,rf-px1,y));",
    "  col=mix(col,m2,smoothstep(rf2+px1,rf2-px1,y));",
    "  return col;",
    "}",

    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/uRes;",
    "  float asp=uRes.x/uRes.y;",
    "  vec2 p=vec2((uv.x-.5)*asp,uv.y);",
    "  float t=uTime;",
    "  float hz=uRidge;",
    "  float j=h2(gl_FragCoord.xy+fract(t)*31.);",   // dither the slices: banding becomes grain
    "  vec3 col;",
    "  if(uv.y>=hz){",
    "    col=sky(uv,p,hz,t,j,true);",
    "  }else{",
    // the lake: the sky upside down, broken up by slow ripples, darker
    "    float dy=hz-uv.y;",
    "    float rip=(vn(vec2(p.x*6.,dy*160.+t*.4))-.5)*.012*min(1.,dy*30.);",
    "    vec2 ru=vec2(uv.x+rip,hz+dy);",
    "    vec2 rp=vec2((ru.x-.5)*asp,ru.y);",
    "    col=sky(ru,rp,hz,t,j,false)*.5;",
    "    col+=vec3(.004,.006,.008);",
    // the near shore: black ground the laptop stands on
    "    float shore=hz-.13-.06*fbm(vec2(p.x*1.1+2.,1.3))-.015*(vn(vec2(p.x*9.,4.))-.5);",
    "    float px1=1.2/uRes.y;",
    "    float g=smoothstep(shore+px1,shore-px1,uv.y);",
    "    vec3 ground=vec3(.006,.008,.009)+vec3(.004,.010,.008)*smoothstep(shore-.12,shore,uv.y);",
    "    col=mix(col,ground,g);",
    "  }",

    // tone: soft shoulder, never clipped into neon, a little desaturation
    "  col=1.-exp(-col*1.6);",
    "  float lum=dot(col,vec3(.2126,.7152,.0722));",
    "  col=mix(col,vec3(lum),.10);",
    "  vec2 q=uv-.5;",
    "  col*=1.-.38*dot(q*vec2(.85,1.1),q*vec2(.85,1.1));",
    "  float n=h2(gl_FragCoord.xy+fract(t*7.13)*113.)-.5;",
    "  col+=n*uGrain;",
    "  gl_FragColor=vec4(max(col,0.),1.);",
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
      return opts.ridge != null ? opts.ridge : (r.width / r.height < 0.8 ? 0.27 : 0.30);
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
