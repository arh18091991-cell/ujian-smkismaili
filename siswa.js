/* ===== siswa.js – dasbor siswa & layar ujian (full screen + deteksi pelanggaran) ===== */
(function () {
  'use strict';
  const U = window.U, S = U.S, esc = U.esc;
  const LET = ['A', 'B', 'C', 'D', 'E'];

  const STATE = {
    siap: { t: 'Siap dikerjakan', c: 'ok', btn: 'Mulai Ujian' },
    mengerjakan: { t: 'Sedang dikerjakan', c: 'warn', btn: 'Lanjutkan Ujian' },
    terkunci: { t: 'Terkunci', c: 'bad', btn: 'Buka Halaman Ujian' },
    belum: { t: 'Belum dimulai', c: 'gray' },
    berakhir: { t: 'Waktu berakhir', c: 'gray' },
    selesai: { t: 'Selesai', c: 'ok' }
  };

  /* =============================== BERANDA SISWA =============================== */
  U.renderSiswa = function () {
    const u = S.user;
    U.app.innerHTML =
      '<div class="topbar">' + U.brand() +
      '<div class="tb-right"><div class="who"><b>' + esc(u.nama) + '</b><span>Kelas ' + esc(u.kelas || '-') + ' · NIS ' + esc(u.username) + '</span></div>' +
      '<button class="btn ghost sm" id="b-pw">Ganti Password</button><button class="btn ghost sm" id="b-out">Keluar</button></div></div>' +
      '<main class="container narrow">' +
      '<section class="card hero"><h2>Selamat datang, ' + esc(u.nama.split(' ')[0]) + '!</h2><p>Pilih ujian di bawah ini. Pastikan baterai dan koneksi internet stabil sebelum mulai.</p></section>' +
      '<section class="card rules mt"><h3>Aturan Ujian</h3><ul>' +
      '<li>Saat ujian dimulai, layar akan masuk mode <b>layar penuh</b>.</li>' +
      '<li>Dilarang pindah tab, membuka aplikasi/browser lain, atau keluar dari layar penuh.</li>' +
      '<li>Setiap pelanggaran <b>tercatat otomatis</b> dan dilihat oleh pengawas.</li>' +
      '<li>Jika batas pelanggaran tercapai, ujian akan <b>terkunci</b> atau dikumpulkan otomatis.</li>' +
      '<li>Jawaban tersimpan otomatis. Kumpulkan sebelum waktu habis.</li></ul></section>' +
      '<div class="sec-head"><h3>Daftar Ujian</h3><button class="btn sm" id="b-ref">Muat ulang</button></div>' +
      '<div id="ujian-list" class="ujian-grid"><div class="card empty">Memuat…</div></div></main>';
    U.$('#b-out').onclick = U.logout;
    U.$('#b-pw').onclick = function () { U.passwordModal && U.passwordModal(); };
    U.$('#b-ref').onclick = loadList;
    loadList();
    U.every(loadList, 30000);
  };

  let listBusy = false, lastList = [];
  async function loadList() {
    const box = U.$('#ujian-list');
    if (!box || listBusy) return;
    listBusy = true;
    try {
      const r = await U.api('s_ujianList', {});
      lastList = r.ujian;
      box.innerHTML = r.ujian.length ? r.ujian.map(card).join('') : '<div class="card empty">Belum ada ujian untuk kelas Anda saat ini.</div>';
      U.$$('[data-start]', box).forEach(function (b) {
        b.onclick = function () { startFlow(lastList.filter(function (x) { return x.id === b.getAttribute('data-start'); })[0]); };
      });
    } catch (e) {
      if (box) box.innerHTML = '<div class="alert err" style="grid-column:1/-1">' + esc(e.message) + '</div>';
    } finally { listBusy = false; }
  }

  function card(u) {
    const st = STATE[u.state] || STATE.belum;
    let foot = '';
    if (st.btn) foot = '<button class="btn ' + (u.state === 'siap' ? 'primary' : 'ok') + ' block" data-start="' + esc(u.id) + '">' + st.btn + '</button>';
    else if (u.state === 'selesai') foot = u.nilai !== undefined ? '<div>Nilai Anda <span class="nilai-big">' + esc(u.nilai) + '</span></div>' : '<div class="muted small">Jawaban sudah dikumpulkan. Hasil diumumkan guru.</div>';
    else if (u.state === 'belum') foot = '<div class="muted small">Dibuka ' + esc(U.fmtJadwal(u.mulai)) + ' WIB</div>';
    else foot = '<div class="muted small">Ujian sudah ditutup.</div>';
    return '<article class="card ujian-card st-' + esc(u.state) + '"><div class="uc-top"><span class="badge ' + st.c + '">' + st.t + '</span><span class="small muted">' + esc(u.mapel) + '</span></div>' +
      '<h4>' + esc(u.nama) + '</h4><ul class="meta"><li>Durasi: <b>' + u.durasi + ' menit</b></li>' +
      '<li>Jadwal: ' + esc(U.fmtJadwal(u.mulai)) + ' – ' + esc(U.fmtJadwal(u.selesai)) + '</li></ul><div class="uc-foot">' + foot + '</div></article>';
  }

  /* =============================== PERSIAPAN =============================== */
  function startFlow(u) {
    if (!u) return;
    const resume = u.state === 'mengerjakan' || u.state === 'terkunci';
    const wajib = S.settings.wajib_fullscreen !== 'tidak';
    const fsOk = U.fsSupported();
    const needKode = !resume && u.butuh_token;
    const body =
      '<div class="alert info"><b>' + esc(u.nama) + '</b><br>' + esc(u.mapel) + ' · ' + u.durasi + ' menit</div>' +
      '<ul class="small" style="padding-left:18px;margin:0 0 14px;color:#33475b">' +
      '<li>Layar akan masuk mode <b>layar penuh</b> setelah Anda menekan tombol mulai.</li>' +
      '<li>Jangan pindah tab/aplikasi atau menekan tombol <b>Esc</b>. Itu dihitung pelanggaran.</li>' +
      '<li>Salin, tempel, dan klik kanan dinonaktifkan selama ujian.</li></ul>' +
      (needKode ? '<label>Token ujian (dari pengawas)<input id="i-kode" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase"></label>' : '') +
      (!fsOk && wajib ? '<div class="alert warn">Browser/perangkat ini tidak mendukung layar penuh (misalnya iPhone/iPad). Ujian tetap bisa dikerjakan, namun pindah tab/aplikasi tetap dicatat. Disarankan memakai laptop atau Android.</div>' : '') +
      '<label class="chk"><input type="checkbox" id="c-ok"> Saya sudah membaca dan menyetujui aturan di atas.</label>';
    U.modal({
      title: resume ? 'Lanjutkan Ujian' : 'Persiapan Ujian', sticky: true, body: body,
      buttons: [
        { text: 'Batal' },
        {
          text: resume ? 'Lanjutkan' : 'Mulai Ujian', cls: 'primary',
          onClick: async function (m) {
            if (!m.$('#c-ok').checked) { U.toast('Centang persetujuan terlebih dahulu.', 'err'); return false; }
            const kodeEl = m.$('#i-kode'), kode = kodeEl ? kodeEl.value.trim() : '';
            if (kodeEl && !kode) { U.toast('Masukkan token ujian.', 'err'); return false; }
            const fs = await U.enterFs(); // dipanggil langsung dari klik => diizinkan browser
            if (wajib && fsOk && !fs.ok) { U.toast('Gagal masuk layar penuh. Izinkan layar penuh lalu coba lagi.', 'err', 5000); return false; }
            let P;
            try { P = await U.api('s_mulai', { ujian_id: u.id, kode: kode }); }
            catch (e) { U.exitFs(); U.toast(e.message, 'err', 5500); return false; }
            startExam(P, { useFs: !!fs.ok });
          }
        }
      ]
    });
  }

  /* =============================== LAYAR UJIAN =============================== */
  function startExam(P, opts) {
    U.clearTimers();
    const wajib = S.settings.wajib_fullscreen !== 'tidak';
    const E = {
      id: P.hasil_id, soal: P.soal, idx: 0, ans: P.jawaban || {}, ragu: P.ragu || {},
      deadline: Date.now() + P.sisa * 1000, frozen: P.sisa, langgar: P.langgar || 0, maks: P.maks || 0, aksi: P.aksi || 'kunci',
      locked: P.status === 'terkunci', done: false, submitting: false, saving: false, dirty: false, ovOpen: false,
      ignoreUntil: Date.now() + 3500, lastFlag: 0, flagTimer: null, pending: [],
      font: 17, useFs: !!opts.useFs, enforceFs: wajib && U.fsSupported()
    };
    try { // gabungkan cadangan lokal (jika koneksi sempat putus)
      const bk = JSON.parse(localStorage.getItem('uo_bk_' + E.id) || 'null');
      if (bk && bk.ans) { Object.assign(E.ans, bk.ans); Object.assign(E.ragu, bk.ragu || {}); }
    } catch (e) { /* abaikan */ }

    U.app.innerHTML =
      '<div class="exam" id="exam">' +
      '<header class="ex-head">' + U.brand() +
      '<div class="ex-user"><b>' + esc(S.user.nama) + '</b><small>' + esc(S.user.kelas || '') + ' · ' + esc(P.ujian.nama) + '</small></div>' +
      '<div class="ex-tools"><button class="btn sm" id="b-fm" type="button" title="Perkecil huruf">A−</button><button class="btn sm" id="b-fp" type="button" title="Perbesar huruf">A+</button><button class="btn sm" id="b-list" type="button">Daftar Soal</button></div>' +
      '<div class="ex-timer" id="timer-box"><small>SISA WAKTU</small><b id="timer">--:--</b></div></header>' +
      '<div class="ex-body" id="ex-body"></div>' +
      '<footer class="ex-foot"><button class="btn" id="b-prev" type="button">← Sebelumnya</button>' +
      '<div class="mid"><label class="ragu"><input type="checkbox" id="c-ragu"> Ragu-ragu</label><span class="net" id="net">Siap</span></div>' +
      '<button class="btn primary" id="b-next" type="button">Selanjutnya →</button></footer>' +
      '<div class="overlay hidden" id="overlay"></div></div>';

    try { U.prefetchSoal(P.soal); } catch (e) { /* abaikan */ }
    const body = U.$('#ex-body'), ov = U.$('#overlay');
    const handlers = [], intervals = [];
    function on(t, ty, fn, o) { t.addEventListener(ty, fn, o); handlers.push([t, ty, fn, o]); }
    function every(fn, ms) { const t = setInterval(fn, ms); intervals.push(t); return t; }

    function answered(q) {
      const v = E.ans[q.id];
      return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== '');
    }
    function backup() {
      try { localStorage.setItem('uo_bk_' + E.id, JSON.stringify({ ts: Date.now(), ans: E.ans, ragu: E.ragu })); } catch (e) { /* penuh */ }
    }
    function setNet(ok) {
      const n = U.$('#net'); if (!n) return;
      if (ok === 'saving') { n.className = 'net'; n.textContent = 'Menyimpan…'; return; }
      n.className = 'net' + (ok ? '' : ' bad');
      n.textContent = ok ? 'Tersimpan ✓' : 'Koneksi terputus – jawaban disimpan di perangkat';
    }

    /* ---------- tampilan soal ---------- */
    function renderQ() {
      const q = E.soal[E.idx], tot = E.soal.length, cur = E.ans[q.id], img = U.imgUrl(q.gambar);
      const typeLbl = q.tipe === 'pg' ? 'Pilih satu jawaban yang paling tepat' : q.tipe === 'pgk' ? 'Pilih satu atau lebih jawaban yang benar' : 'Ketik jawaban singkat Anda';
      let ans;
      if (q.tipe === 'isian') {
        ans = '<input class="isian" id="i-isian" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ketik jawaban di sini" value="' + esc(cur || '') + '">';
      } else {
        ans = q.opsi.map(function (o, i) {
          const on = q.tipe === 'pg' ? cur === o.k : (Array.isArray(cur) && cur.indexOf(o.k) >= 0);
          return '<label class="opt' + (q.tipe === 'pgk' ? ' sq' : '') + (on ? ' on' : '') + '"><input type="' + (q.tipe === 'pg' ? 'radio' : 'checkbox') + '" name="o" value="' + o.k + '"' + (on ? ' checked' : '') + '>' +
            '<span class="lt">' + LET[i] + '</span><span class="tx">' + U.rich(o.t) + '</span></label>';
        }).join('');
      }
      body.innerHTML = '<div class="q-wrap' + (q.wacana ? ' two' : '') + '">' +
        (q.wacana ? '<div class="q-card stim"><div class="stim-label">Wacana</div><div class="q-text">' + U.rich(q.wacana) + '</div></div>' : '') +
        '<div class="q-card"><div class="q-head"><span class="q-no">Soal ' + (E.idx + 1) + ' / ' + tot + '</span><span class="q-type">' + typeLbl + '</span></div>' +
        (img ? '<img class="q-img" src="' + esc(img) + '" alt="Gambar soal" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '') +
        '<div class="q-text">' + U.rich(q.pertanyaan) + '</div><div class="q-ans">' + ans + '</div></div></div>';
      body.scrollTop = 0;
      body.style.fontSize = E.font + 'px';

      if (q.tipe === 'isian') {
        const inp = U.$('#i-isian');
        inp.oninput = function () { E.ans[q.id] = inp.value; changed(); };
      } else {
        U.$$('.opt input', body).forEach(function (inp) {
          inp.onchange = function () {
            if (q.tipe === 'pg') E.ans[q.id] = inp.value;
            else E.ans[q.id] = U.$$('.opt input:checked', body).map(function (x) { return x.value; });
            U.$$('.opt', body).forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
            changed();
          };
        });
      }
      const rg = U.$('#c-ragu');
      rg.checked = !!E.ragu[q.id];
      rg.onchange = function () { E.ragu[q.id] = rg.checked ? 1 : 0; changed(); };
      U.$('#b-prev').disabled = E.idx === 0;
      U.$('#b-next').textContent = E.idx === tot - 1 ? 'Selesai ✓' : 'Selanjutnya →';
    }
    function go(i) { E.idx = Math.max(0, Math.min(E.soal.length - 1, i)); renderQ(); }

    U.$('#b-prev').onclick = function () { go(E.idx - 1); };
    U.$('#b-next').onclick = function () { if (E.idx === E.soal.length - 1) finishFlow(); else go(E.idx + 1); };
    U.$('#b-fm').onclick = function () { E.font = Math.max(14, E.font - 2); body.style.fontSize = E.font + 'px'; };
    U.$('#b-fp').onclick = function () { E.font = Math.min(26, E.font + 2); body.style.fontSize = E.font + 'px'; };
    U.$('#b-list').onclick = openList;

    function openList() {
      const cells = E.soal.map(function (q, i) {
        return '<button type="button" class="nbtn ' + (E.ragu[q.id] ? 'ragu ' : answered(q) ? 'done ' : '') + (i === E.idx ? 'cur' : '') + '" data-i="' + i + '">' + (i + 1) + '</button>';
      }).join('');
      const m = U.modal({
        title: 'Daftar Soal', size: 'lg',
        body: '<div class="nav-grid">' + cells + '</div><div class="legend"><span><i class="d"></i>Sudah dijawab</span><span><i class="r"></i>Ragu-ragu</span><span><i></i>Belum dijawab</span></div>',
        buttons: [{ text: 'Tutup' }, { text: 'Kumpulkan Jawaban', cls: 'ok', onClick: function () { setTimeout(finishFlow, 0); } }]
      });
      m.$$('.nbtn').forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-i')); m.close(); }; });
    }

    function finishFlow() {
      let done = 0, ragu = 0;
      const kosong = [];
      E.soal.forEach(function (q, i) { if (answered(q)) done++; else kosong.push(i + 1); if (E.ragu[q.id]) ragu++; });
      let html = '<div class="result-grid"><div><b>' + done + '</b>Dijawab</div><div><b>' + (E.soal.length - done) + '</b>Belum</div><div><b>' + ragu + '</b>Ragu-ragu</div></div>';
      if (kosong.length) html += '<div class="alert warn">Soal belum dijawab: ' + kosong.join(', ') + '</div>';
      if (ragu) html += '<div class="alert info">Masih ada ' + ragu + ' soal bertanda ragu-ragu.</div>';
      html += '<p class="small muted" style="margin:0">Setelah dikumpulkan, jawaban tidak dapat diubah.</p>';
      U.modal({
        title: 'Kumpulkan Jawaban?', sticky: true, body: html,
        buttons: [{ text: 'Kembali mengerjakan' }, { text: 'Ya, Kumpulkan', cls: 'primary', onClick: function () { submit(false); } }]
      });
    }

    /* ---------- overlay ---------- */
    function showOv(html) {
      U.$$('.modal-wrap').forEach(function (el) { el.remove(); }); // tutup dialog agar tidak menutupi layar peringatan
      ov.innerHTML = html; ov.classList.remove('hidden'); E.ovOpen = true;
    }
    function hideOv() { ov.classList.add('hidden'); ov.innerHTML = ''; E.ovOpen = false; }
    function violationText() { return 'Pelanggaran tercatat: ' + E.langgar + (E.maks ? ' dari ' + E.maks : ''); }

    function showViolation() {
      showOv('<div class="ov-card warn"><div class="ov-icon">⚠️</div><h2>Anda meninggalkan halaman ujian</h2>' +
        '<p>Sistem mendeteksi pindah tab/aplikasi atau keluar dari layar penuh. Kejadian ini <b>dicatat dan dilaporkan ke pengawas</b>.</p>' +
        '<p class="big" id="ov-count">' + esc(violationText()) + '</p>' +
        (E.maks ? '<p class="small">Jika mencapai ' + E.maks + ' pelanggaran, ujian Anda akan ' + (E.aksi === 'kumpulkan' ? 'dikumpulkan otomatis' : 'dikunci') + '.</p>' : '') +
        '<button class="btn primary" id="ov-back" type="button">Kembali ke Ujian</button></div>');
      U.$('#ov-back').onclick = backToExam;
    }
    function showLock() {
      E.locked = true; E.frozen = Math.max(0, Math.ceil((E.deadline - Date.now()) / 1000));
      showOv('<div class="ov-card lock"><div class="ov-icon">🔒</div><h2>Ujian Anda Dikunci</h2>' +
        '<p>Batas pelanggaran tercapai. Panggil <b>pengawas/guru</b> untuk membuka kunci.</p>' +
        '<p class="small">Halaman ini akan otomatis lanjut setelah dibuka. Waktu selama terkunci tidak mengurangi jatah waktu Anda.</p><div class="spin"></div></div>');
    }
    function showUnlocked() {
      showOv('<div class="ov-card okc"><div class="ov-icon">🔓</div><h2>Kunci Dibuka</h2><p>Silakan lanjutkan ujian. Pelanggaran berikutnya tetap dicatat.</p>' +
        '<button class="btn primary" id="ov-back" type="button">Lanjutkan Ujian</button></div>');
      U.$('#ov-back').onclick = backToExam;
    }
    function errorCard(msg, label, fn) {
      showOv('<div class="ov-card lock"><div class="ov-icon">⚠️</div><h2>Terjadi Masalah</h2><p>' + esc(msg) + '</p><button class="btn primary" id="ov-retry" type="button">' + esc(label) + '</button></div>');
      U.$('#ov-retry').onclick = fn;
    }
    async function backToExam() {
      const r = await U.enterFs();
      if (E.enforceFs && !r.ok) { U.toast('Tidak bisa masuk layar penuh. Coba tekan tombol lagi.', 'err'); return; }
      E.ignoreUntil = Date.now() + 3500;
      if (!E.locked && !E.done) hideOv();
    }
    function authLost(msg) {
      if (E.done) return;
      E.done = true; cleanup(); U.exitFs();
      showOv('<div class="ov-card lock"><div class="ov-icon">🚫</div><h2>Sesi Tidak Valid</h2><p>' + esc(msg || 'Sesi berakhir.') + '</p>' +
        '<button class="btn primary" id="ov-out" type="button">Kembali ke Halaman Login</button></div>');
      U.$('#ov-out').onclick = function () { S.token = null; sessionStorage.removeItem('uo_tok'); U.showLogin(); };
    }

    /* ---------- penyimpanan otomatis ---------- */
    let saveTimer = null;
    function changed() {
      E.dirty = true; backup(); setNet('saving');
      clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 4000);
    }
    async function doSave() {
      if (E.done || E.submitting || E.saving) return;
      E.saving = true; E.dirty = false;
      try {
        const r = await U.api('s_simpan', { hasil_id: E.id, jawaban: E.ans, ragu: E.ragu }, { noAuthRedirect: true, timeout: 25000 });
        setNet(true); onResp(r);
      } catch (e) {
        if (e.code === 'AUTH') authLost(e.message);
        else { E.dirty = true; setNet(false); }
      } finally { E.saving = false; }
    }
    function onResp(r) {
      if (E.done) return;
      if (r.status === 'selesai') { finishExam(r.hasil || null, !!r.otomatis); return; }
      if (r.status === 'terkunci') { if (!E.locked) showLock(); return; }
      if (r.status === 'mengerjakan') {
        if (E.locked) {
          E.locked = false; E.langgar = 0; E.deadline = Date.now() + r.sisa * 1000; E.ignoreUntil = Date.now() + 3500;
          showUnlocked(); return;
        }
        if (typeof r.sisa === 'number') E.deadline = Date.now() + r.sisa * 1000;
      }
    }
    setTimeout(function () { if (!E.done) every(function () { if (E.dirty || !E.locked) doSave(); }, 30000); }, Math.random() * 8000);
    every(function () { if (E.locked) doSave(); }, 5000);

    /* ---------- timer ---------- */
    function tick() {
      if (E.done) return;
      const sisa = E.locked ? E.frozen : Math.ceil((E.deadline - Date.now()) / 1000);
      const t = U.$('#timer'), box = U.$('#timer-box');
      if (t) t.textContent = U.fmtDur(sisa);
      if (box) box.className = 'ex-timer' + (sisa <= 60 ? ' crit' : sisa <= 300 ? ' warn' : '');
      if (sisa <= 0 && !E.locked && !E.submitting) {
        showOv('<div class="ov-card warn"><div class="ov-icon">⏰</div><h2>Waktu Habis</h2><p>Jawaban Anda sedang dikumpulkan otomatis…</p><div class="spin"></div></div>');
        submit(true);
      }
    }
    every(tick, 1000); tick();

    /* ---------- kumpulkan ---------- */
    async function submit(auto) {
      if (E.done || E.submitting) return;
      E.submitting = true; clearTimeout(saveTimer);
      if (!auto) showOv('<div class="ov-card"><div class="spin"></div><h2>Mengirim jawaban…</h2><p class="small">Jangan menutup halaman ini.</p></div>');
      let tries = 0;
      for (;;) {
        try {
          const r = await U.api('s_selesai', { hasil_id: E.id, jawaban: E.ans, ragu: E.ragu }, { noAuthRedirect: true, timeout: 30000 });
          E.submitting = false;
          return finishExam(r, auto);
        } catch (e) {
          if (e.code === 'AUTH') { E.submitting = false; return authLost(e.message); }
          tries++;
          const giveUp = (!auto && tries >= 5) || (!e.network && tries >= 3);
          if (giveUp) {
            E.submitting = false;
            return errorCard(e.message + ' Jawaban Anda masih aman di perangkat ini.', 'Coba Kirim Lagi', function () { submit(auto); });
          }
          await U.sleep(Math.min(8000, 1500 * tries));
        }
      }
    }

    async function finishExam(result, otomatis) {
      if (E.done) return;
      E.done = true; E.submitting = false;
      cleanup(); U.exitFs();
      try { localStorage.removeItem('uo_bk_' + E.id); } catch (e) { /* abaikan */ }
      if (!result) {
        try { result = await U.api('s_selesai', { hasil_id: E.id, jawaban: E.ans, ragu: E.ragu }, { noAuthRedirect: true }); }
        catch (e) { result = { tampil: false }; }
      }
      renderResult(result, otomatis);
    }

    function renderResult(r, otomatis) {
      let hasil = '<p class="small muted">Hasil akan diumumkan oleh guru.</p>';
      if (r && r.tampil) {
        hasil = '<div class="nilai-big">' + esc(r.nilai) + '</div><div class="result-grid"><div><b>' + r.benar + '</b>Benar</div><div><b>' + r.salah + '</b>Salah</div><div><b>' + r.kosong + '</b>Kosong</div></div>' +
          (r.nilai >= r.kkm ? '<span class="badge ok">Tuntas</span>' : '<span class="badge bad">Belum tuntas (KKM ' + esc(r.kkm) + ')</span>');
      }
      U.app.innerHTML = '<div class="overlay" style="position:static;min-height:100vh"><div class="ov-card okc"><div class="ov-icon">✅</div><h2>Ujian Selesai</h2>' +
        '<p>' + (otomatis ? 'Waktu habis atau batas pelanggaran tercapai. Jawaban Anda sudah dikumpulkan otomatis.' : 'Jawaban Anda sudah tersimpan. Terima kasih.') + '</p>' + hasil +
        '<p style="margin-top:18px"><button class="btn primary" id="b-home" type="button">Kembali ke Beranda</button></p></div></div>';
      U.$('#b-home').onclick = function () { U.renderSiswa(); };
    }

    /* ---------- deteksi pelanggaran ---------- */
    function queueFlag(jenis) {
      if (E.done || E.locked || E.submitting || Date.now() < E.ignoreUntil) return;
      E.pending.push(jenis);
      if (E.flagTimer) return;
      E.flagTimer = setTimeout(function () {
        E.flagTimer = null;
        const p = E.pending.splice(0);
        flag(p.indexOf('keluar_fullscreen') >= 0 ? 'keluar_fullscreen' : p.indexOf('pindah_tab') >= 0 ? 'pindah_tab' : p[0]);
      }, 250);
    }
    function flag(jenis) {
      if (E.done || E.locked) return;
      const now = Date.now();
      if (E.ovOpen && now - E.lastFlag < 2500) return; // satu rangkaian kejadian dihitung sekali
      E.lastFlag = now;
      E.langgar++;
      showViolation();
      report(jenis, 0);
    }
    async function report(jenis, tries) {
      try {
        const r = await U.api('s_pelanggaran', { hasil_id: E.id, jenis: jenis, ket: jenis === 'keluar_fullscreen' ? 'keluar dari layar penuh' : jenis === 'pindah_tab' ? 'pindah tab/aplikasi' : 'fokus layar hilang' }, { noAuthRedirect: true, timeout: 20000 });
        E.langgar = r.langgar;
        if (r.maks !== undefined) E.maks = r.maks;
        if (r.status === 'selesai') return finishExam(null, true);
        if (r.status === 'terkunci') return showLock();
        const c = U.$('#ov-count'); if (c) c.textContent = violationText();
      } catch (e) {
        if (e.code === 'AUTH') return authLost(e.message);
        if (tries < 6 && !E.done) setTimeout(function () { report(jenis, tries + 1); }, 2500 * (tries + 1));
      }
    }
    function onFsChange() { if (E.useFs && !U.fsActive()) queueFlag('keluar_fullscreen'); }
    function onKey(e) {
      const k = (e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey;
      const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (k === 'f12' || (c && e.shiftKey && ['i', 'j', 'c'].indexOf(k) >= 0) || (c && ['u', 's', 'p'].indexOf(k) >= 0) || (c && k === 'a' && !inInput)) {
        e.preventDefault(); e.stopPropagation(); return false;
      }
      if (c && ['c', 'v', 'x'].indexOf(k) >= 0) e.preventDefault();
      if (k === 'printscreen') { try { navigator.clipboard.writeText(' '); } catch (er) { /* abaikan */ } }
    }
    function block(e) { e.preventDefault(); }

    on(document, 'fullscreenchange', onFsChange);
    on(document, 'webkitfullscreenchange', onFsChange);
    on(document, 'visibilitychange', function () { if (document.hidden) queueFlag('pindah_tab'); });
    on(window, 'blur', function () { queueFlag('kehilangan_fokus'); });
    on(document, 'contextmenu', block);
    on(document, 'copy', block); on(document, 'cut', block); on(document, 'paste', block); on(document, 'dragstart', block);
    on(document, 'keydown', onKey, true);
    on(window, 'beforeunload', function (e) { if (!E.done) { e.preventDefault(); e.returnValue = ''; } });

    function cleanup() {
      handlers.forEach(function (h) { h[0].removeEventListener(h[1], h[2], h[3]); });
      handlers.length = 0;
      intervals.forEach(function (t) { clearInterval(t); }); intervals.length = 0;
      clearTimeout(saveTimer); clearTimeout(E.flagTimer);
    }

    /* ---------- mulai ---------- */
    renderQ();
    if (E.locked) showLock();
    setNet(true);
  }
})();
