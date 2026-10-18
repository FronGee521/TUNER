(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const modes = {
    standard: [{n:"E",o:2},{n:"A",o:2},{n:"D",o:3},{n:"G",o:3},{n:"B",o:3},{n:"E",o:4}],
    dropd: [{n:"D",o:2},{n:"A",o:2},{n:"D",o:3},{n:"G",o:3},{n:"B",o:3},{n:"E",o:4}],
    dropc: [{n:"C",o:2},{n:"G",o:2},{n:"C",o:3},{n:"F",o:3},{n:"A",o:3},{n:"D",o:4}],
    dadgad: [{n:"D",o:2},{n:"A",o:2},{n:"D",o:3},{n:"G",o:3},{n:"A",o:3},{n:"D",o:4}],
    openG: [{n:"D",o:2},{n:"G",o:2},{n:"D",o:3},{n:"G",o:3},{n:"B",o:3},{n:"D",o:4}]
  };
  const noteNames = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const state = {ctx:null,stream:null,source:null,analyser:null,raf:0,cal:440,mode:"standard",selected:0,lastFreq:0,history:[],running:false};
  const noteMidi = (n,o) => (o+1)*12+noteNames.indexOf(n);
  const midiFreq = midi => state.cal * Math.pow(2,(midi-69)/12);
  const freqMidi = f => 69+12*Math.log2(f/state.cal);
  const fmt = (n,d=2) => Number(n).toFixed(d);
  function targets(){
    if(state.mode==="chromatic") return Array.from({length:49},(_,i)=>({midi:36+i,note:noteNames[(36+i)%12],oct:Math.floor((36+i)/12)-1}));
    return modes[state.mode].map(s=>({midi:noteMidi(s.n,s.o),note:s.n,oct:s.o}));
  }
  function renderStrings(){
    const root=$("strings"); root.innerHTML="";
    if(state.mode==="chromatic"){
      root.innerHTML='<div class="hint">Хроматический режим: цель выбирается автоматически по входящему сигналу.</div>';return;
    }
    targets().forEach((t,i)=>{
      const b=document.createElement("button");b.className="string-card"+(i===state.selected?" selected":"");
      b.innerHTML=`<span class="s-note">${t.note}</span><span class="s-name">СТРУНА ${6-i}</span><span class="s-hz">${fmt(midiFreq(t.midi),2)} Hz</span>`;
      b.addEventListener("click",()=>{state.selected=i;renderStrings();updateTarget();});
      root.appendChild(b);
    });
  }
  function updateTarget(){
    const list=targets(); const t=list[Math.min(state.selected,list.length-1)];
    if(!t)return;
    $("target").textContent=`${t.note}${t.oct} · ${fmt(midiFreq(t.midi),2)} Hz`;
  }
  function buildTicks(){
    const root=$("ticks");
    for(let i=0;i<=50;i++){const s=document.createElement("span");s.className="tick"+(i%5===0?" major":"")+(i===25?" zero":"");root.appendChild(s);}
  }
  function setStatus(active,text){$("statusDot").parentElement.classList.toggle("active",active);$("statusText").textContent=text;}
  function setHint(s){$("hint").textContent=s;}
  function autoCorrelate(buf,sampleRate){
    // Normalized autocorrelation with RMS gate; searches guitar fundamentals, not just loud harmonics.
    let rms=0; for(let i=0;i<buf.length;i++)rms+=buf[i]*buf[i]; rms=Math.sqrt(rms/buf.length);
    if(rms<0.008)return null;
    let bestOffset=-1,bestCorr=0,prev=1,found=false;
    const minLag=Math.floor(sampleRate/420),maxLag=Math.min(Math.floor(sampleRate/55),buf.length-2);
    const correlations=new Float32Array(maxLag+1);
    for(let lag=minLag;lag<=maxLag;lag++){
      let corr=0;
      for(let i=0;i<buf.length-lag;i++)corr+=buf[i]*buf[i+lag];
      corr/=buf.length-lag; correlations[lag]=corr;
      if(corr>0.01 && corr>prev){found=true;} 
      if(found && corr<prev){const candidate=lag-1;if(correlations[candidate]>bestCorr){bestCorr=correlations[candidate];bestOffset=candidate;}found=false;}
      prev=corr;
    }
    if(bestOffset<0||bestCorr<0.01)return null;
    // Parabolic interpolation around the correlation peak.
    const y1=correlations[bestOffset-1]||0,y2=correlations[bestOffset],y3=correlations[bestOffset+1]||0;
    const denom=y1-2*y2+y3;
    const shift=denom?0.5*(y1-y3)/denom:0;
    const lag=bestOffset+shift;
    const freq=sampleRate/lag;
    return freq>=45&&freq<=1000?{freq,confidence:Math.min(1,bestCorr/(rms*rms+1e-9))}:null;
  }
  function pickTarget(midi){
    if(state.mode==="chromatic")return Math.round(midi);
    const ts=targets();let best=ts[0],dist=Infinity;
    for(const t of ts){const d=Math.abs(t.midi-midi);if(d<dist){dist=d;best=t;}}
    return best.midi;
  }
  function showPitch(freq){
    const rawMidi=freqMidi(freq);const rounded=Math.round(rawMidi);const cents=(rawMidi-rounded)*100;
    const note=noteNames[(rounded%12+12)%12],oct=Math.floor(rounded/12)-1;
    const targetMidi=pickTarget(rawMidi),targetFreq=midiFreq(targetMidi);
    const targetCents=1200*Math.log2(freq/targetFreq);
    const displayedCents=Math.max(-50,Math.min(50,targetCents));
    $("note").textContent=note+oct;
    $("noteDetail").textContent=Math.abs(targetCents)<=2?"В строе":targetCents<0?"Ниже целевой ноты":"Выше целевой ноты";
    $("frequency").innerHTML=`${fmt(freq,2)} <small>Hz</small>`;
    $("cents").innerHTML=`${targetCents>0?"+":""}${fmt(targetCents,1)} <small>cents</small>`;
    $("needle").style.left=`${50+displayedCents}%`;
    $("needle").style.background=Math.abs(targetCents)<=2?"#c5d7bd":"#d5d9d1";
    const tn=noteNames[(targetMidi%12+12)%12],to=Math.floor(targetMidi/12)-1;
    $("target").textContent=`${tn}${to} · ${fmt(targetFreq,2)} Hz`;
    $("tuningAdvice").textContent=Math.abs(targetCents)<=2?"НАСТРОЕНО":targetCents<0?"НАТЯНУТЬ":"ОСЛАБИТЬ";
    $("signalLabel").textContent="СИГНАЛ ОБНАРУЖЕН";
  }
  function loop(){
    if(!state.running)return;
    const buf=new Float32Array(state.analyser.fftSize);state.analyser.getFloatTimeDomainData(buf);
    const result=autoCorrelate(buf,state.ctx.sampleRate);
    if(result){
      state.history.push(result.freq);if(state.history.length>5)state.history.shift();
      const sorted=[...state.history].sort((a,b)=>a-b),freq=sorted[Math.floor(sorted.length/2)];
      state.lastFreq=freq;showPitch(freq);
    }else{
      $("signalLabel").textContent="ОЖИДАНИЕ НОТЫ";
    }
    state.raf=requestAnimationFrame(loop);
  }
  async function start(){
    if(!navigator.mediaDevices?.getUserMedia){setHint("Браузер не поддерживает микрофон. Откройте сайт через HTTPS или localhost.");return;}
    try{
      $("micButton").disabled=true;setHint("Запрашиваем доступ к микрофону…");
      state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
      state.ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(state.ctx.state==="suspended")await state.ctx.resume();
      state.source=state.ctx.createMediaStreamSource(state.stream);state.analyser=state.ctx.createAnalyser();
      state.analyser.fftSize=8192;state.analyser.smoothingTimeConstant=0;
      state.source.connect(state.analyser);state.running=true;state.history=[];
      $("stopButton").disabled=false;$("micButton").textContent="Микрофон включён";
      setStatus(true,"МИКРОФОН АКТИВЕН");setHint("Сыграйте одну открытую струну и дайте ноте прозвучать.");
      loop();
    }catch(err){
      $("micButton").disabled=false;setStatus(false,"НЕТ ДОСТУПА");
      setHint(err.name==="NotAllowedError"?"Доступ к микрофону запрещён. Разрешите его в настройках браузера.":"Не удалось запустить микрофон. Проверьте подключение и разрешения.");
    }
  }
  async function stop(){
    state.running=false;cancelAnimationFrame(state.raf);
    if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
    if(state.ctx)await state.ctx.close();
    state.ctx=state.stream=state.source=state.analyser=null;state.history=[];
    $("micButton").disabled=false;$("micButton").innerHTML='<span class="mic-icon">◉</span> Включить микрофон';$("stopButton").disabled=true;
    setStatus(false,"ГОТОВ");$("signalLabel").textContent="ОЖИДАНИЕ МИКРОФОНА";setHint("Микрофон выключен.");$("note").textContent="—";$("noteDetail").textContent="Сыграйте одну струну";$("frequency").innerHTML='— <small>Hz</small>';$("cents").innerHTML='— <small>cents</small>';$("needle").style.left="50%";$("tuningAdvice").textContent="—";
    updateTarget();
  }
  $("mode").addEventListener("change",e=>{state.mode=e.target.value;state.selected=0;renderStrings();updateTarget();});
  $("calibration").addEventListener("input",e=>{state.cal=Number(e.target.value);$("calValue").textContent=state.cal+" Hz";renderStrings();updateTarget();});
  $("micButton").addEventListener("click",start);$("stopButton").addEventListener("click",stop);
  buildTicks();renderStrings();updateTarget();
})();