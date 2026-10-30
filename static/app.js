(() => {
  const $ = (id) => document.getElementById(id);
  const form=$("route-form"),fromInput=$("from"),toInput=$("to"),result=$("result"),submitBtn=$("submit-btn");
  const colors={1:"#e0001f",2:"#2f4389",3:"#67c5f5",4:"#f2df00",5:"#07884d",6:"#ef639f",7:"#7f0b74"};
  const lineNames={1:"خط ۱",2:"خط ۲",3:"خط ۳",4:"خط ۴",5:"خط ۵",6:"خط ۶",7:"خط ۷"};
  let routes={fastest:null,shortest:null},active="fastest";
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const lineName=n=>lineNames[n]||("خط "+n);
  const formatMinutes=value=>{const n=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(n/60),m=n%60;return h?(m?h+" ساعت و "+m+" دقیقه":h+" ساعت"):m+" دقیقه";};
  async function request(url){const response=await fetch(url);const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"خطا در دریافت اطلاعات");return data;}
  function setLoading(loading){submitBtn.disabled=loading;submitBtn.innerHTML=loading?'<span>در حال محاسبه مسیر</span><i class="loading"></i>':'<span>پیدا کردن مسیر</span><span class="button-arrow">←</span>';}
  function error(message){result.innerHTML='<div class="error">'+esc(message)+'</div>';}
  function setupAutocomplete(input,list){
    let timer;let values=[];
    const close=()=>{list.classList.remove("open");list.innerHTML="";};
    input.addEventListener("input",()=>{clearTimeout(timer);const q=input.value.trim();if(q.length<2){close();return;}
      timer=setTimeout(async()=>{try{const data=await request("/api/stations/search?query="+encodeURIComponent(q));values=data.stations||[];list.innerHTML=values.length?values.map((name,i)=>'<div data-index="'+i+'">'+esc(name)+'</div>').join(""):'<div>ایستگاهی پیدا نشد</div>';list.classList.add("open");list.querySelectorAll("[data-index]").forEach(item=>item.addEventListener("mousedown",e=>{e.preventDefault();input.value=values[Number(item.dataset.index)];close();}));}catch{close();}},180);
    });
    input.addEventListener("blur",()=>setTimeout(close,120));
  }
  setupAutocomplete(fromInput,$("from-list"));setupAutocomplete(toInput,$("to-list"));
  $("swap-btn").addEventListener("click",()=>{const old=fromInput.value;fromInput.value=toInput.value;toInput.value=old;});
  function getSegmentLines(routeDetails,segments){
    if(segments?.length){return segments.map(s=>Number(s.line));}
    const lines=[];
    for(let i=0;i<routeDetails.length-1;i++){
      const a=routeDetails[i]?.lines||[],b=routeDetails[i+1]?.lines||[];
      const shared=a.filter(line=>b.includes(line));
      lines.push(shared.length?Number(shared[0]):null);
    }
    return lines;
  }
  function routeTransfers(data,segmentLines){
    if(Array.isArray(data.transfers)&&data.transfers.length)return data.transfers;
    const details=data.route_details||[],found=[];
    for(let i=1;i<segmentLines.length;i++){
      if(segmentLines[i]&&segmentLines[i-1]&&segmentLines[i]!==segmentLines[i-1]){
        found.push({station:details[i]?.name,from_line:segmentLines[i-1],to_line:segmentLines[i],transfer_minutes:0,waiting_minutes:0});
      }
    }
    return found;
  }
  function render(data,mode){
    const route=data.route||[],details=data.route_details||[];
    if(!route.length){error("مسیر معتبری پیدا نشد.");return;}
    const segmentLines=getSegmentLines(details,data.segments),transfers=routeTransfers(data,segmentLines);
    const transferMap=new Map(transfers.map(t=>[t.station,t]));
    const lines=[...new Set(segmentLines.filter(Boolean))];
    const time=data.estimated_time||{};
    const totalStops=data.stops??Math.max(0,route.length-1);
    const transferCount=transfers.length;
    const totalTime=mode==="fastest"&&time.total_minutes!=null?formatMinutes(time.total_minutes):"—";
    let html='<div class="route-switch"><button type="button" data-mode="fastest" class="'+(mode==="fastest"?"active":"")+'">سریع‌ترین مسیر</button><button type="button" data-mode="shortest" class="'+(mode==="shortest"?"active":"")+'">کوتاه‌ترین مسیر</button></div>';
    html+='<div class="route-summary"><div class="summary-card"><span class="summary-value">'+esc(totalTime)+'</span><span class="summary-label">زمان تخمینی سفر</span></div><div class="summary-card"><span class="summary-value">'+totalStops+'</span><span class="summary-label">تعداد توقف</span></div><div class="summary-card"><span class="summary-value">'+transferCount+'</span><span class="summary-label">تعویض خط</span></div></div>';
    if(mode==="fastest"){
      html+='<div class="time-breakdown"><span>حرکت: <b>'+formatMinutes(time.travel_minutes)+'</b></span><span>انتظار: <b>'+formatMinutes(time.waiting_minutes)+'</b></span><span>تعویض خط: <b>'+formatMinutes(time.transfer_minutes)+'</b></span></div>';
      if(data.arrival_time)html+='<p class="estimate-note">ساعت حرکت '+esc(data.departure_time||"")+' · زمان رسیدن تخمینی '+esc(data.arrival_time)+'</p>';
    }
    html+='<h2 class="route-title">مراحل سفر</h2><ol class="route-list">';
    route.forEach((station,index)=>{
      const isStart=index===0,isEnd=index===route.length-1,transfer=transferMap.get(station);
      const lineBefore=segmentLines[index-1],lineAfter=segmentLines[index];
      const displayLine=isStart?lineAfter:isEnd?lineBefore:(transfer?.to_line||lineAfter||lineBefore);
      const caption=isStart?"مبدأ":isEnd?"مقصد":transfer?"ایستگاه تعویض خط":"";
      html+='<li class="route-item '+((isStart||isEnd)?"endpoint ":"")+(transfer?"transfer":"")+'"><span class="station-marker" style="--station-color:'+(colors[displayLine]||"#a8b2c8")+'"></span><span class="station-name">'+esc(station)+'</span><span class="station-meta">'+(displayLine?'<span class="line-pill" style="--line-color:'+colors[displayLine]+'">'+lineName(displayLine)+'</span>':"")+'<span class="station-caption">'+caption+'</span></span></li>';
      if(transfer){html+='<li class="transfer-note"><span>تعویض خط در '+esc(station)+':</span><strong>'+lineName(transfer.from_line)+' <span class="transfer-arrow">←</span> '+lineName(transfer.to_line)+'</strong></li>';}
    });
    html+='</ol><div class="route-legend">'+lines.map(line=>'<span class="legend-item"><i class="legend-swatch" style="background:'+colors[line]+'"></i>'+lineName(line)+'</span>').join("")+'</div>';
    if(mode==="fastest"&&Array.isArray(data.warnings)&&data.warnings.length)html+='<div class="warning-note">'+data.warnings.map(esc).join(" ")+'</div>';
    html+='<p class="estimate-note">زمان‌ها تخمینی هستند و بر اساس زمان‌بندی زنده قطارها محاسبه نمی‌شوند.</p>';
    result.innerHTML=html;
    result.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{active=button.dataset.mode;render(routes[active],active);}));
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();const from=fromInput.value.trim(),to=toInput.value.trim();
    if(!from||!to){error("لطفاً مبدأ و مقصد را انتخاب کن.");return;}
    if(from===to){error("مبدأ و مقصد نمی‌توانند یکسان باشند.");return;}
    setLoading(true);
    try{
      const params=new URLSearchParams({from_station:from,to_station:to,departure_time:$("departure-time").value||"12:00",day_type:$("day-type").value});
      const [fastest,shortest]=await Promise.all([
        request("/api/route/fastest?"+params),
        request("/api/route/details?"+new URLSearchParams({from_station:from,to_station:to}))
      ]);
      routes={fastest,shortest};active="fastest";render(fastest,active);
      result.scrollIntoView({behavior:"smooth",block:"nearest"});
    }catch(err){error(err.message||"در دریافت مسیر خطایی رخ داد.");}
    finally{setLoading(false);}
  });
})();