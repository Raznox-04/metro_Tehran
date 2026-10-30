(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $("#route-form");
  const fromInput = $("#from");
  const toInput = $("#to");
  const resultSection = $("#results-section");
  const resultsContent = $("#results-content");
  const errorMessage = $("#error-message");
  const searchButton = $("#search-button");
  const lineColors = {1:"#e0001f",2:"#2f4389",3:"#67c5f5",4:"#f8e100",5:"#007e46",6:"#ef639f",7:"#7f0b74"};
  const state = {fastest:null,shortest:null,active:"fastest"};

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  }
  function lineName(line) { return "خط " + line; }
  function lineBadge(line) {
    return '<span class="mini-line" style="--line-color:'+lineColors[line]+'">'+lineName(line)+'</span>';
  }
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
    resultsContent.hidden = true;
    resultSection.hidden = false;
    resultSection.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function setLoading(loading) {
    searchButton.disabled = loading;
    searchButton.innerHTML = loading ? '<span>در حال محاسبه مسیر</span><i class="loading-ring"></i>' : '<span>پیدا کردن مسیر</span><b>←</b>';
  }
  function minutesLabel(value) {
    const total = Math.max(0,Math.round(Number(value)||0));
    const hours = Math.floor(total/60), minutes = total%60;
    if(hours && minutes) return hours+" ساعت و "+minutes+" دقیقه";
    if(hours) return hours+" ساعت";
    return minutes+" دقیقه";
  }
  async function getJSON(url) {
    const response = await fetch(url);
    const data = await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.detail || "در دریافت اطلاعات مسیر خطایی رخ داد.");
    return data;
  }

  function setupAutocomplete(input, list) {
    let debounceTimer = null;
    let activeIndex = -1;
    let currentItems = [];
    function close() { list.classList.remove("open"); list.replaceChildren(); activeIndex=-1; }
    function choose(value) { input.value=value; close(); input.dispatchEvent(new Event("change",{bubbles:true})); }
    function render(items) {
      currentItems=items.slice(0,8);
      list.replaceChildren();
      if(!currentItems.length) {
        const empty=document.createElement("div"); empty.className="suggestion-item"; empty.textContent="ایستگاهی پیدا نشد"; list.appendChild(empty);
      } else currentItems.forEach((name,index)=>{
        const item=document.createElement("div"); item.className="suggestion-item"; item.role="option"; item.textContent=name;
        item.addEventListener("mousedown",(event)=>{event.preventDefault();choose(name);});
        list.appendChild(item);
      });
      list.classList.add("open");
    }
    input.addEventListener("input",()=>{
      clearTimeout(debounceTimer);
      const query=input.value.trim();
      if(query.length<2){close();return;}
      debounceTimer=setTimeout(async()=>{
        try {
          const data=await getJSON("/api/stations/search?query="+encodeURIComponent(query));
          render(data.stations||[]);
        } catch { close(); }
      },220);
    });
    input.addEventListener("keydown",(event)=>{
      const items=[...list.querySelectorAll(".suggestion-item")].filter(item=>item.role==="option");
      if(event.key==="ArrowDown" && items.length){event.preventDefault();activeIndex=(activeIndex+1)%items.length;}
      else if(event.key==="ArrowUp" && items.length){event.preventDefault();activeIndex=(activeIndex-1+items.length)%items.length;}
      else if(event.key==="Enter" && activeIndex>=0){event.preventDefault();choose(currentItems[activeIndex]);}
      else if(event.key==="Escape") close();
      items.forEach((item,index)=>item.classList.toggle("active",index===activeIndex));
    });
    input.addEventListener("blur",()=>setTimeout(close,120));
  }
  setupAutocomplete(fromInput,$("#from-suggestions"));
  setupAutocomplete(toInput,$("#to-suggestions"));

  $("#swap-stations").addEventListener("click",()=>{
    const previous=fromInput.value; fromInput.value=toInput.value; toInput.value=previous;
  });
  $("#reset-search").addEventListener("click",()=>{
    form.reset(); fromInput.focus(); resultSection.hidden=true; state.fastest=null;state.shortest=null;
  });

  function renderOverview(data, mode) {
    const time=data.estimated_time||{};
    const total=time.total_minutes ?? data.total_minutes ?? 0;
    const stops=data.stops ?? Math.max(0,(data.route||[]).length-1);
    const transfers=data.transfer_count ?? (data.transfers||[]).length;
    const lines=(data.lines_used||[]).length;
    const items=[
      [minutesLabel(total),"زمان تخمینی"],
      [stops+"","تعداد ایستگاه"],
      [transfers+"","تعویض خط"],
      [lines+"","خط در مسیر"]
    ];
    $("#journey-overview").innerHTML=items.map(([value,label])=>'<div class="overview-item"><div class="overview-value">'+escapeHTML(value)+'</div><div class="overview-label">'+label+'</div></div>').join("");
  }
  function renderTimeline(data, mode) {
    const route=data.route||[];
    const details=data.route_details||[];
    const transfers=data.transfers||[];
    const transferNames=new Set(transfers.map(item=>item.station));
    const linesUsed=data.lines_used||[];
    let html="";
    route.forEach((station,index)=>{
      const detail=details.find(item=>item.name===station);
      let stationLines=detail?.lines||[];
      if(!stationLines.length && linesUsed.length) stationLines=[linesUsed[0]];
      const isTransfer=transferNames.has(station) || (detail?.is_transfer && index!==0 && index!==route.length-1);
      const color=lineColors[stationLines[0]]||"#c5f36b";
      const markerClass=(index===0||index===route.length-1)?"end":(isTransfer?"transfer":"");
      const subLabel=index===0?"مبدأ حرکت":index===route.length-1?"مقصد نهایی":(isTransfer?"ایستگاه تعویض خط":"");
      html+='<div class="timeline-item"><span class="timeline-marker '+markerClass+'" style="--station-color:'+color+'"></span><div class="timeline-copy"><div><strong>'+escapeHTML(station)+'</strong><br><small>'+subLabel+'</small></div><div class="timeline-lines">'+stationLines.map(lineBadge).join("")+'</div></div></div>';
      const transfer=transfers.find(item=>item.station===station);
      if(transfer && index!==route.length-1) {
        html+='<div class="transfer-row"><span>⇄</span><span>تعویض '+lineName(transfer.from_line)+' به '+lineName(transfer.to_line)+'</span><b>'+minutesLabel((transfer.transfer_minutes||0)+(transfer.waiting_minutes||0))+'</b></div>';
      }
    });
    if(!route.length) html='<p class="overview-label">اطلاعات مسیر در دسترس نیست.</p>';
    $("#route-timeline").innerHTML=html;
  }
  function renderLegend(data) {
    const lines=data.lines_used||[];
    $("#line-legend-items").innerHTML='<div class="legend-grid">'+lines.map(line=>'<div class="legend-item"><i class="line-swatch" style="background:'+lineColors[line]+'"></i>'+lineName(line)+'</div>').join("")+'</div>';
  }
  function renderActive() {
    const data=state[state.active];
    if(!data) return;
    document.querySelectorAll(".route-tab").forEach(tab=>{
      const active=tab.dataset.route===state.active;
      tab.classList.toggle("active",active);tab.setAttribute("aria-selected",String(active));
    });
    renderOverview(data,state.active);
    renderTimeline(data,state.active);
    renderLegend(data);
  }
  document.querySelectorAll(".route-tab").forEach(tab=>tab.addEventListener("click",()=>{
    state.active=tab.dataset.route;renderActive();
  }));

  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    const from=fromInput.value.trim(),to=toInput.value.trim();
    if(!from||!to){showError("لطفاً ایستگاه مبدأ و مقصد را انتخاب کن.");return;}
    if(from===to){showError("مبدأ و مقصد نمی‌توانند یک ایستگاه باشند.");return;}
    setLoading(true);errorMessage.hidden=true;resultSection.hidden=false;resultsContent.hidden=true;
    try {
      const params=new URLSearchParams({from_station:from,to_station:to,departure_time:$("#departure-time").value||"12:00",day_type:$("#day-type").value});
      const [fastest,shortest]=await Promise.all([
        getJSON("/api/route/fastest?"+params.toString()),
        getJSON("/api/route/details?"+new URLSearchParams({from_station:from,to_station:to}).toString())
      ]);
      state.fastest=fastest;state.shortest=shortest;state.active="fastest";
      errorMessage.hidden=true;resultsContent.hidden=false;renderActive();
      resultSection.scrollIntoView({behavior:"smooth",block:"start"});
    } catch(error) {
      showError(error.message||"ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کن.");
    } finally {setLoading(false);}
  });

  $("#line-legend-items").innerHTML='<div class="legend-grid">'+Object.keys(lineColors).map(line=>'<div class="legend-item"><i class="line-swatch" style="background:'+lineColors[line]+'"></i>'+lineName(line)+'</div>').join("")+'</div>';
})();