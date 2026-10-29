// หน้าโหลดเกม (ผู้ใช้ 2026-10-20 "เปลี่ยนหน้าโหลดใหม่ เอาแก้มตุ่ยมาเดินบนหลอดโหลด")
// พื้นครีม + โลโก้ + หลอดโหลดไม้เขียว + แก้มตุ่ยเด้งเดินตามความคืบหน้า + ข้อความสลับ — อ่านค่าจาก <progress id="status-progress"> ของ Godot
(function () {
  const TIPS = ["กำลังรดน้ำต้นกล้า…", "กำลังปลุกน้องหมาน้องแมว…", "กำลังเก็บไข่ไก่…", "กำลังปัดฝุ่นยุ้งฉาง…", "แก้มตุ่ยกำลังมา~"];
  function start() {
    const status = document.getElementById("status");
    const prog = document.getElementById("status-progress");
    if (!status || !prog) return;
    const box = document.createElement("div");
    box.id = "sp-load";
    box.innerHTML =
      '<img id="sp-logo" src="logo_load.png" alt="Sproutie">' +
      '<div id="sp-track"><div id="sp-fill"></div><div id="sp-tui"></div></div>' +
      '<div id="sp-tip"></div>';
    status.appendChild(box);
    const fill = document.getElementById("sp-fill");
    const tui = document.getElementById("sp-tui");
    const tip = document.getElementById("sp-tip");
    // ท่าเดินหันข้างไปทางขวา 8 เฟรม (Pixel Lab 2026-10-21 แผ่นเรียง 768×96 ผู้ใช้ "เดินหันข้างได้ไหม") สลับเฟรมทุก 110 ms
    tui.style.cssText = "position:absolute;bottom:4px;width:132px;height:132px;margin-left:-38px;background:url(tui_walk.png) 0 0 / 1056px 132px no-repeat;image-rendering:pixelated;";
    let fr = 0;
    setInterval(function () { fr = (fr + 1) % 8; tui.style.backgroundPosition = (-fr * 132) + "px 0"; }, 110);
    let shown = 0, t = 0, k = 0;
    tip.textContent = TIPS[0];
    setInterval(function () { k = (k + 1) % TIPS.length; tip.textContent = TIPS[k]; }, 1800);
    (function tick() {
      if (!document.getElementById("sp-load")) return;
      let want = prog.max > 0 && prog.value > 0 ? prog.value / prog.max : Math.min(0.9, shown + 0.002);
      shown += (want - shown) * 0.12;
      t += 1;
      fill.style.width = (shown * 100).toFixed(1) + "%";
      tui.style.left = "calc(" + (shown * 100).toFixed(1) + "% - 28px)";
      tui.style.transform = "translateY(" + (-Math.abs(Math.sin(t * 0.25)) * 4).toFixed(1) + "px) rotate(0deg)";
      requestAnimationFrame(tick);
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

// ---------- เปิดในเบราว์เซอร์หลัก (ผู้ใช้ 2026-10-25 "เวลาเข้าเว็บ มีปุ่มให้กดไปใช้ดีฟอลต์บราวเซอร์ได้ไหม") ----------
// เปิดลิงก์จากในแอป (Facebook Messenger LINE Instagram TikTok) = เบราว์เซอร์ในแอป: จอโดนแถบบัง เต็มจอ/ล็อกอิน Google/กล้องมักใช้ไม่ได้
// → แถบด้านบนพร้อมปุ่ม "เปิดในเบราว์เซอร์" · Android = ส่งต่อให้เบราว์เซอร์หลักของเครื่อง · LINE = ?openExternalBrowser=1 · iPhone = บอกวิธี + ปุ่มคัดลอกลิงก์
(function () {
  var ua = navigator.userAgent || "";
  var inApp = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|LINE\/|TikTok|musical_ly|Bytedance|KAKAOTALK|Twitter/i.test(ua);
  if (!inApp && !/[?&]inapp=1/.test(location.search)) return;   // ?inapp=1 = ทดสอบแถบนี้
  var isAndroid = /Android/i.test(ua);
  var isLine = /Line\//i.test(ua) || /LINE\//.test(ua);
  var clean = location.origin + location.pathname;
  function openOut() {
    if (isLine) { location.href = clean + "?openExternalBrowser=1"; return; }
    if (isAndroid) {
      location.href = "intent://" + location.host + location.pathname + "#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=" + encodeURIComponent(clean) + ";end";
      return;
    }
    msg.textContent = "แตะปุ่ม ⋯ หรือ ↗ มุมจอ แล้วเลือก “เปิดใน Safari” / “เปิดในเบราว์เซอร์”";
  }
  function copyLink() {
    var done = function () { copyBtn.textContent = "คัดลอกแล้ว ✓"; };
    if (navigator.clipboard) { navigator.clipboard.writeText(clean).then(done, function () {}); }
    else { var t = document.createElement("textarea"); t.value = clean; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) {} t.remove(); }
  }
  var bar, msg, copyBtn;
  function show() {
    if (document.getElementById("sp-inapp")) return;
    bar = document.createElement("div");
    bar.id = "sp-inapp";
    bar.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:10000;background:#fffaf0;border:4px solid #c98a52;border-radius:16px;padding:12px 14px;font:16px sans-serif;color:#5b4636;box-shadow:0 4px 12px rgba(60,35,20,.3);display:flex;flex-direction:column;gap:8px;";
    msg = document.createElement("div");
    msg.textContent = "เล่นในเบราว์เซอร์หลักจะลื่นกว่า เต็มจอได้ ล็อกอิน Google และสแกนได้ครบ";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    var go = document.createElement("button");
    go.textContent = "เปิดในเบราว์เซอร์";
    go.style.cssText = "flex:1;min-width:140px;font:bold 17px sans-serif;padding:10px;border:0;border-radius:12px;background:#8fc96a;color:#fff;";
    go.onclick = openOut;
    copyBtn = document.createElement("button");
    copyBtn.textContent = "คัดลอกลิงก์";
    copyBtn.style.cssText = "font:15px sans-serif;padding:10px 12px;border:2px solid #c98a52;border-radius:12px;background:#fff;color:#5b4636;";
    copyBtn.onclick = copyLink;
    var close = document.createElement("button");
    close.textContent = "เล่นต่อที่นี่";
    close.style.cssText = "font:15px sans-serif;padding:10px 12px;border:0;border-radius:12px;background:#efe3c6;color:#5b4636;";
    close.onclick = function () { bar.remove(); };
    row.appendChild(go); row.appendChild(copyBtn); row.appendChild(close);
    bar.appendChild(msg); bar.appendChild(row);
    document.body.appendChild(bar);
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();

// ---------- จอมือถือ: ขนาดเกมตามพื้นที่ที่มองเห็นจริง (ผู้ใช้ 2026-10-25 เปิดจาก Messenger แล้วส่วนล่างของเกมจมใต้ขอบจอ) ----------
// หน้าเว็บห้ามเลื่อน (แถบเบราว์เซอร์ไม่ยืด-หดจนขนาดจอเพี้ยน) · พื้นที่มองเห็นเปลี่ยน (แถบเบราว์เซอร์โผล่/หาย หมุนจอ) = แจ้งเกมให้จัดขนาดใหม่
(function () {
  var st = document.createElement("style");
  st.textContent = "html,body{position:fixed;inset:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;}";
  (document.head || document.documentElement).appendChild(st);
  var vv = window.visualViewport;
  if (vv) {
    // แถบเบราว์เซอร์ทับเกม (พื้นที่มองเห็นเตี้ยกว่าหน้าต่าง): ให้เกมใช้ความสูงที่มองเห็นจริง
    try {
      var desc = Object.getOwnPropertyDescriptor(window, "innerHeight") || Object.getOwnPropertyDescriptor(Window.prototype, "innerHeight");
      if (desc && desc.get) {
        Object.defineProperty(window, "innerHeight", { configurable: true, get: function () {
          var real = desc.get.call(window);
          var seen = Math.round(vv.height * vv.scale);
          return (seen > 200 && seen < real) ? seen : real;
        } });
      }
    } catch (e) {}
  }
  var last = "";
  setInterval(function () {
    var k = window.innerWidth + "x" + window.innerHeight;
    if (k !== last) { last = k; window.dispatchEvent(new Event("resize")); }
  }, 400);
})();
