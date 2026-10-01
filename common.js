/* ===== common.js – utilitas, panggilan API, login, boot ===== */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const S = { token: null, user: null, settings: {} };
  const U = (window.U = { S: S, timers: [] });

  /* ---------- util dasar ---------- */
  U.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.nl2br = function (s) { return U.esc(s).replace(/\r?\n/g, '<br>'); };
  U.$ = function (sel, root) { return (root || document).querySelector(sel); };
  U.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.pad = function (n) { return String(n).padStart(2, '0'); };
  U.fmtDur = function (sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + U.pad(m) : U.pad(m)) + ':' + U.pad(s);
  };
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  U.fmtJadwal = function (str) { // 'yyyy-MM-dd HH:mm' -> '02 Okt 2026, 07:30'
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(str || ''));
    return m ? m[3] + ' ' + BLN[+m[2] - 1] + ' ' + m[1] + ', ' + m[4] + ':' + m[5] : (str || '-');
  };
  U.fmtMs = function (ms) {
    if (!ms) return '-';
    const t = new Date(Number(ms) + 7 * 3600e3);
    return U.pad(t.getUTCDate()) + ' ' + BLN[t.getUTCMonth()] + ' ' + U.pad(t.getUTCHours()) + ':' + U.pad(t.getUTCMinutes());
  };
  U.num = function (v) { return v === '' || v === null || v === undefined ? '-' : String(v); };
  U.imgUrl = function (u) {
    u = String(u || '').trim();
    if (!/^https?:\/\//i.test(u)) return '';
    let m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u) || /drive\.google\.com\/(?:open|uc)\?[^#]*id=([\w-]+)/.exec(u);
    if (m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1400';
    return u;
  };
  U.clearTimers = function () { U.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); U.timers = []; };
  U.every = function (fn, ms) { const t = setInterval(fn, ms); U.timers.push(t); return t; };

  U.logoUrl = function () { return S.settings.logo_url || CFG.LOGO || ''; };
  U.brand = function () {
    const lg = U.logoUrl(), nama = S.settings.nama_aplikasi || 'Ujian Online';
    const img = lg ? '<img src="' + U.esc(lg) + '" alt="" onerror="this.outerHTML=\'<span class=&quot;logo-ph&quot;>' + U.esc(nama.charAt(0)) + '</span>\'">'
                   : '<span class="logo-ph">' + U.esc(nama.charAt(0)) + '</span>';
    return '<div class="brand">' + img + '<div class="brand-t"><b>' + U.esc(nama) + '</b><small>' + U.esc(S.settings.nama_sekolah || '') + '</small></div></div>';
  };

  /* ---------- toast / modal / confirm ---------- */
  U.toast = function (msg, type, ms) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 3800);
  };

  U.modal = function (o) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h3>' + U.esc(o.title || '') + '</h3>' + (o.noClose ? '' : '<button class="x" type="button" data-close aria-label="Tutup">&times;</button>') + '</div>' +
      '<div class="modal-body">' + (o.body || '') + '</div><div class="modal-foot"></div></div>';
    root.appendChild(wrap);
    let closed = false;
    const m = {
      el: wrap,
      body: wrap.querySelector('.modal-body'),
      $: function (s) { return wrap.querySelector(s); },
      $$: function (s) { return U.$$(s, wrap); },
      close: function () { if (closed) return; closed = true; wrap.remove(); if (o.onClose) o.onClose(); }
    };
    const foot = wrap.querySelector('.modal-foot');
    (o.buttons || []).forEach(function (b) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.cls || '');
      btn.textContent = b.text;
      btn.onclick = async function () {
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          const r = b.onClick ? await b.onClick(m) : undefined;
          if (r !== false) m.close();
        } catch (e) { U.toast(e.message || String(e), 'err'); }
        finally { btn.disabled = false; }
      };
      foot.appendChild(btn);
    });
    if (!(o.buttons || []).length) foot.remove();
    wrap.addEventListener('mousedown', function (e) {
      if (e.target.hasAttribute('data-close') || (e.target === wrap && !o.noClose && !o.sticky)) m.close();
    });
    if (o.onOpen) o.onOpen(m);
    return m;
  };

  U.confirm = function (msg, o) {
    o = o || {};
    return new Promise(function (resolve) {
      let answered = false;
      U.modal({
        title: o.title || 'Konfirmasi', sticky: true,
        body: '<p style="margin:0">' + U.nl2br(msg) + '</p>',
        buttons: [
          { text: o.cancelText || 'Batal', onClick: function () { answered = true; resolve(false); } },
          { text: o.okText || 'Ya, lanjutkan', cls: o.danger ? 'danger' : 'primary', onClick: function () { answered = true; resolve(true); } }
        ],
        onClose: function () { if (!answered) resolve(false); }
      });
    });
  };

  /* ---------- file: CSV & cetak ---------- */
  U.downloadCsv = function (filename, rows) {
    const body = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  U.printHtml = function (title, html) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const d = f.contentWindow.document;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><title>' + U.esc(title) + '</title><style>' +
      'body{font:13px/1.45 Arial,sans-serif;color:#000;margin:18px}h2{margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:10px}' +
      'th,td{border:1px solid #444;padding:5px 8px;text-align:left}th{background:#eee}.card{border:1px dashed #444;padding:10px;margin:0 0 10px;break-inside:avoid;display:inline-block;width:48%;vertical-align:top}' +
      '</style></head><body>' + html + '</body></html>');
    d.close();
    setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 2000); }, 300);
  };

  /* ---------- parser tempel dari Excel ---------- */
  U.parseTable = function (text, cols) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
    const rows = [];
    lines.forEach(function (l, i) {
      const parts = l.indexOf('\t') >= 0 ? l.split('\t') : l.split(';');
      if (i === 0 && /pertanyaan|username|nama/i.test(parts.join(' ')) && parts.length >= 2 && /^(mapel|nama|no)/i.test(parts[0].trim())) return; // baris judul
      const o = {};
      cols.forEach(function (c, j) { o[c] = (parts[j] || '').trim(); });
      rows.push(o);
    });
    return rows;
  };

  /* ---------- API ---------- */
  U.api = async function (action, data, o) {
    o = o || {};
    const url = CFG.API_URL;
    if (!url || /GANTI_DENGAN/.test(url)) {
      const e = new Error('URL API belum diisi. Buka file config.js lalu isi API_URL dengan alamat Web App Apps Script.');
      e.config = true; throw e;
    }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = ctl ? setTimeout(function () { ctl.abort(); }, o.timeout || 40000) : null;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: S.token, data: data || {} }),
        signal: ctl ? ctl.signal : undefined
      });
    } catch (e) {
      const ne = new Error(e && e.name === 'AbortError' ? 'Server lambat merespons. Coba lagi.' : 'Koneksi internet bermasalah.');
      ne.network = true; throw ne;
    } finally { if (to) clearTimeout(to); }
    let j;
    try { j = await res.json(); } catch (e) {
      throw new Error('Respons server tidak valid. Pastikan Web App di-deploy dengan akses "Anyone" dan URL-nya benar.');
    }
    if (!j.ok) {
      const er = new Error(j.error || 'Terjadi kesalahan.');
      er.code = j.code;
      if (j.code === 'AUTH' && !o.noAuthRedirect) U.sessionExpired(er.message);
      throw er;
    }
    return j.data;
  };

  U.sessionExpired = function (msg) {
    if (!S.token) return;
    U.clearTimers();
    S.token = null; S.user = null;
    sessionStorage.removeItem('uo_tok');
    U.showLogin(msg || 'Sesi berakhir. Silakan login kembali.');
  };

  /* ---------- fullscreen ---------- */
  U.fsSupported = function () {
    const e = document.documentElement;
    return !!(e.requestFullscreen || e.webkitRequestFullscreen);
  };
  U.fsActive = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
  U.enterFs = function () { // HARUS dipanggil langsung dari klik pengguna
    const e = document.documentElement;
    try {
      if (U.fsActive()) return Promise.resolve({ ok: true });
      let p;
      if (e.requestFullscreen) p = e.requestFullscreen();
      else if (e.webkitRequestFullscreen) p = e.webkitRequestFullscreen();
      else return Promise.resolve({ ok: false, unsupported: true });
      return Promise.resolve(p).then(function () { return { ok: true }; }, function (er) { return { ok: false, error: er }; });
    } catch (er) { return Promise.resolve({ ok: false, error: er }); }
  };
  U.exitFs = function () {
    try {
      if (!U.fsActive()) return;
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { /* abaikan */ }
  };

  U.passwordModal = function () {
    U.modal({
      title: 'Ganti Password',
      body: '<label>Password lama<input type="password" id="pw0" autocomplete="off"></label>' +
            '<label>Password baru (min. 6 karakter)<input type="password" id="pw1" autocomplete="off"></label>' +
            '<label>Ulangi password baru<input type="password" id="pw2" autocomplete="off"></label>',
      buttons: [{ text: 'Batal' }, {
        text: 'Simpan', cls: 'primary',
        onClick: async function (m) {
          const a = m.$('#pw0').value, b = m.$('#pw1').value, c = m.$('#pw2').value;
          if (b.length < 6) { U.toast('Password baru minimal 6 karakter.', 'err'); return false; }
          if (b !== c) { U.toast('Pengulangan password tidak sama.', 'err'); return false; }
          await U.api('gantiPassword', { lama: a, baru: b });
          U.toast('Password berhasil diganti.', 'ok');
        }
      }]
    });
  };

  /* ---------- login ---------- */
  U.showLogin = function (msg) {
    U.clearTimers();
    document.title = (S.settings.nama_aplikasi || 'Ujian Online') + ' – Masuk';
    const lg = U.logoUrl(), nama = S.settings.nama_aplikasi || 'Ujian Online';
    const img = lg ? '<img src="' + U.esc(lg) + '" alt="" onerror="this.outerHTML=\'<span class=&quot;logo-ph&quot;>' + U.esc(nama.charAt(0)) + '</span>\'">'
                   : '<span class="logo-ph">' + U.esc(nama.charAt(0)) + '</span>';
    U.app.innerHTML =
      '<div class="login-wrap"><div class="login-card">' +
      '<div class="login-brand">' + img + '<div><div class="lb-school">' + U.esc(S.settings.nama_sekolah || '') + '</div><h1>' + U.esc(nama) + '</h1>' +
      '<div class="lb-year">Tahun Ajaran ' + U.esc(S.settings.tahun_ajaran || '') + '</div></div></div>' +
      '<form id="f-login" autocomplete="off">' +
      (msg ? '<div class="alert err">' + U.esc(msg) + '</div>' : '') +
      (U.bootError ? '<div class="alert warn">' + U.esc(U.bootError) + '</div>' : '') +
      '<label>Username / NIS<input name="username" required autofocus autocapitalize="off" autocorrect="off" spellcheck="false"></label>' +
      '<label>Password<div class="pwbox"><input name="password" type="password" required autocomplete="off"><button type="button" id="b-eye">Lihat</button></div></label>' +
      '<button class="btn primary block" type="submit" id="b-login">Masuk</button></form>' +
      '<div class="note" style="padding-top:14px">Siswa memakai <b>NIS</b> sebagai username. Lupa password? Hubungi guru atau admin.</div>' +
      '</div></div>';
    const f = U.$('#f-login');
    U.$('#b-eye').onclick = function () {
      const i = f.elements.password; i.type = i.type === 'password' ? 'text' : 'password';
      this.textContent = i.type === 'password' ? 'Lihat' : 'Sembunyi';
    };
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      const b = U.$('#b-login'); b.disabled = true; b.textContent = 'Memeriksa…';
      try {
        const r = await U.api('login', { username: f.elements.username.value, password: f.elements.password.value });
        S.token = r.token; S.user = r.user; S.settings = r.settings || S.settings;
        sessionStorage.setItem('uo_tok', S.token);
        U.route();
      } catch (e) {
        b.disabled = false; b.textContent = 'Masuk';
        U.toast(e.message, 'err', 5000);
      }
    };
  };

  U.logout = async function () {
    try { await U.api('logout', {}, { noAuthRedirect: true, timeout: 8000 }); } catch (e) { /* abaikan */ }
    U.clearTimers();
    S.token = null; S.user = null;
    sessionStorage.removeItem('uo_tok');
    U.showLogin();
  };

  U.route = function () {
    U.clearTimers();
    document.title = (S.settings.nama_aplikasi || 'Ujian Online');
    if (S.user.role === 'siswa') U.renderSiswa(); else U.renderStaff();
  };

  U.boot = async function () {
    U.app = document.getElementById('app');
    const tok = sessionStorage.getItem('uo_tok');
    if (tok) {
      S.token = tok;
      try {
        const r = await U.api('me', {}, { noAuthRedirect: true });
        S.user = r.user; S.settings = r.settings || {};
        return U.route();
      } catch (e) { S.token = null; sessionStorage.removeItem('uo_tok'); }
    }
    try { S.settings = await U.api('publik'); }
    catch (e) { U.bootError = e.config ? e.message : 'Tidak dapat terhubung ke server: ' + e.message; }
    U.showLogin();
  };
})();
