const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const translations = {
 ru:{tuner:"Тюнер",metronome:"Метроном",settings:"Настройки",chromatic:"ХРОМАТИЧЕСКИЙ ТЮНЕР",ready:"ГОТОВ",playString:"Сыграйте открытую струну",startMic:"Начать настройку",stopMic:"Остановить микрофон",calibrate:"Калибровка",referencePitch:"Эталонная частота",guitarStrings:"Струны гитары",standard:"Стандартный строй",tempo:"ТЕМП",precise:"ТОЧНЫЙ РИТМ",beatsMinute:"ударов в минуту",timeSignature:"Размер",accent:"Акцент",tempoPresets:"Быстрый темп",slow:"Медленно",moderate:"Умеренно",allegro:"Аллегро",fast:"Быстро",volume:"Громкость",general:"Общие",language:"Язык",notation:"Обозначение нот",theme:"Тема",precision:"Точность",displayStyle:"Стиль отображения",calibration:"Калибровка",sound:"Звук",about:"О приложении",latin:"Латиница",solfege:"Сольфеджио",dark:"Тёмная",light:"Светлая",system:"Системная",classic:"Классический",play:"Запустить метроном",stop:"Остановить метроном",waiting:"Ожидание сигнала…",almost:"Почти идеально",perfect:"Идеально настроено",microphoneError:"Не удалось получить доступ к микрофону",permission:"Разрешите доступ к микрофону в настройках браузера.",noSignal:"Сигнал не обнаружен",calibrationTitle:"Калибровка",languageTitle:"Язык",notationTitle:"Обозначение нот",referenceTitle:"Эталон A4",themeTitle:"Тема",precisionTitle:"Точность",displayTitle:"Стиль отображения",soundTitle:"Звук метронома",pointer:"Стрелка",pointerAndNotes:"Стрелка + ноты",strobe:"Стробоскоп",cent:"cent",cents:"cents",guitar:"Гитара",stringLegend:"Зелёный — струна настроена",calibrationApplied:"Калибровка применена",systemTheme:"Как в системе"},
 en:{tuner:"Tuner",metronome:"Metronome",settings:"Settings",chromatic:"CHROMATIC TUNER",ready:"READY",playString:"Play an open string",startMic:"Start tuning",stopMic:"Stop microphone",calibrate:"Calibration",referencePitch:"Reference pitch",guitarStrings:"Guitar strings",standard:"Standard tuning",tempo:"TEMPO",precise:"PRECISION RHYTHM",beatsMinute:"beats per minute",timeSignature:"Time signature",accent:"Accent",tempoPresets:"Quick tempo",slow:"Slow",moderate:"Moderate",allegro:"Allegro",fast:"Fast",volume:"Volume",general:"General",language:"Language",notation:"Note notation",theme:"Theme",precision:"Precision",displayStyle:"Display style",calibration:"Calibration",sound:"Sound",about:"About",latin:"Latin",solfege:"Solfege",dark:"Dark",light:"Light",system:"System",classic:"Classic",play:"Start metronome",stop:"Stop metronome",waiting:"Waiting for signal…",almost:"Almost perfect",perfect:"In tune",microphoneError:"Microphone access failed",permission:"Allow microphone access in your browser settings.",noSignal:"No signal detected",calibrationTitle:"Calibration",languageTitle:"Language",notationTitle:"Note notation",referenceTitle:"A4 reference",themeTitle:"Theme",precisionTitle:"Precision",displayTitle:"Display style",soundTitle:"Metronome sound",pointer:"Needle",pointerAndNotes:"Needle + notes",strobe:"Strobe",cent:"cent",cents:"cents",guitar:"Guitar",stringLegend:"Green means tuned",calibrationApplied:"Calibration applied",systemTheme:"System default"}
};
let lang=localStorage.getItem("tm-lang")||"ru", notation=localStorage.getItem("tm-notation")||"latin", refA=Number(localStorage.getItem("tm-ref")||440), theme=localStorage.getItem("tm-theme")||"dark", precision=Number(localStorage.getItem("tm-precision")||1), displayStyle=localStorage.getItem("tm-display")||"pointer", calibration=Number(localStorage.getItem("tm-calibration")||0), sound=localStorage.getItem("tm-sound")||"classic", volume=Number(localStorage.getItem("tm-volume")||70);
let audioContext=null, analyser=null, micStream=null, micRunning=false, pitchLoop=null, lastInTune=false;
const tunedStrings = new Set();
const guitarStringFreqs = {"E2":82.4069,"A2":110.0000,"D3":146.8324,"G3":195.9977,"B3":246.9417,"E4":329.6276};
const guitarStringMidi = {"E2":40,"A2":45,"D3":50,"G3":55,"B3":59,"E4":64};
let bpm=120, beatsPerMeasure=4, currentBeat=0, metroTimer=null, isPlaying=false, metroAudioCtx=null, nextNoteTime=0;
const noteStrings=["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"], solfege=["До","До♯","Ре","Ре♯","Ми","Фа","Фа♯","Соль","Соль♯","Ля","Ля♯","Си"];
const standardStrings={"E2":"6","A2":"5","D3":"4","G3":"3","B3":"2","E4":"1"};
function t(k){return (translations[lang]||translations.ru)[k]||k}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2300)}
function applyLanguage(){document.documentElement.lang=lang;const legend=document.querySelector(".string-legend");if(legend)legend.lastChild.textContent=" "+t("stringLegend");$$("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;if(t(k))el.textContent=t(k)});$("#language-value").textContent=lang==="ru"?"Русский":"English";$("#notation-value").textContent=notation==="latin"?t("latin"):t("solfege");$("#reference-label").textContent=refA+" Hz";$("#setting-ref-value").textContent=refA+" Hz";$("#theme-value").textContent=theme==="dark"?t("dark"):theme==="light"?t("light"):t("system");$("#precision-value").textContent=precision+" "+t("cent");$("#display-value").textContent=displayStyle==="pointer"?t("pointer"):displayStyle==="both"?t("pointerAndNotes"):t("strobe");$("#calibration-value").textContent=(calibration>0?"+":"")+calibration+" "+t("cent");$("#sound-value").textContent=sound==="classic"?t("classic"):"Woodblock";$("#start-btn").querySelector("span").textContent=micRunning?t("stopMic"):t("startMic");$("#metro-start-btn").setAttribute("aria-label",isPlaying?t("stop"):t("play"));$("#tempo-name").textContent=bpm<75?t("slow"):bpm<110?t("moderate"):bpm<145?t("allegro"):t("fast")}
function applyTheme(){document.body.classList.toggle("light",theme==="light"||(theme==="system"&&matchMedia("(prefers-color-scheme: light)").matches))}
function renderGauge(){const g=$("#gauge-ticks");g.innerHTML="";for(let i=0;i<=40;i++){let a=(-Math.PI)+(Math.PI*i/40),r1=124,r2=i%5===0?110:117,x1=160+Math.cos(a)*r1,y1=146+Math.sin(a)*r1,x2=160+Math.cos(a)*r2,y2=146+Math.sin(a)*r2;let line=document.createElementNS("http://www.w3.org/2000/svg","line");line.setAttribute("x1",x1);line.setAttribute("y1",y1);line.setAttribute("x2",x2);line.setAttribute("y2",y2);line.setAttribute("class","gauge-tick"+(i===20?" center":i%5===0?" major":""));g.appendChild(line)}}
function setScreen(name){$$(".screen").forEach(s=>s.classList.toggle("active",s.id==="screen-"+name));$$(".segment").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));$$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.screen===name));$("#subview").classList.remove("visible");}
$$("[data-screen]").forEach(b=>b.addEventListener("click",()=>setScreen(b.dataset.screen)));
$("#settings-open").onclick=()=>setScreen("settings");$("#settings-back").onclick=()=>setScreen("tuner");
function noteFromPitch(f){return Math.round(12*Math.log2(f/refA)+69)}
function frequencyFromNoteNumber(n){return refA*Math.pow(2,(n-69)/12)}
function autoCorrelate(buf,sampleRate){const size=buf.length;let rms=0;for(let i=0;i<size;i++)rms+=buf[i]*buf[i];if(Math.sqrt(rms/size)<.012)return -1;let r1=0,r2=size-1,threshold=.2;for(let i=0;i<size/2;i++){if(Math.abs(buf[i])<threshold){r1=i;break}}for(let i=1;i<size/2;i++){if(Math.abs(buf[size-i])<threshold){r2=size-i;break}}buf=buf.slice(r1,r2);const n=buf.length,c=new Float32Array(n);for(let i=0;i<n;i++){let sum=0;for(let j=0;j<n-i;j++)sum+=buf[j]*buf[j+i];c[i]=sum}let d=0;while(d+1<n&&c[d]>c[d+1])d++;let max=-1,pos=-1;for(let i=d;i<n;i++){if(c[i]>max){max=c[i];pos=i}}if(pos<=0||pos>=n-1)return -1;const x1=c[pos-1],x2=c[pos],x3=c[pos+1],a=(x1+x3-2*x2)/2,b=(x3-x1)/2,T=a?pos-b/(2*a):pos;return T>0?sampleRate/T:-1}
function closestGuitarString(freq){
 let best=null,bestCents=Infinity;
 for(const [name,target] of Object.entries(guitarStringFreqs)){
  const cents=1200*Math.log2(freq/target);
  if(Math.abs(cents)<Math.abs(bestCents)){best=name;bestCents=cents}
 }
 return Math.abs(bestCents)<=250?{name:best,cents:Math.round(bestCents)}:null;
}
function updateStringIndicators(activeName=null){
 $$("[data-string]").forEach(el=>{
  const name=el.dataset.string;
  el.classList.toggle("tuned",tunedStrings.has(name));
  el.classList.toggle("selected",name===activeName);
  el.setAttribute("aria-pressed",name===activeName?"true":"false");
 });
}
function updatePitch(){
 if(!micRunning||!analyser)return;
 const buffer=new Float32Array(analyser.fftSize);
 analyser.getFloatTimeDomainData(buffer);
 const raw=autoCorrelate(buffer,audioContext.sampleRate);
 if(raw>35&&raw<450){
  const pitch=raw*Math.pow(2,calibration/1200);
  const guitar=closestGuitarString(pitch);
  let displayNote, targetFreq, cents;
  if(guitar){
   displayNote=guitar.name;
   targetFreq=guitarStringFreqs[guitar.name];
   cents=Math.round(1200*Math.log2(pitch/targetFreq));
   if(Math.abs(cents)<=precision)tunedStrings.add(guitar.name);
   updateStringIndicators(guitar.name);
  }else{
   const n=noteFromPitch(pitch),idx=((n%12)+12)%12,oct=Math.floor(n/12)-1;
   displayNote=(notation==="latin"?noteStrings[idx]:solfege[idx])+oct;
   targetFreq=frequencyFromNoteNumber(n);
   cents=Math.round(1200*Math.log2(pitch/targetFreq));
   updateStringIndicators(null);
  }
  $("#note").textContent=displayNote;
  $("#frequency").textContent=pitch.toFixed(1)+" Hz";
  $("#cents-badge").textContent=(cents>0?"+":"")+cents+" "+t("cents");
  $("#needle").style.transform=`rotate(${Math.max(-48,Math.min(48,cents*.9))}deg)`;
  const inTune=Math.abs(cents)<=precision;
  $("#tuning-status").innerHTML=`<span class="status-dot" style="background:${inTune?"var(--green)":"var(--accent)"}"></span><span>${inTune?t("perfect"):Math.abs(cents)<=5?t("almost"):(cents<0?"↓ ":"↑ ")+(Math.abs(cents)+" "+t("cents"))}</span>`;
  $("#note").style.color=inTune?"var(--green)":"var(--text)";
  if(inTune&&!lastInTune)playSuccessChime();
  lastInTune=inTune;
 }else{
  $("#tuning-status").innerHTML=`<span class="status-dot"></span><span>${t("noSignal")}</span>`;
  updateStringIndicators(null);
  lastInTune=false;
 }
 pitchLoop=setTimeout(updatePitch,35);
}
function playSuccessChime(){try{const c=audioContext||new(window.AudioContext||window.webkitAudioContext)();const o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.setValueAtTime(523.25,c.currentTime);o.frequency.setValueAtTime(659.25,c.currentTime+.08);g.gain.setValueAtTime(.1,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.28);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.29)}catch(e){}}
$("#start-btn").addEventListener("click",async()=>{if(micRunning){stopMic();return}try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});analyser=audioContext.createAnalyser();analyser.fftSize=4096;audioContext.createMediaStreamSource(micStream).connect(analyser);micRunning=true;$("#start-btn").classList.add("is-active");applyLanguage();$(".live-dot span").textContent="LIVE";updatePitch()}catch(e){toast(t("microphoneError"));if(e.name==="NotAllowedError")setTimeout(()=>toast(t("permission")),500)}});
function stopMic(){micRunning=false;clearTimeout(pitchLoop);if(micStream)micStream.getTracks().forEach(x=>x.stop());micStream=null;analyser=null;$("#start-btn").classList.remove("is-active");$(".live-dot span").textContent=t("ready");applyLanguage()}
$("#calibration-shortcut").onclick=()=>openSetting("calibration");
$$("[data-ref]").forEach(b=>b.addEventListener("click",()=>setReference(Number(b.dataset.ref))));
function setReference(v){refA=v;localStorage.setItem("tm-ref",v);$$("[data-ref]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.ref)===v));applyLanguage();toast("A4 = "+v+" Hz")}
$$("[data-string]").forEach(b=>b.addEventListener("click",()=>{const key=b.dataset.string;updateStringIndicators(key);$("#note").textContent=key;$("#frequency").textContent=guitarStringFreqs[key].toFixed(1)+" Hz";$("#tuning-status").innerHTML=`<span class="status-dot"></span><span>${t("guitar")}: ${key} · ${standardStrings[key]}</span>`;}));
function createDots(){const box=$("#dots-container");box.innerHTML="";for(let i=0;i<beatsPerMeasure;i++){const d=document.createElement("i");d.className="dot";box.appendChild(d)}}
function updateBpm(v){bpm=Math.max(30,Math.min(250,Number(v)));$("#bpm-val").textContent=bpm;$("#bpm-slider").value=bpm;$("#tempo-ring-progress").style.strokeDashoffset=String(490-((bpm-30)/220)*360);$$("[data-bpm]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.bpm)===bpm));applyLanguage()}
$("#bpm-slider").addEventListener("input",e=>updateBpm(e.target.value));$("#bpm-minus").onclick=()=>updateBpm(bpm-1);$("#bpm-plus").onclick=()=>updateBpm(bpm+1);$$("[data-bpm]").forEach(b=>b.onclick=()=>updateBpm(b.dataset.bpm));$("#time-signature").onchange=e=>{beatsPerMeasure=Number(e.target.value);currentBeat=0;createDots();if(isPlaying){currentBeat=0}};
function playClick(isAccent, when=0){
 try{
  metroAudioCtx=metroAudioCtx||new(window.AudioContext||window.webkitAudioContext)();
  if(metroAudioCtx.state==="suspended")metroAudioCtx.resume();
  const time=when||metroAudioCtx.currentTime;
  const o=metroAudioCtx.createOscillator(),g=metroAudioCtx.createGain();
  o.type=sound==="classic"?"sine":"triangle";
  o.frequency.setValueAtTime(isAccent?1320:850,time);
  const peak=(volume/100)*(isAccent?.18:.11);
  g.gain.setValueAtTime(Math.max(.0001,peak),time);
  g.gain.exponentialRampToValueAtTime(.0001,time+.055);
  o.connect(g);g.connect(metroAudioCtx.destination);o.start(time);o.stop(time+.06);
 }catch(e){}
}
function scheduleBeat(when){
 const accent=Number($("#accent-select").value);
 const isAccent=currentBeat===0||(accent!==0&&currentBeat===accent-1);
 playClick(isAccent,when);
 const beatIndex=currentBeat;
 setTimeout(()=>{
  if(!isPlaying)return;
  const dots=$$("#dots-container .dot");
  dots.forEach(d=>d.classList.remove("active","accent"));
  if(dots[beatIndex]){dots[beatIndex].classList.add("active");if(isAccent)dots[beatIndex].classList.add("accent")}
 },Math.max(0,(when-(metroAudioCtx?.currentTime||0))*1000));
 currentBeat=(currentBeat+1)%beatsPerMeasure;
}
function scheduler(){
 if(!isPlaying)return;
 while(nextNoteTime<metroAudioCtx.currentTime+.12){
  scheduleBeat(nextNoteTime);
  nextNoteTime+=60/bpm;
 }
 metroTimer=setTimeout(scheduler,25);
}
function startMetronome(){
 if(isPlaying)return;
 isPlaying=true;currentBeat=0;
 metroAudioCtx=metroAudioCtx||new(window.AudioContext||window.webkitAudioContext)();
 metroAudioCtx.resume();
 nextNoteTime=metroAudioCtx.currentTime+.05;
 $("#metro-start-btn").classList.add("playing");
 $("#play-icon").innerHTML='<path d="M7 5h4v14H7zM14 5h4v14h-4z"/>';
 applyLanguage();scheduler();
}
function stopMetronome(){
 isPlaying=false;clearTimeout(metroTimer);
 $("#metro-start-btn").classList.remove("playing");
 $("#play-icon").innerHTML='<path d="m8 5 12 7-12 7Z"/>';
 $$(".dot").forEach(d=>d.classList.remove("active","accent"));
 applyLanguage();
}
$("#metro-start-btn").onclick=()=>isPlaying?stopMetronome():startMetronome();
$("#volume-slider").value=volume;$("#settings-volume").value=volume;function setVolume(v){volume=Number(v);localStorage.setItem("tm-volume",volume);$("#volume-slider").value=volume;$("#settings-volume").value=volume;$("#volume-value").textContent=volume+"%";$("#settings-volume-value").textContent=volume+"%"}$("#volume-slider").oninput=e=>setVolume(e.target.value);$("#settings-volume").oninput=e=>setVolume(e.target.value);
const settingDefs={
 language:{title:"languageTitle",key:"lang",choices:[["ru","Русский","Russian"],["en","English","English"]]},
 notation:{title:"notationTitle",key:"notation",choices:[["latin","Латиница · A, B, C…","A, B, C, D, E, F, G"],["solfege","Сольфеджио · До, Ре, Ми…","Do, Re, Mi, Fa, Sol, La, Si"]]},
 reference:{title:"referenceTitle",key:"ref",choices:[["438","438 Hz"],["440","440 Hz"],["442","442 Hz"],["445","445 Hz"]]},
 theme:{title:"themeTitle",key:"theme",choices:[["dark","Тёмная","Dark"],["light","Светлая","Light"],["system","Системная","System default"]]},
 precision:{title:"precisionTitle",key:"precision",choices:[["1","±1 cent"],["2","±2 cents"],["3","±3 cents"],["5","±5 cents"]]},
 display:{title:"displayTitle",key:"display",choices:[["pointer","Стрелка","Needle"],["both","Стрелка + ноты","Needle + notes"],["strobe","Стробоскоп","Strobe"]]},
 calibration:{title:"calibrationTitle",key:"calibration",choices:[["-10","−10 cents"],["-5","−5 cents"],["0","0 cents"],["5","+5 cents"],["10","+10 cents"]]},
 sound:{title:"soundTitle",key:"sound",choices:[["classic","Классический","Classic"],["woodblock","Деревянный блок","Woodblock"]]}
};
function settingValue(key){return ({lang,notation,ref:refA,theme,precision,display:displayStyle,calibration,sound})[key]}
function applySetting(key,val){if(key==="language"){lang=val;localStorage.setItem("tm-lang",val)}if(key==="notation"){notation=val;localStorage.setItem("tm-notation",val)}if(key==="ref")setReference(Number(val));if(key==="theme"){theme=val;localStorage.setItem("tm-theme",val);applyTheme()}if(key==="precision"){precision=Number(val);localStorage.setItem("tm-precision",val)}if(key==="display"){displayStyle=val;localStorage.setItem("tm-display",val);$("#gauge").style.opacity=val==="strobe"?".55":"1"}if(key==="calibration"){calibration=Number(val);localStorage.setItem("tm-calibration",val)}if(key==="sound"){sound=val;localStorage.setItem("tm-sound",val)}applyLanguage()}
function openSetting(key){const def=settingDefs[key];if(!def)return;$("#subview-title").textContent=t(def.title);const holder=$("#subview-options");holder.innerHTML="";def.choices.forEach(([val,label,en])=>{const value=key==="ref"?String(refA):String(settingValue(key));const row=document.createElement("button");row.className="choice-row"+(value===val?" selected":"");let shown=lang==="en"?(en||label):label;row.innerHTML=`<span class="choice-copy">${shown}</span><span class="radio"></span>`;row.onclick=()=>{applySetting(key,val);openSetting(key);if(key==="language"){$("#subview-title").textContent=t(def.title);toast(lang==="ru"?"Язык изменён":"Language changed")}else if(key==="calibration")toast(t("calibrationApplied"));};holder.appendChild(row)});$("#subview").classList.add("visible")}
$$("[data-setting]").forEach(b=>b.addEventListener("click",()=>openSetting(b.dataset.setting)));
$("#subview-back").onclick=()=>$("#subview").classList.remove("visible");
function init(){renderGauge();createDots();applyTheme();applyLanguage();setVolume(volume);setReference(refA);updateBpm(bpm);if("serviceWorker"in navigator){}}
init();
