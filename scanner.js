// ScanFarm — สแกนบาร์โค้ดด้วยกล้อง (ใช้ ZXing) เรียกจาก Godot ผ่าน JavaScriptBridge
// ใช้: ScanFarmScan.start(function(code){...}, function(errMsg){...}); ScanFarmScan.stop();
// กล้อง (ผู้ใช้ 2026-10-26 "กล้องไม่โฟกัส สแกนไม่ได้"): ขอภาพละเอียด + โฟกัสต่อเนื่อง · เลือกกล้องหลังตัวหลัก (มือถือหลายเลนส์ชอบได้เลนส์มุมกว้างที่โฟกัสใกล้ไม่ได้)
//   แตะภาพ = โฟกัสใหม่ · ปุ่มไฟฉาย (ถ้ามี) · ปุ่มสลับกล้อง (ถ้ามีกล้องหลังหลายตัว) · ปุ่มถ่ายรูปแทน (ใช้แอปกล้องของเครื่อง โฟกัสดีกว่า)
(function () {
  var reader = null;
  var overlay = null;
  var stream = null;
  var CAM_KEY = "sproutie_cam";

  function stopStream() {
    if (stream) stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    stream = null;
  }

  function stop() {
    try { if (reader) reader.reset(); } catch (e) {}
    reader = null;
    stopStream();
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function formats() {
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E,
    ]);
    return hints;
  }

  function camErr(e) {
    return e && e.name === "NotFoundError" ? "ไม่พบกล้องในเครื่องนี้ ใช้ปุ่ม อัปโหลดรูปบาร์โค้ด แทนนะ"
      : (e && e.name === "NotAllowedError" ? "ยังไม่ได้อนุญาตให้ใช้กล้อง ลองกดอนุญาตในเบราว์เซอร์ หรืออัปโหลดรูปแทน" : "เปิดกล้องไม่ได้ ลองอัปโหลดรูปบาร์โค้ดแทนนะ");
  }

  function videoConstraints(deviceId) {
    var v = { width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] };   // 1280 พอสำหรับบาร์โค้ด (1920 หนักเครื่องเกิน)
    if (deviceId) v.deviceId = { exact: deviceId };
    else v.facingMode = { ideal: "environment" };
    return { video: v, audio: false };
  }

  // กล้องหลังทั้งหมด เรียงให้ตัวหลักมาก่อน (Android ตั้งชื่อ "camera2 0, facing back" = เลนส์หลัก)
  function backCams(list) {
    var cams = list.filter(function (d) { return d.kind === "videoinput"; });
    var back = cams.filter(function (d) { return /back|rear|environment|หลัง/i.test(d.label); });
    if (back.length === 0) back = cams;
    function num(d) { var m = /camera2?\s*(\d+)/i.exec(d.label); return m ? parseInt(m[1], 10) : 99; }
    var wide = /wide|ultra|tele|macro|depth/i;
    back.sort(function (a, b) {
      var wa = wide.test(a.label) ? 1 : 0, wb = wide.test(b.label) ? 1 : 0;
      return wa !== wb ? wa - wb : num(a) - num(b);
    });
    return back;
  }

  function trackOf(s) { return s && s.getVideoTracks ? s.getVideoTracks()[0] : null; }

  function setFocus(track, mode) {
    if (!track || !track.getCapabilities) return;
    var caps = track.getCapabilities();
    if (caps.focusMode && caps.focusMode.indexOf(mode) >= 0) {
      track.applyConstraints({ advanced: [{ focusMode: mode }] }).catch(function () {});
    }
  }

  function btn(text) {
    var b = document.createElement("button");
    b.textContent = text;
    b.style.cssText = "font:17px sans-serif;padding:10px 16px;border-radius:10px;border:0;background:#fffaf0;color:#5b4636;";
    return b;
  }

  // อ่านบาร์โค้ดจากไฟล์รูป
  function decodeFile(file, onCode, onFail) {
    var url = URL.createObjectURL(file);
    var hints = formats();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    var r = new ZXing.BrowserMultiFormatReader(hints);
    r.decodeFromImageUrl(url).then(function (result) {
      URL.revokeObjectURL(url);
      onCode(result.getText());
    }).catch(function () {
      URL.revokeObjectURL(url);
      onFail();
    });
  }

  function start(onCode, onError) {
    stop();
    if (!window.ZXing || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (onError) onError("เบราว์เซอร์นี้เปิดกล้องไม่ได้ ลองอัปโหลดรูปบาร์โค้ดแทนนะ");
      return;
    }
    // เช็กก่อนว่ามีกล้องไหม (คอมไม่มีกล้อง = ไม่เปิดหน้าดำแว้บ ๆ ผู้ใช้ 2026-10-22)
    if (navigator.mediaDevices.enumerateDevices && !start._checked) {
      navigator.mediaDevices.enumerateDevices().then(function (list) {
        var cams = list.filter(function (d) { return d.kind === "videoinput"; });
        if (cams.length === 0) { if (onError) onError("ไม่พบกล้องในเครื่องนี้ ใช้ปุ่ม อัปโหลดรูปบาร์โค้ด แทนนะ"); return; }
        start._checked = true; start(onCode, onError); start._checked = false;
      }).catch(function () { start._checked = true; start(onCode, onError); start._checked = false; });
      return;
    }
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;";
    var box = document.createElement("div");
    box.style.cssText = "position:relative;width:100%;display:flex;justify-content:center;overflow:hidden;";
    var video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.muted = true;
    video.style.cssText = "width:100%;max-height:62vh;object-fit:cover;";
    var aim = document.createElement("div");   // กรอบเล็ง
    aim.style.cssText = "position:absolute;left:12%;right:12%;top:50%;height:30%;transform:translateY(-50%);border:3px solid rgba(255,250,240,0.9);border-radius:12px;box-shadow:0 0 0 2000px rgba(0,0,0,0.25);pointer-events:none;";
    box.appendChild(video);
    box.appendChild(aim);
    var hint = document.createElement("div");
    hint.textContent = "ถือห่างประมาณ 1 คืบ ให้บาร์โค้ดอยู่ในกรอบ · ภาพไม่ชัดแตะภาพเพื่อโฟกัส";
    hint.style.cssText = "color:#fff;font:16px sans-serif;margin:10px 14px;text-align:center;";
    var row = document.createElement("div");
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:4px 10px 10px;";
    var torch = btn("ไฟฉาย");
    var swap = btn("สลับกล้อง");
    torch.style.display = "none";
    swap.style.display = "none";
    var shot = document.createElement("label");   // ใช้แอปกล้องของเครื่องถ่าย (โฟกัสดีกว่ากล้องในเว็บ)
    shot.textContent = "ถ่ายรูปแทน";
    shot.style.cssText = "font:17px sans-serif;padding:10px 16px;border-radius:10px;background:#8fc96a;color:#fff;cursor:pointer;";
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.style.display = "none";
    shot.appendChild(input);
    var close = document.createElement("button");
    close.textContent = "ปิดกล้อง";
    close.style.cssText = "font:20px sans-serif;padding:12px 28px;border-radius:10px;border:0;";
    close.onclick = function () { stop(); };
    row.appendChild(torch);
    row.appendChild(swap);
    row.appendChild(shot);
    overlay.appendChild(box);
    overlay.appendChild(hint);
    overlay.appendChild(row);
    overlay.appendChild(close);
    document.body.appendChild(overlay);

    var mine = overlay;   // ถ้าปิดไประหว่างรอกล้อง ไม่ต้องทำต่อ
    var cams = [];
    var camIdx = 0;
    var torchOn = false;

    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      hint.textContent = "กำลังอ่านบาร์โค้ด…";
      decodeFile(file, function (text) { stop(); if (onCode) onCode(text); }, function () {
        input.value = "";
        hint.textContent = "อ่านบาร์โค้ดในรูปไม่ออก ลองถ่ายใหม่ให้แท่งบาร์โค้ดชัดและตรง";
      });
    };

    function run(deviceId) {
      try { if (reader) reader.reset(); } catch (e) {}
      stopStream();
      return navigator.mediaDevices.getUserMedia(videoConstraints(deviceId)).then(function (s) {
        if (overlay !== mine) { s.getTracks().forEach(function (t) { t.stop(); }); return null; }
        stream = s;
        var track = trackOf(s);
        setFocus(track, "continuous");
        var caps = track && track.getCapabilities ? track.getCapabilities() : {};
        torch.style.display = caps.torch ? "" : "none";
        torchOn = false;
        // ตัวอ่านแต่ละรอบเป็นของตัวเอง: ถ้าถูกแทน (สลับกล้อง) หรือปิดหน้ากล้องแล้ว ให้หยุดลูปตัวเอง
        // (เดิมลูปของตัวอ่านแรกที่ยังไม่ทันเริ่มตอนสลับกล้อง ไม่หยุด อ่านภาพรัวไม่พักไปตลอด → เกมกระตุกหลังสแกน ผู้ใช้ 2026-10-26)
        var r = new ZXing.BrowserMultiFormatReader(formats(), 200);
        r.timeBetweenDecodingAttempts = 120;   // ค่าเดิม 0 = อ่านรัวเต็มเครื่อง
        reader = r;
        r.decodeFromStream(s, video, function (result) {
          if (r !== reader || overlay !== mine) { r.stopContinuousDecode(); return; }
          if (result) {
            var text = result.getText();
            stop();
            if (onCode) onCode(text);
          }
        }).catch(function () {});
        return track;
      });
    }

    torch.onclick = function () {
      var t = trackOf(stream);
      if (!t) return;
      torchOn = !torchOn;
      t.applyConstraints({ advanced: [{ torch: torchOn }] }).catch(function () {});
    };
    swap.onclick = function () {
      if (cams.length < 2) return;
      camIdx = (camIdx + 1) % cams.length;
      try { localStorage.setItem(CAM_KEY, cams[camIdx].deviceId); } catch (e) {}
      run(cams[camIdx].deviceId).catch(function () {});
    };
    video.onclick = function () {   // แตะ = โฟกัสใหม่
      var t = trackOf(stream);
      setFocus(t, "single-shot");
      setTimeout(function () { setFocus(t, "continuous"); }, 1200);
    };

    var saved = null;
    try { saved = localStorage.getItem(CAM_KEY); } catch (e) {}
    run(null).then(function (track) {
      if (!track || overlay !== mine || !navigator.mediaDevices.enumerateDevices) return;
      // ได้สิทธิ์แล้วถึงเห็นชื่อกล้อง → ย้ายไปกล้องหลังตัวหลัก (หรือตัวที่เคยเลือกไว้)
      return navigator.mediaDevices.enumerateDevices().then(function (list) {
        cams = backCams(list);
        swap.style.display = cams.length > 1 ? "" : "none";
        if (cams.length < 2) return;
        var want = 0;
        for (var i = 0; i < cams.length; i++) if (cams[i].deviceId === saved) want = i;
        camIdx = want;
        var cur = track.getSettings ? track.getSettings().deviceId : "";
        if (cams[want].deviceId && cams[want].deviceId !== cur) return run(cams[want].deviceId);
      });
    }).catch(function (e) {
      if (overlay !== mine) return;
      stop();
      if (onError) onError(camErr(e));
    });
  }

  // อ่านบาร์โค้ดจากรูป (ผู้ใช้ 2026-10-22 "ชอบแบบอัปรูป") — หน้าต่าง HTML ให้แตะเลือกรูปเอง (เบราว์เซอร์ยอมเปิดตัวเลือกไฟล์เฉพาะตอนแตะจริง)
  function pickImage(onCode, onError) {
    stop();
    if (!window.ZXing) { if (onError) onError("โหลดตัวอ่านบาร์โค้ดไม่ได้ ลองรีเฟรชหน้า"); return; }
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(40,25,15,0.72);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:sans-serif;";
    var card = document.createElement("div");
    card.style.cssText = "background:#fffaf0;border:5px solid #c98a52;border-radius:18px;padding:22px 26px;max-width:340px;text-align:center;color:#5b4636;";
    card.innerHTML = "<div style=\"font-size:22px;font-weight:bold;margin-bottom:8px\">อัปโหลดรูปบาร์โค้ด</div><div style=\"font-size:16px;margin-bottom:16px\">ถ่ายรูปบาร์โค้ดใกล้ ๆ ให้ชัด แล้วเลือกรูปนั้น</div>";
    var pick = document.createElement("label");
    pick.textContent = "เลือกรูป";
    pick.style.cssText = "display:block;background:#8fc96a;color:#fff;font-size:20px;font-weight:bold;padding:12px;border-radius:12px;cursor:pointer;margin-bottom:10px;";
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    pick.appendChild(input);
    var msg = document.createElement("div");
    msg.style.cssText = "font-size:15px;min-height:20px;margin-bottom:8px;color:#b5516e;";
    var close = document.createElement("button");
    close.textContent = "ยกเลิก";
    close.style.cssText = "font-size:17px;padding:8px 24px;border-radius:10px;border:2px solid #c98a52;background:#fff;color:#5b4636;";
    close.onclick = function () { stop(); };
    card.appendChild(pick);
    card.appendChild(msg);
    card.appendChild(close);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      msg.style.color = "#5b4636";
      msg.textContent = "กำลังอ่านบาร์โค้ด…";
      decodeFile(file, function (text) { stop(); if (onCode) onCode(text); }, function () {
        input.value = "";
        msg.style.color = "#b5516e";
        msg.textContent = "อ่านบาร์โค้ดในรูปไม่ออก ลองถ่ายใกล้ ๆ ให้แท่งบาร์โค้ดชัดและตรง";
      });
    };
  }

  window.ScanFarmScan = { start: start, stop: stop, pickImage: pickImage };
})();
