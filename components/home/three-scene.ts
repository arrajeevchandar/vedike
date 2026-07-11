import * as THREE from "three";

const clamp = (v:number) => Math.max(0,Math.min(1,v));
const seg = (v:number,a:number,b:number) => clamp((v-a)/(b-a));
const lerp = (a:number,b:number,t:number) => a+(b-a)*t;

function glowTexture(){
  const canvas=document.createElement("canvas"); canvas.width=128; canvas.height=128;
  const ctx=canvas.getContext("2d")!; const g=ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(.15,"rgba(255,210,100,.75)"); g.addColorStop(1,"rgba(255,180,20,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,128,128); return new THREE.CanvasTexture(canvas);
}

export function createVedikeScene(container:HTMLElement){
  const mobile=innerWidth<700;
  const scene=new THREE.Scene() as THREE.Scene & { fog: THREE.Fog }; scene.background=new THREE.Color("#070408"); scene.fog=new THREE.Fog("#070408",25,105);
  const camera=new THREE.PerspectiveCamera(58,container.clientWidth/container.clientHeight,.1,400); camera.position.set(0,4,18);
  const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:"high-performance"}); renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:2)); renderer.setSize(container.clientWidth,container.clientHeight); container.appendChild(renderer.domElement);
  const glow=glowTexture();
  const gold=new THREE.Color("#F2B705"), red=new THREE.Color("#E63946");

  const particleCount=mobile?240:700; const pGeo=new THREE.BufferGeometry(); const pPos=new Float32Array(particleCount*3);
  for(let i=0;i<particleCount;i++){pPos[i*3]=(Math.random()-.5)*80;pPos[i*3+1]=Math.random()*28-4;pPos[i*3+2]=14-Math.random()*235}
  pGeo.setAttribute("position",new THREE.BufferAttribute(pPos,3));
  const pMat=new THREE.PointsMaterial({size:.34,map:glow,color:gold,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}); scene.add(new THREE.Points(pGeo,pMat));

  // Dawn city: skyline, lamps, a drawing metro line and ground rangoli.
  const city=new THREE.Group(); const buildingMat=new THREE.MeshBasicMaterial({color:"#10080b"});
  for(let i=0;i<48;i++){const h=2+Math.random()*13,w=2+Math.random()*4;const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,3+Math.random()*5),buildingMat);const side=Math.random()>.5?1:-1;m.position.set(side*(7+Math.random()*30),h/2,-18-Math.random()*55);city.add(m)}
  const lamps:THREE.Sprite[]=[]; for(let i=0;i<14;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:"#FFB84D",transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));s.position.set((i%2?1:-1)*5.5,3.2,-8-i*4.5);s.scale.set(3,3,1);city.add(s);lamps.push(s)}
  const metroCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-34,7,-14),new THREE.Vector3(-12,8.5,-26),new THREE.Vector3(8,7.5,-38),new THREE.Vector3(26,9,-52),new THREE.Vector3(40,8,-66)]);
  const metroGeo=new THREE.TubeGeometry(metroCurve,160,.14,6,false);const metro=new THREE.Mesh(metroGeo,new THREE.MeshBasicMaterial({color:gold}));const metroCount=metroGeo.index!.count;metroGeo.setDrawRange(0,0);city.add(metro);
  const rangoli=new THREE.Group(); for(let r=1;r<=5;r++){const pts:THREE.Vector3[]=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2,rad=r*1.04*(1+.12*Math.sin(a*(r%2?12:8)));pts.push(new THREE.Vector3(Math.cos(a)*rad,0,Math.sin(a)*rad))}rangoli.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:r%2?red:gold,transparent:true,opacity:0})))}rangoli.position.set(0,.02,-16);rangoli.scale.setScalar(.001);city.add(rangoli);scene.add(city);

  // Abstract Vidhana Soudha chapter.
  const monument=new THREE.Group(), edgeMats:THREE.LineBasicMaterial[]=[];const stone=new THREE.MeshBasicMaterial({color:"#170b10"});
  const block=(w:number,h:number,d:number,x:number,y:number,z=0)=>{const geo=new THREE.BoxGeometry(w,h,d),m=new THREE.Mesh(geo,stone);m.position.set(x,y,z);monument.add(m);const mat=new THREE.LineBasicMaterial({color:gold,transparent:true,opacity:0});const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo),mat);edges.position.copy(m.position);monument.add(edges);edgeMats.push(mat)};
  block(27,2.2,10,0,1.1);block(21,3.5,8,0,3.95);block(6,4.4,6,0,7.8);block(3.5,2.4,3.5,-9.5,6.8);block(3.5,2.4,3.5,9.5,6.8);
  const dome=(r:number,x:number,y:number)=>{const geo=new THREE.SphereGeometry(r,20,12,0,Math.PI*2,0,Math.PI/2);const m=new THREE.Mesh(geo,stone);m.position.set(x,y,0);monument.add(m);const mat=new THREE.LineBasicMaterial({color:gold,transparent:true,opacity:0});const wire=new THREE.LineSegments(new THREE.WireframeGeometry(geo),mat);wire.position.copy(m.position);monument.add(wire);edgeMats.push(mat)};dome(2.5,0,10);dome(1.1,-9.5,8);dome(1.1,9.5,8);
  const pillars:THREE.MeshBasicMaterial[]=[];for(let i=0;i<10;i++){const mat=new THREE.MeshBasicMaterial({color:"#24151a"});const p=new THREE.Mesh(new THREE.CylinderGeometry(.32,.36,3.2,8),mat);p.position.set(-8.1+i*1.8,3.9,4.1);monument.add(p);pillars.push(mat)}
  const under=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:gold,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));under.position.set(0,2.5,6);under.scale.set(42,12,1);monument.add(under);monument.position.z=-96;scene.add(monument);

  // Neon Bengaluru chapter.
  const neon=new THREE.Group(), roadMats:THREE.MeshBasicMaterial[]=[],curves:THREE.CatmullRomCurve3[]=[];["#FF2D3F","#FFCF3F","#9A4DFF"].forEach((color,i)=>{const off=(i-1)*5;const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(off-6,.15,-4),new THREE.Vector3(off+7,.15,-19),new THREE.Vector3(off-8,.15,-34),new THREE.Vector3(off+6,.15,-49),new THREE.Vector3(off-4,.15,-64)]);curves.push(curve);const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});roadMats.push(mat);neon.add(new THREE.Mesh(new THREE.TubeGeometry(curve,140,.16,5,false),mat))});
  const streaks:THREE.Mesh[]=[];for(let i=0;i<(mobile?12:26);i++){const mat=new THREE.MeshBasicMaterial({color:i%2?"#FFCF3F":"#FF4D5A",transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});const m=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,2.7),mat);m.userData={curve:curves[i%3],off:Math.random(),speed:.05+Math.random()*.09,mat};streaks.push(m);neon.add(m)}
  const grid=new THREE.GridHelper(80,30,"#9A4DFF","#301840");(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=0;grid.position.set(0,0,-34);neon.add(grid);neon.position.z=-96;scene.add(neon);

  // Utsava orbit: rings, Kannada placards, coins, lamps and petals.
  const orbit=new THREE.Group(),ringMats:THREE.MeshBasicMaterial[]=[];[6,10,14].forEach((r,i)=>{const mat=new THREE.MeshBasicMaterial({color:i===1?red:gold,transparent:true,opacity:0,wireframe:true});ringMats.push(mat);const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.08,6,96),mat);ring.rotation.x=Math.PI/2+(i-1)*.25;ring.userData.speed=(i%2?-.12:.09);orbit.add(ring)});
  const posters:THREE.Mesh[]=[];["ಕ","ನ","್ನ","ಡ","ಉ","ತ","್ಸ","ವ"].forEach((glyph,i)=>{const canvas=document.createElement("canvas");canvas.width=256;canvas.height=320;const ctx=canvas.getContext("2d")!;ctx.fillStyle=i%2?"#4b121b":"#30200a";ctx.fillRect(0,0,256,320);ctx.strokeStyle=i%2?"#E63946":"#F2B705";ctx.lineWidth=8;ctx.strokeRect(8,8,240,304);ctx.fillStyle="#FFF3DC";ctx.font="bold 120px sans-serif";ctx.textAlign="center";ctx.fillText(glyph,128,195);const mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,opacity:0,side:THREE.DoubleSide});const po=new THREE.Mesh(new THREE.PlaneGeometry(2.5,3.1),mat);po.userData={a:i/8*Math.PI*2,r:10+(i%2)*4,mat};posters.push(po);orbit.add(po)});
  const coins:THREE.Mesh[]=[];const coinMat=new THREE.MeshBasicMaterial({color:gold,transparent:true,opacity:0});for(let i=0;i<12;i++){const c=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.08,24),coinMat);c.rotation.z=Math.PI/2;c.userData.a=i/12*Math.PI*2;coins.push(c);orbit.add(c)}
  const petalsCount=mobile?70:180,petGeo=new THREE.BufferGeometry(),petPos=new Float32Array(petalsCount*3);for(let i=0;i<petalsCount;i++){petPos[i*3]=(Math.random()-.5)*30;petPos[i*3+1]=Math.random()*17;petPos[i*3+2]=(Math.random()-.5)*24}petGeo.setAttribute("position",new THREE.BufferAttribute(petPos,3));const petMat=new THREE.PointsMaterial({size:.35,color:red,transparent:true,opacity:0});orbit.add(new THREE.Points(petGeo,petMat));orbit.position.z=-185;scene.add(orbit);

  let target=0,p=0,raf=0,dead=false;const start=performance.now();
  const tick=(now:number)=>{if(dead)return;raf=requestAnimationFrame(tick);const time=(now-start)/1000;p+=(target-p)*.075;const camZ=18-p*206;camera.position.set(Math.sin(time*.4)*.28+Math.sin(p*9)*1.2,4+seg(p,.24,.4)*1.6-seg(p,.44,.6)*1.4,camZ);camera.lookAt(0,3+seg(p,.24,.4)*4-seg(p,.44,.56)*4+seg(p,.68,.82)*1.5,camZ-26);
    const dawn=seg(p,0,.16);metroGeo.setDrawRange(0,Math.floor(metroCount*seg(p,.015,.17)));const rt=seg(p,.04,.2);rangoli.scale.setScalar(Math.max(.001,rt*(mobile?4:5.2)));rangoli.rotation.y=time*.12;rangoli.children.forEach((l)=>((l as THREE.Line).material as THREE.LineBasicMaterial).opacity=.85*rt*(1-seg(p,.3,.42)));lamps.forEach((s,i)=>s.material.opacity=.55*seg(p,.02+i*.008,.08+i*.008)*(1+.2*Math.sin(time*3+i)));city.visible=p<.4;
    const sT=seg(p,.2,.34);edgeMats.forEach((m,i)=>m.opacity=.9*seg(p,.21+i*.012,.28+i*.012)*(1-seg(p,.46,.54)));pillars.forEach((m,i)=>m.color.copy(new THREE.Color("#24151a")).lerp(gold,seg(p,.24+i*.012,.29+i*.012)*(1-seg(p,.46,.54))));under.material.opacity=.35*sT*(1-seg(p,.46,.54));monument.visible=p>.12&&p<.62;
    const nT=seg(p,.42,.54)*(1-seg(p,.72,.82));roadMats.forEach((m,i)=>m.opacity=(.75-i*.12)*nT);(grid.material as THREE.Material).opacity=.46*nT;streaks.forEach(s=>{const u=(s.userData.off+time*s.userData.speed)%1,pos=s.userData.curve.getPointAt(u),tan=s.userData.curve.getTangentAt(u);s.position.copy(pos).y+=.3;s.lookAt(pos.clone().add(tan));s.userData.mat.opacity=.85*nT});neon.visible=p>.34&&p<.86;
    const oT=seg(p,.62,.74),collapse=seg(p,.88,1);orbit.scale.setScalar(Math.max(.001,(.4+oT*.6)*(1-collapse*.85)));orbit.rotation.y=time*.06;ringMats.forEach((m,i)=>m.opacity=(.8-i*.15)*oT*(1-collapse));orbit.children.forEach(c=>{if(c.userData.speed)c.rotation.z=time*c.userData.speed});posters.forEach((po,i)=>{const a=po.userData.a+time*.1;po.position.set(Math.cos(a)*po.userData.r,3.6+Math.sin(time*.7+i)*.5,Math.sin(a)*po.userData.r);po.lookAt(0,3.6,20);po.userData.mat.opacity=seg(p,.63+i*.014,.7+i*.014)*(1-collapse)});coins.forEach((c,i)=>{const a=c.userData.a-time*.22;c.position.set(Math.cos(a)*4.4,2.4+Math.sin(time*1.3+i)*.7,Math.sin(a)*4.4);c.rotation.y=time*2+i});coinMat.opacity=.9*seg(p,.7,.78)*(1-collapse);petMat.opacity=.7*oT*(1-collapse);const pa=petGeo.attributes.position as THREE.BufferAttribute;for(let i=0;i<petalsCount;i++){let y=pa.getY(i)-.012;if(y<0)y=17;pa.setY(i,y)}pa.needsUpdate=true;orbit.visible=p>.56;
    const bg=new THREE.Color().setHSL(lerp(.98,.78,seg(p,.38,.72)),lerp(.32,.48,seg(p,.4,.75)),lerp(.025,.045,dawn));scene.background=bg;scene.fog!.color.copy(bg);scene.fog!.far=90-collapse*48;pMat.opacity=.7*(1-collapse*.7);renderer.render(scene,camera)};
  raf=requestAnimationFrame(tick);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)};addEventListener("resize",resize);
  return {setProgress(v:number){target=clamp(v)},dispose(){dead=true;cancelAnimationFrame(raf);removeEventListener("resize",resize);renderer.dispose();glow.dispose();container.replaceChildren()}};
}
