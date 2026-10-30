(() => {
  const $=s=>document.querySelector(s);
  const form=$("#route-form"),fromInput=$("#from"),toInput=$("#to"),results=$("#results-section"),resultsContent=$("#results-content"),errorBox=$("#error-message"),searchButton=$("#search-button");
  const colors={1:"#e0001f",2:"#2f4389",3:"#20a9df",4:"#f2ca00",5:"#07884d",6:"#ed659f",7:"#81429a"};
  const names={1:"خط ۱",2:"خط ۲",3:"خط ۳",4:"خط ۴",5:"خط ۵",6:"خط ۶",7:"خط ۷"};
  const state={stations:[],byName:new Map(),fastest:null,shortest:null,active:"fastest",zoom:1,selectedField:"from"};
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const lineName=n=>names[n]||("خط "+n);
  const mins=v=>{let n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?(m?h+" ساعت و "+m+" دقیقه":h+" ساعت"):m+" دقیقه";};
  async function getJSON(url){const r=await fetch(url);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.detail||"خطا در دریافت اطلاعات");return d;}
  function loading(on){searchButton.disabled=on;searchButton.innerHTML=on?'<span>در حال محاسبه</span><i class="loading-ring"></i>':'<span>پیدا کردن مسیر</span><b>←</b>';}
  function showError(msg){errorBox.textContent=msg;errorBox.hidden=false;resultsContent.hidden=true;results.hidden=false;}
  function renderLegend(target,lines){target.innerHTML=lines.map(n=>'<div class="legend-item"><i class="line-swatch" style="background:'+colors[n]+'"></i>'+lineName(n)+'</div>').join("");}
  function coords(){const valid=state.stations.filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y));const xs=valid.map(s=>s.x),ys=valid.map(s=>s.y);return {valid,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};}
  // اتصال فقط با خط مشترک دو ایستگاه رسم می‌شود؛ رنگ خط نامرتبط حدس زده نمی‌شود.
  function edgeLines(a,b){return [...new Set((a.lines||[]).filter(n=>(b.lines||[]).includes(n)))];}
  function renderMap(route=[]){
    const {valid,minX,maxX,minY,maxY}=coords();if(!valid.length)return;
    const W=1400,H=1000,pad=75,dx=maxX-minX||1,dy=maxY-minY||1;
    const scale=Math.min((W-2*pad)/dx,(H-2*pad)/dy);
    const offsetX=(W-dx*scale)/2,offsetY=(H-dy*scale)/2;
    const pos=s=>({x:offsetX+(s.x-minX)*scale,y:H-(offsetY+(s.y-minY)*scale)});
    const routeSet=new Set(route),routeEdges=new Set();for(let i=1;i<route.length;i++)routeEdges.add([route[i-1],route[i]].sort().join("|"));
    let edges="",nodes="";
    const seen=new Set();
    valid.forEach(a=>(a.relations||[]).forEach(id=>{
      const b=state.byName.get(id);if(!b)return;const key=[a.id,b.id].sort().join("|");if(seen.has(key))return;seen.add(key);
      const A=pos(a),B=pos(b),isRoute=routeEdges.has([a.name,b.name].sort().join("|"));
      const sharedLines=edgeLines(a,b);
      sharedLines.forEach((line,lineIndex)=>{
        const offset=sharedLines.length>1?(lineIndex===0?-2.5:2.5):0;
        const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1;
        const ox=(-dy/len)*offset,oy=(dx/len)*offset;
        const path='M '+(A.x+ox)+' '+(A.y+oy)+' L '+(B.x+ox)+' '+(B.y+oy);
        edges+='<path class="network-edge-under" d="'+path+'"/>';
        edges+='<path class="network-edge '+(isRoute?'route-edge':'')+'" d="'+path+'" stroke="'+colors[line]+'" stroke-width="'+(isRoute?8:5)+'" opacity="'+(route.length&&!isRoute?.14:.88)+'"/>';
      });
    }));
    valid.forEach(s=>{
      const p=pos(s),isTransfer=(s.lines||[]).length>1,isRoute=routeSet.has(s.name),isEndpoint=route.length&&(s.name===route[0]||s.name===route[route.length-1]);
      // ایستگاه تقاطعی یک نشان واحد دارد؛ چند رنگ داخل نقطه تکرار نمی‌شود.
      const transferGlyph=isTransfer?'<text class="transfer-mark" x="'+p.x+'" y="'+(p.y+2.7)+'" text-anchor="middle">↔</text>':'';
      const anchor=p.x>W*.82?"end":p.x<W*.18?"start":"middle";
      const labelY=p.y>H*.82?-14:19;
      nodes+='<g class="station-node '+(isTransfer?'transfer-node ':'')+(isRoute?'route-node ':'')+(isEndpoint?'selected':'')+'" tabindex="0" role="button" data-station="'+esc(s.fa)+'"><title>'+esc(s.fa)+' · '+(s.lines||[]).map(lineName).join("، ")+(isTransfer?' · ایستگاه تقاطعی':'')+'</title><circle class="node-core" cx="'+p.x+'" cy="'+p.y+'" r="'+(isEndpoint?9:isTransfer?9:5.8)+'"/>'+transferGlyph+'<text x="'+(p.x+(anchor==="start"?12:anchor==="end"?-12:0))+'" y="'+(p.y+labelY)+'" text-anchor="'+anchor+'">'+esc(s.fa)+'</text></g>';
    });
    const svg='<svg id="network-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="نقشه تعاملی خطوط مترو تهران">'+edges+nodes+'</svg>';
    $("#metro-map").innerHTML=svg;
    $("#network-svg").style.transform="scale("+state.zoom+")";
    $("#network-svg").style.transformOrigin="center";
    $("#network-svg").querySelectorAll(".station-node").forEach(node=>{
      const choose=()=>{const name=node.dataset.station;const field=state.selectedField==="from"?fromInput:toInput;field.value=name;state.selectedField=state.selectedField==="from"?"to":"from";document.querySelectorAll(".station-node").forEach(n=>n.classList.remove("selected"));node.classList.add("selected");$("#map-hint").textContent="ایستگاه "+name+" انتخاب شد؛ برای تعیین "+(state.selectedField==="from"?"مبدأ":"مقصد")+" ایستگاه دیگری را انتخاب کن.";};
      node.addEventListener("click",choose);node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});
    });
  }
  async function loadMap(){
    const data=await getJSON("/api/stations/map");
    state.stations=data.stations.map(s=>({...s,x:Number(s.longitude)*Math.cos(35.7*Math.PI/180),y:Number(s.latitude)})).filter(s=>Number.isFinite(s.x)&&Number.isFinite(s.y));
    state.stations.forEach(s=>{state.byName.set(s.id,s);state.byName.set(s.name,s);});
    renderMap();renderLegend($("#map-legend"),[1,2,3,4,5,6,7]);
  }
  function setupAutocomplete(input,list){
    let timer=null,active=-1,items=[];
    const close=()=>{list.classList.remove("open");list.replaceChildren();active=-1;};
    const choose=name=>{input.value=name;close();};
    input.addEventListener("input",()=>{clearTimeout(timer);const q=input.value.trim();if(q.length<2){close();return;}timer=setTimeout(async()=>{try{const d=await getJSON("/api/stations/search?query="+encodeURIComponent(q));items=d.stations||[];list.innerHTML=items.length?items.map(n=>'<div class="suggestion-item" role="option">'+esc(n)+'</div>').join(""):'<div class="suggestion-item">ایستگاهی پیدا نشد</div>';list.classList.add("open");list.querySelectorAll("[role=option]").forEach((el,i)=>el.addEventListener("mousedown",e=>{e.preventDefault();choose(items[i]);}));}catch{close();}},180);});
    input.addEventListener("focus",()=>{state.selectedField=input.id;});
    input.addEventListener("keydown",e=>{const opts=[...list.querySelectorAll("[role=option]")];if(e.key==="ArrowDown"&&opts.length){e.preventDefault();active=(active+1)%opts.length;}else if(e.key==="ArrowUp"&&opts.length){e.preventDefault();active=(active-1+opts.length)%opts.length;}else if(e.key==="Enter"&&active>=0){e.preventDefault();choose(items[active]);}else if(e.key==="Escape")close();opts.forEach((o,i)=>o.classList.toggle("active",i===active));});
    input.addEventListener("blur",()=>setTimeout(close,120));
  }
  setupAutocomplete(fromInput,$("#from-suggestions"));setupAutocomplete(toInput,$("#to-suggestions"));
  $("#swap-stations").addEventListener("click",()=>{const a=fromInput.value;fromInput.value=toInput.value;toInput.value=a;});
  $("#reset-search").addEventListener("click",()=>{form.reset();results.hidden=true;state.fastest=state.shortest=null;renderMap();});
  $("#zoom-in").addEventListener("click",()=>{state.zoom=Math.min(1.8,state.zoom+.15);$("#network-svg").style.transform="scale("+state.zoom+")";});
  $("#zoom-out").addEventListener("click",()=>{state.zoom=Math.max(.7,state.zoom-.15);$("#network-svg").style.transform="scale("+state.zoom+")";});
  $("#zoom-fit").addEventListener("click",()=>{state.zoom=1;$("#network-svg").style.transform="scale(1)";$("#map-viewport").scrollTo({top:0,left:0,behavior:"smooth"});});
  function renderOverview(data,mode){
    const t=data.estimated_time||{},stops=data.stops??Math.max(0,(data.route||[]).length-1),transfers=data.transfer_count??(data.transfers||[]).length;
    const items=[[mode==="fastest"&&t.total_minutes!=null?mins(t.total_minutes):"—",mode==="fastest"?"زمان تخمینی":"بدون تخمین زمان"],[stops+"","تعداد توقف"],[transfers+"","تعویض خط"]];
    $("#journey-overview").innerHTML=items.map(([v,l])=>'<div class="overview-item"><div class="overview-value">'+esc(v)+'</div><div class="overview-label">'+l+'</div></div>').join("")+(mode==="fastest"?'<div class="time-breakdown"><span>حرکت <b>'+mins(t.travel_minutes)+'</b></span><span>انتظار <b>'+mins(t.waiting_minutes)+'</b></span><span>تعویض خط <b>'+mins(t.transfer_minutes)+'</b></span></div>':"");
  }
  function renderTimeline(data,mode){
    const route=data.route||[],details=data.route_details||[],transfers=data.transfers||[],transferNames=new Set(transfers.map(t=>t.station));
    $("#route-timeline").innerHTML=route.map((name,i)=>{
      const info=details.find(x=>x.name===name)||{},lines=info.lines||[],isTransfer=transferNames.has(name)||(info.is_transfer&&i>0&&i<route.length-1);
      const label=i===0?"مبدأ":i===route.length-1?"مقصد":isTransfer?"ایستگاه تعویض خط":"";
      const transfer=transfers.find(t=>t.station===name);
      // در ایستگاه تقاطعی، خط‌های قابل دسترس را به‌عنوان مسیر انتخابی نمایش نمی‌دهیم.
      // خط ورود/خروج فقط در دستور تعویض خط مشخص می‌شود تا مسافر سردرگم نشود.
      const badges=isTransfer&&!transfer?'':lines.slice(0,1).map(n=>'<span class="mini-line" style="--line-color:'+colors[n]+'">'+lineName(n)+'</span>').join("");
      const transferInstruction=transfer?'<div class="transfer-row"><span>در این ایستگاه از <b>'+lineName(transfer.from_line)+'</b> به <b>'+lineName(transfer.to_line)+'</b> برو</span><b>'+mins((transfer.transfer_minutes||0)+(transfer.waiting_minutes||0))+'</b></div>':"";
      return '<div class="timeline-item"><span class="timeline-marker '+(i===0||i===route.length-1?"end":isTransfer?"transfer":"")+'" style="--station-color:'+(colors[lines[0]]||"#718096")+'"></span><div class="timeline-copy"><div><strong>'+esc(name)+'</strong><br><small>'+label+'</small></div><div class="timeline-lines">'+badges+'</div></div></div>'+transferInstruction;
    }).join("");
    const lines=[...new Set(route.flatMap(n=>(details.find(d=>d.name===n)||{}).lines||[]))].sort();
    renderLegend($("#line-legend-items"),lines);
    renderMap(route);
  }
  function renderActive(){
    const data=state[state.active];if(!data)return;
    document.querySelectorAll(".route-tab").forEach(tab=>{const active=tab.dataset.route===state.active;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",String(active));});
    renderOverview(data,state.active);renderTimeline(data,state.active);
  }
  document.querySelectorAll(".route-tab").forEach(tab=>tab.addEventListener("click",()=>{state.active=tab.dataset.route;renderActive();}));
  form.addEventListener("submit",async e=>{
    e.preventDefault();const from=fromInput.value.trim(),to=toInput.value.trim();if(!from||!to){showError("مبدأ و مقصد را انتخاب کن.");return;}if(from===to){showError("مبدأ و مقصد نمی‌توانند یکسان باشند.");return;}
    loading(true);results.hidden=false;errorBox.hidden=true;resultsContent.hidden=true;
    try{
      const p=new URLSearchParams({from_station:from,to_station:to,departure_time:$("#departure-time").value||"12:00",day_type:$("#day-type").value});
      const [fastest,shortest]=await Promise.all([getJSON("/api/route/fastest?"+p),getJSON("/api/route/details?"+new URLSearchParams({from_station:from,to_station:to}))]);
      state.fastest=fastest;state.shortest=shortest;state.active="fastest";resultsContent.hidden=false;renderActive();results.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(err){showError(err.message||"محاسبه مسیر با خطا مواجه شد.");}finally{loading(false);}
  });
  loadMap().catch(err=>{$("#metro-map").innerHTML='<div class="map-loading">'+esc(err.message||"نقشه بارگذاری نشد")+'</div>';});
})();