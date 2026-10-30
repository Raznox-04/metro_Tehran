(() => {
 const $=id=>document.getElementById(id),form=$("route-form"),fromInput=$("from"),toInput=$("to"),result=$("result"),submitBtn=$("submit-btn");
 const colors={1:"#e0001f",2:"#2f4389",3:"#67c5f5",4:"#f2df00",5:"#07884d",6:"#ef639f",7:"#7f0b74"};
 const lineNames={1:"خط ۱",2:"خط ۲",3:"خط ۳",4:"خط ۴",5:"خط ۵",6:"خط ۶",7:"خط ۷"};
 let routes={fastest:null,shortest:null},active="fastest";
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const lineName=n=>lineNames[n]||("خط "+n);
 const formatMinutes=value=>{const n=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(n/60),m=n%60;return h?(m?h+" ساعت و "+m+" دقیقه":h+" ساعت"):m+" دقیقه"};
 async function request(url){const response=await fetch(url);const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||"خطا در دریافت اطلاعات");return data}
 function setLoading(loading){submitBtn.disabled=loading;submitBtn.innerHTML=loading?'<span>در حال محاسبه مسیر</span><i class="loading"></i>':'<span>پیدا کردن مسیر</span><span class="button-arrow">←</span>'}
 function showError(message){document.body.classList.add("has-results");result.innerHTML='<div class="error">'+esc(message)+'</div>'}
 function setupAutocomplete(input,list){
  let timer,values=[];const close=()=>{list.classList.remove("open");list.innerHTML=""};
  input.addEventListener("input",()=>{clearTimeout(timer);const q=input.value.trim();if(q.length<2){close();return}
   timer=setTimeout(async()=>{try{const data=await request("/api/stations/search?query="+encodeURIComponent(q));values=data.stations||[];list.innerHTML=values.length?values.map((name,i)=>'<div data-index="'+i+'">'+esc(name)+'</div>').join(""):'<div>ایستگاهی پیدا نشد</div>';list.classList.add("open");list.querySelectorAll("[data-index]").forEach(item=>item.addEventListener("mousedown",e=>{e.preventDefault();input.value=values[Number(item.dataset.index)];close()}))}catch{close()}},160)
  });input.addEventListener("blur",()=>setTimeout(close,120))
 }
 setupAutocomplete(fromInput,$("from-list"));setupAutocomplete(toInput,$("to-list"));
 $("swap-btn").addEventListener("click",()=>{const old=fromInput.value;fromInput.value=toInput.value;toInput.value=old});
 function segmentLines(data){
  const details=data.route_details||[],segments=data.segments||[];
  if(segments.length)return segments.map(s=>Number(s.line));
  return details.slice(0,-1).map((station,i)=>{const a=station.lines||[],b=details[i+1]?.lines||[];const shared=a.filter(line=>b.includes(line));return shared.length?Number(shared[0]):null})
 }
 function findTransfers(data,lines){
  if(Array.isArray(data.transfers))return data.transfers;
  const details=data.route_details||[],found=[];
  for(let i=1;i<lines.length;i++)if(lines[i]&&lines[i-1]&&lines[i]!==lines[i-1])found.push({station:details[i]?.name,from_line:lines[i-1],to_line:lines[i]});
  return found
 }
 function render(data,mode){
  const route=data.route||[],details=data.route_details||[];if(!route.length){showError("مسیر معتبری پیدا نشد.");return}
  document.body.classList.add("has-results");
  const lines=segmentLines(data),transfers=findTransfers(data,lines),transferMap=new Map(transfers.map(t=>[t.station,t]));
  const usedLines=[...new Set(lines.filter(Boolean))],time=data.estimated_time||{},stops=data.stops??Math.max(0,route.length-1);
  const totalTime=mode==="fastest"&&time.total_minutes!=null?formatMinutes(time.total_minutes):"محاسبه نشده";
  let html='<div class="route-switch"><button type="button" data-mode="fastest" class="'+(mode==="fastest"?"active":"")+'">سریع‌ترین مسیر</button><button type="button" data-mode="shortest" class="'+(mode==="shortest"?"active":"")+'">کوتاه‌ترین مسیر</button></div>';
  html+='<div class="route-summary"><div class="summary-card"><span class="summary-value">'+esc(totalTime)+'</span><span class="summary-label">زمان تخمینی</span></div><div class="summary-card"><span class="summary-value">'+stops+'</span><span class="summary-label">توقف</span></div><div class="summary-card"><span class="summary-value">'+transfers.length+'</span><span class="summary-label">تعویض خط</span></div></div>';
  if(mode==="fastest"){html+='<div class="time-breakdown"><span>حرکت <b>'+formatMinutes(time.travel_minutes)+'</b></span><span>انتظار <b>'+formatMinutes(time.waiting_minutes)+'</b></span><span>تعویض <b>'+formatMinutes(time.transfer_minutes)+'</b></span></div>';if(data.arrival_time)html+='<p class="estimate-note">حرکت '+esc(data.departure_time||"")+' · رسیدن تخمینی '+esc(data.arrival_time)+'</p>'}
  html+='<h2 class="route-title">مراحل سفر</h2><ol class="route-list">';
  route.forEach((station,index)=>{
   const start=index===0,end=index===route.length-1,transfer=transferMap.get(station),before=lines[index-1],after=lines[index],displayLine=start?after:end?before:(transfer?.to_line||after||before),caption=start?"مبدأ":end?"مقصد":transfer?"تعویض خط":"",extra=index>=5;
   html+='<li class="route-item '+((start||end)?"endpoint ":"")+(transfer?"transfer ":"")+(extra?"route-extra":"")+'" '+(extra?'hidden':'')+'><span class="station-marker" style="--station-color:'+(colors[displayLine]||"#a8b2c8")+'"></span><span class="station-name">'+esc(station)+'</span><span class="station-meta">'+(displayLine?'<span class="line-pill" style="--line-color:'+colors[displayLine]+'">'+lineName(displayLine)+'</span>':"")+'<span class="station-caption">'+caption+'</span></span></li>';
   if(transfer){html+='<li class="transfer-note '+(extra?"route-extra":"")+'" '+(extra?'hidden':'')+'><span>تعویض در '+esc(station)+'</span><strong>'+lineName(transfer.from_line)+' <span class="transfer-arrow">←</span> '+lineName(transfer.to_line)+'</strong></li>'}
  });
  html+='</ol>';
  if(route.length>5)html+='<button type="button" class="show-stations" id="toggle-stations">نمایش همه '+route.length+' ایستگاه</button>';
  if(usedLines.length)html+='<div class="route-legend">'+usedLines.map(line=>'<span class="legend-item"><i class="legend-swatch" style="background:'+colors[line]+'"></i>'+lineName(line)+'</span>').join("")+'</div>';
  if(mode==="fastest"&&Array.isArray(data.warnings)&&data.warnings.length)html+='<div class="warning-note">'+data.warnings.map(esc).join(" ")+'</div>';
  html+='<p class="estimate-note">زمان سفر تخمینی است؛ این سامانه به زمان‌بندی زنده قطارها متصل نیست.</p>';
  result.innerHTML=html;
  result.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{active=button.dataset.mode;render(routes[active],active)}));
  const toggle=$("toggle-stations");if(toggle)toggle.addEventListener("click",()=>{const hiddenItems=result.querySelectorAll(".route-extra[hidden]");const expand=hiddenItems.length>0;result.querySelectorAll(".route-extra").forEach(item=>item.hidden=!expand);toggle.textContent=expand?"جمع کردن فهرست ایستگاه‌ها":"نمایش همه "+route.length+" ایستگاه"});
 }
 form.addEventListener("submit",async event=>{
  event.preventDefault();const from=fromInput.value.trim(),to=toInput.value.trim();if(!from||!to){showError("لطفاً مبدأ و مقصد را انتخاب کن.");return}if(from===to){showError("مبدأ و مقصد نمی‌توانند یکسان باشند.");return}
  setLoading(true);
  try{const params=new URLSearchParams({from_station:from,to_station:to,departure_time:$("departure-time").value||"12:00",day_type:$("day-type").value});
   const [fastest,shortest]=await Promise.all([request("/api/route/fastest?"+params),request("/api/route/details?"+new URLSearchParams({from_station:from,to_station:to}))]);
   routes={fastest,shortest};active="fastest";render(fastest,active);
  }catch(err){showError(err.message||"در دریافت مسیر خطایی رخ داد.")}
  finally{setLoading(false)}
 });
})();