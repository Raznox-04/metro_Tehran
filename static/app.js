(() => {
  const $ = id => document.getElementById(id);
  const form = $("route-form");
  const fromInput = $("from");
  const toInput = $("to");
  const result = $("result");
  const submitBtn = $("submit-btn");
  const colors = {1:"#e0001f",2:"#2f4389",3:"#67c5f5",4:"#f2df00",5:"#07884d",6:"#ef639f",7:"#7f0b74"};
  const lineNames = {1:"خط ۱",2:"خط ۲",3:"خط ۳",4:"خط ۴",5:"خط ۵",6:"خط ۶",7:"خط ۷"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const lineName = number => lineNames[number] || ("خط " + number);
  const formatMinutes = value => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    const h = Math.floor(n / 60), m = n % 60;
    return h ? (m ? h + " ساعت و " + m + " دقیقه" : h + " ساعت") : m + " دقیقه";
  };
  async function request(url) {
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "خطا در دریافت اطلاعات");
    return data;
  }
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? '<span>در حال محاسبه مسیر</span><i class="loading"></i>'
      : '<span>پیدا کردن مسیر</span><svg class="button-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 7-7m-7 7 7 7"/></svg>';
  }
  function showError(message) {
    document.body.classList.add("has-results");
    result.innerHTML = '<div class="error">' + esc(message) + '</div>';
  }
  function setupAutocomplete(input, list) {
    let timer, values = [];
    const close = () => { list.classList.remove("open"); list.innerHTML = ""; };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 2) { close(); return; }
      timer = setTimeout(async () => {
        try {
          const data = await request("/api/stations/search?query=" + encodeURIComponent(query));
          values = data.stations || [];
          list.innerHTML = values.length
            ? values.map((name, index) => '<button type="button" data-index="' + index + '">' + esc(name) + '</button>').join("")
            : '<div class="autocomplete-empty">ایستگاهی پیدا نشد</div>';
          list.classList.add("open");
          list.querySelectorAll("[data-index]").forEach(item => item.addEventListener("click", () => {
            input.value = values[Number(item.dataset.index)];
            close();
          }));
        } catch { close(); }
      }, 170);
    });
    input.addEventListener("blur", () => setTimeout(close, 150));
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
  }
  setupAutocomplete(fromInput, $("from-list"));
  setupAutocomplete(toInput, $("to-list"));
  $("swap-btn").addEventListener("click", () => {
    const previous = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = previous;
  });

  function render(data) {
    const route = data.route || [];
    if (!route.length) { showError("مسیر معتبری پیدا نشد."); return; }
    document.body.classList.add("has-results");
    const time = data.estimated_time || {};
    const transfers = data.transfers || [];
    const segments = data.segments || [];
    const usedLines = [...new Set(segments.map(segment => Number(segment.line)).filter(Boolean))];
    const transferMap = new Map(transfers.map(transfer => [transfer.station, transfer]));
    const totalTime = formatMinutes(time.total_minutes);
    let html = '<div class="result-heading"><div><span class="result-kicker">پیشنهاد مسیر</span><h2>بهترین مسیر برای سفر شما</h2></div><span class="recommended-tag">سریع‌ترین</span></div>';
    html += '<div class="route-summary">';
    html += '<div class="summary-card"><span class="summary-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><span class="summary-value">' + esc(totalTime) + '</span><span class="summary-label">زمان تخمینی سفر</span></div>';
    html += '<div class="summary-card"><span class="summary-icon"><svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a4 4 0 0 0 4-4V8"/></svg></span><span class="summary-value">' + esc(data.stops ?? Math.max(0, route.length - 1)) + '</span><span class="summary-label">تعداد ایستگاه‌ها</span></div>';
    html += '<div class="summary-card"><span class="summary-icon"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 17h14M8 4 5 7l3 3m8 4 3 3-3 3"/></svg></span><span class="summary-value">' + esc(transfers.length) + '</span><span class="summary-label">تعویض خط</span></div></div>';
    html += '<div class="trip-meta"><span>حرکت <b>' + esc(data.departure_time || "") + '</b></span><span>رسیدن تخمینی <b>' + esc(data.arrival_time || "—") + '</b></span><span>زمان حرکت قطار <b>تخمینی</b></span></div>';
    html += '<div class="route-breakdown"><div><span>زمان داخل قطار</span><b>' + formatMinutes(time.travel_minutes) + '</b></div><div><span>انتظار</span><b>' + formatMinutes(time.waiting_minutes) + '</b></div><div><span>تعویض خط</span><b>' + formatMinutes(time.transfer_minutes) + '</b></div></div>';
    html += '<div class="route-list-heading"><h3>مراحل مسیر</h3><span>' + route.length + ' ایستگاه</span></div><ol class="route-list">';
    route.forEach((station, index) => {
      const start = index === 0, end = index === route.length - 1;
      const transfer = transferMap.get(station);
      const segmentBefore = segments[index - 1], segmentAfter = segments[index];
      const line = start ? segmentAfter?.line : end ? segmentBefore?.line : (transfer?.to_line || segmentAfter?.line || segmentBefore?.line);
      const extra = index > 4;
      html += '<li class="route-item ' + ((start || end) ? "endpoint " : "") + (transfer ? "transfer " : "") + (extra ? "route-extra" : "") + '" ' + (extra ? "hidden" : "") + '>';
      html += '<span class="station-marker" style="--station-color:' + (colors[line] || "#a8b2c8") + '"></span>';
      html += '<span class="station-name">' + esc(station) + '</span><span class="station-meta">';
      if (line) html += '<span class="line-pill" style="--line-color:' + colors[line] + '">' + lineName(line) + '</span>';
      html += '<span class="station-caption">' + (start ? "مبدأ" : end ? "مقصد" : transfer ? "تعویض خط" : "") + '</span></span></li>';
      if (transfer) html += '<li class="transfer-note ' + (extra ? "route-extra" : "") + '" ' + (extra ? "hidden" : "") + '><span>تعویض خط در ' + esc(station) + '</span><strong>' + lineName(transfer.from_line) + ' <span class="transfer-arrow">←</span> ' + lineName(transfer.to_line) + '</strong></li>';
    });
    html += '</ol>';
    if (route.length > 5) html += '<button type="button" class="show-stations" id="toggle-stations">نمایش ادامه مسیر (' + (route.length - 5) + ' ایستگاه)</button>';
    if (usedLines.length) html += '<div class="route-legend">' + usedLines.map(line => '<span class="legend-item"><i class="legend-swatch" style="background:' + colors[line] + '"></i>' + lineName(line) + '</span>').join("") + '</div>';
    if (Array.isArray(data.warnings) && data.warnings.length) html += '<div class="warning-note">' + data.warnings.map(esc).join(" ") + '</div>';
    html += '<p class="estimate-note">این زمان برآوردی است و به اطلاعات زنده حرکت قطارها متصل نیست.</p>';
    result.innerHTML = html;
    const toggle = $("toggle-stations");
    if (toggle) toggle.addEventListener("click", () => {
      const hidden = result.querySelectorAll(".route-extra[hidden]");
      const expand = hidden.length > 0;
      result.querySelectorAll(".route-extra").forEach(item => item.hidden = !expand);
      toggle.textContent = expand ? "جمع کردن ادامه مسیر" : "نمایش ادامه مسیر (" + (route.length - 5) + " ایستگاه)";
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const from = fromInput.value.trim(), to = toInput.value.trim();
    if (!from || !to) { showError("لطفاً مبدأ و مقصد را انتخاب کن."); return; }
    if (from === to) { showError("مبدأ و مقصد نمی‌توانند یکسان باشند."); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from_station: from,
        to_station: to,
        departure_time: $("departure-time").value || "12:00",
        day_type: $("day-type").value
      });
      const fastest = await request("/api/route/fastest?" + params);
      render(fastest);
      result.scrollIntoView({behavior:"smooth", block:"nearest"});
    } catch (error) {
      showError(error.message || "در دریافت مسیر خطایی رخ داد.");
    } finally {
      setLoading(false);
    }
  });
})();