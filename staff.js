/* ===== staff.js – dasbor Guru & Admin ===== */
(function () {
  'use strict';
  const U = window.U, S = U.S, esc = U.esc;
  const LET = ['A', 'B', 'C', 'D', 'E'];
  const isAdmin = function () { return S.user.role === 'admin'; };
  let meta = { kelas: [], mapel: [], settings: {} };
  let cur = 'ringkasan';
  const VIEWS = {};
  const TITLES = {
    ringkasan: 'Ringkasan', soal: 'Bank Soal', ujian: 'Jadwal Ujian', monitor: 'Monitoring Ujian', hasil: 'Hasil & Nilai',
    pelanggaran: 'Catatan Pelanggaran', pengguna: 'Manajemen Pengguna', pengaturan: 'Pengaturan Sekolah', akun: 'Akun Saya'
  };

  /* ---------- kerangka ---------- */
  U.renderStaff = async function () {
    const admin = isAdmin();
    const items = [['ringkasan', 'Ringkasan'], ['sep', 'Ujian'], ['soal', 'Bank Soal'], ['ujian', 'Jadwal Ujian'], ['monitor', 'Monitoring'], ['hasil', 'Hasil & Nilai'], ['pelanggaran', 'Pelanggaran']];
    if (admin) items.push(['sep', 'Administrasi'], ['pengguna', 'Pengguna'], ['pengaturan', 'Pengaturan']);
    items.push(['sep', 'Akun'], ['akun', 'Akun Saya']);
    U.app.innerHTML =
      '<div class="shell"><aside class="side" id="side"><div class="side-brand">' + U.brand() +
      '<div class="side-role">Dasbor ' + (admin ? 'Admin' : 'Guru') + '</div></div><nav>' +
      items.map(function (i) {
        return i[0] === 'sep' ? '<div class="nav-sep">' + esc(i[1]) + '</div>' : '<button class="nav-i" data-v="' + i[0] + '" type="button">' + esc(i[1]) + '</button>';
      }).join('') +
      '</nav><div class="side-foot"><b>' + esc(S.user.nama) + '</b>' + esc(S.user.username) + ' · ' + (admin ? 'Admin' : 'Guru') +
      '<div style="margin-top:10px"><button class="btn sm block" id="b-out" type="button">Keluar</button></div></div></aside>' +
      '<div class="main-col"><header class="top"><button class="btn sm burger" id="burger" type="button">☰</button><h2 id="page-title"></h2></header>' +
      '<main class="view" id="view"></main></div></div>';
    U.$$('.nav-i').forEach(function (b) { b.onclick = function () { U.go(b.getAttribute('data-v')); }; });
    U.$('#b-out').onclick = U.logout;
    U.$('#burger').onclick = function () { U.$('#side').classList.toggle('open'); };
    try { meta = await U.api('g_meta'); } catch (e) { /* tampil di view */ }
    U.go('ringkasan');
  };

  U.go = async function (name, params) {
    U.clearTimers();
    cur = name;
    U.$$('.nav-i').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === name); });
    U.$('#page-title').textContent = TITLES[name] || '';
    U.$('#side').classList.remove('open');
    const view = U.$('#view'), box = document.createElement('div');
    view.innerHTML = ''; view.appendChild(box);
    box.innerHTML = '<div class="empty">Memuat…</div>';
    try { await VIEWS[name](box, params || {}); }
    catch (e) { box.innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; }
  };

  function poll(box, fn, ms) {
    const t = U.every(function () { if (!box.isConnected) { clearInterval(t); return; } fn(); }, ms);
  }
  function table(cols, rows, empty) {
    if (!rows.length) return '<div class="tablewrap"><div class="empty">' + esc(empty || 'Belum ada data.') + '</div></div>';
    return '<div class="tablewrap"><table><thead><tr>' + cols.map(function (c) { return '<th class="' + (c.cls || '') + '">' + c.h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r, i) {
        return '<tr>' + cols.map(function (c) { return '<td class="' + (c.cls || '') + '">' + c.f(r, i) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
  function toInput(ms) { return new Date(ms + 7 * 3600e3).toISOString().slice(0, 16); }
  function opts(list, sel, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) {
      const v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x;
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
  }
  const STATUS = {
    belum: ['Belum mulai', 'gray'], mengerjakan: ['Mengerjakan', 'warn'], terkunci: ['Terkunci', 'bad'], selesai: ['Selesai', 'ok']
  };
  function sbadge(s) { const x = STATUS[s] || [s, 'gray']; return '<span class="badge ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  const JENIS = { keluar_fullscreen: 'Keluar layar penuh', pindah_tab: 'Pindah tab/aplikasi', kehilangan_fokus: 'Fokus layar hilang', lainnya: 'Lainnya' };

  /* =============================== RINGKASAN =============================== */
  VIEWS.ringkasan = async function (box) {
    async function load() {
      const d = await U.api('g_ringkasan');
      const st = function (cls, n, t) { return '<div class="card stat ' + cls + '"><b>' + n + '</b><span>' + t + '</span></div>'; };
      box.innerHTML = '<div class="stats">' +
        st('', d.soal, 'Butir soal') + st('', d.ujian, 'Jadwal ujian') + st('ok', d.ujian_aktif, 'Ujian aktif') +
        st('warn', d.sedang_ujian, 'Sedang mengerjakan') + st('ok', d.selesai, 'Peserta selesai') + st('bad', d.pelanggaran_hari_ini, 'Pelanggaran hari ini') +
        (d.siswa !== undefined ? st('', d.siswa, 'Siswa') + st('', d.guru, 'Guru') : '') + '</div>' +
        '<div class="sec-head" style="margin-top:0"><h3>Ujian yang sedang berlangsung</h3></div>' +
        table([
          { h: 'Ujian', f: function (r) { return '<b>' + esc(r.nama) + '</b><div class="small muted">' + esc(r.mapel) + '</div>'; } },
          { h: 'Ditutup', f: function (r) { return esc(U.fmtJadwal(r.selesai)); } },
          { h: '', cls: 'right', f: function (r) { return '<button class="btn sm primary" data-mon="' + esc(r.id) + '">Pantau</button>'; } }
        ], d.berlangsung, 'Tidak ada ujian yang sedang berlangsung.');
      U.$$('[data-mon]', box).forEach(function (b) { b.onclick = function () { U.go('monitor', { ujian: b.getAttribute('data-mon') }); }; });
    }
    await load();
    poll(box, load, 15000);
  };

  /* =============================== BANK SOAL =============================== */
  VIEWS.soal = async function (box) {
    let list = await U.api('g_soalList', {});
    const sel = {};
    box.innerHTML =
      '<div class="toolbar"><select id="f-mapel"></select><input id="soal-q" class="grow" placeholder="Cari pertanyaan…">' +
      '<button class="btn primary" id="b-add" type="button">+ Tambah Soal</button><button class="btn" id="b-imp" type="button">Import dari Excel</button>' +
      '<button class="btn danger" id="b-del" type="button" disabled>Hapus</button></div><div id="soal-tbl"></div>';
    function draw() {
      const mapels = uniq(list.map(function (q) { return q.mapel; })).sort();
      const fm = U.$('#f-mapel', box), keep = fm.value;
      fm.innerHTML = opts(mapels, keep, 'Semua mapel');
      const mp = fm.value, qs = U.$('#soal-q', box).value.toLowerCase();
      const rows = list.filter(function (q) { return (!mp || q.mapel === mp) && (!qs || q.pertanyaan.toLowerCase().indexOf(qs) >= 0); });
      const nSel = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
      U.$('#b-del', box).disabled = !nSel;
      U.$('#b-del', box).textContent = nSel ? 'Hapus (' + nSel + ')' : 'Hapus';
      const TIPE = { pg: 'Pilihan ganda', pgk: 'PG kompleks', isian: 'Isian' };
      U.$('#soal-tbl', box).innerHTML = table([
        { h: '<input type="checkbox" id="ck-all">', f: function (q) { return '<input type="checkbox" data-sel="' + esc(q.id) + '"' + (sel[q.id] ? ' checked' : '') + '>'; } },
        { h: 'No', f: function (q, i) { return i + 1; } },
        { h: 'Mapel', f: function (q) { return esc(q.mapel) + (q.kelas ? '<div class="small muted">' + esc(q.kelas) + '</div>' : ''); } },
        { h: 'Tipe', f: function (q) { return '<span class="badge">' + TIPE[q.tipe] + '</span>'; } },
        { h: 'Pertanyaan', f: function (q) { return esc(cut(q.pertanyaan, 110)) + (q.wacana ? ' <span class="badge gray">wacana</span>' : '') + (q.gambar ? ' <span class="badge gray">gambar</span>' : ''); } },
        { h: 'Kunci', f: function (q) { return '<b class="mono">' + esc(cut(q.kunci, 22)) + '</b>'; } },
        { h: 'Bobot', cls: 'num', f: function (q) { return q.bobot; } },
        { h: '', cls: 'right', f: function (q) { return '<button class="btn sm" data-edit="' + esc(q.id) + '">Edit</button>'; } }
      ], rows, list.length ? 'Tidak ada soal yang cocok.' : 'Bank soal masih kosong. Klik "+ Tambah Soal" atau "Import dari Excel".');
      U.$$('[data-sel]', box).forEach(function (c) { c.onchange = function () { sel[c.getAttribute('data-sel')] = c.checked; draw(); }; });
      const all = U.$('#ck-all', box);
      if (all) all.onchange = function () { rows.forEach(function (q) { sel[q.id] = all.checked; }); draw(); };
      U.$$('[data-edit]', box).forEach(function (b) {
        b.onclick = function () { soalForm(list.filter(function (q) { return q.id === b.getAttribute('data-edit'); })[0], reload); };
      });
    }
    async function reload() { list = await U.api('g_soalList', {}); try { meta = await U.api('g_meta'); } catch (e) { /* abaikan */ } draw(); }
    U.$('#f-mapel', box).onchange = draw;
    U.$('#soal-q', box).oninput = draw;
    U.$('#b-add', box).onclick = function () { soalForm(null, reload, U.$('#f-mapel', box).value); };
    U.$('#b-imp', box).onclick = function () { soalImport(reload); };
    U.$('#b-del', box).onclick = async function () {
      const ids = Object.keys(sel).filter(function (k) { return sel[k]; });
      if (!(await U.confirm('Hapus ' + ids.length + ' soal terpilih? Tindakan ini tidak dapat dibatalkan.', { danger: true, okText: 'Hapus' }))) return;
      const r = await U.api('g_soalDelete', { ids: ids });
      Object.keys(sel).forEach(function (k) { delete sel[k]; });
      U.toast(r.dihapus + ' soal dihapus.', 'ok');
      reload();
    };
    draw();
  };

  function soalForm(q, done, defMapel) {
    q = q || { tipe: 'pg', bobot: 1, mapel: defMapel || '' };
    const keys = String(q.kunci || '').split(',');
    const rows = LET.map(function (k) {
      return '<div class="opsi-row"><span class="lt">' + k + '</span><input type="text" data-o="' + k + '" value="' + esc(q[k] || '') + '" placeholder="Pilihan ' + k + '">' +
        '<label class="key"><input type="checkbox" data-k="' + k + '"' + (keys.indexOf(k) >= 0 && q.tipe !== 'isian' ? ' checked' : '') + '> Kunci</label></div>';
    }).join('');
    U.modal({
      title: q.id ? 'Edit Soal' : 'Tambah Soal', size: 'lg', sticky: true,
      body:
        '<datalist id="dl-mapel">' + (meta.mapel || []).map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist>' +
        '<div class="grid2"><label>Mata pelajaran<input id="f-mp" list="dl-mapel" value="' + esc(q.mapel) + '"></label>' +
        '<label>Tipe soal<select id="f-tipe"><option value="pg">Pilihan ganda</option><option value="pgk">Pilihan ganda kompleks</option><option value="isian">Isian singkat</option></select></label>' +
        '<label>Kelas (opsional, hanya catatan)<input id="f-kls" value="' + esc(q.kelas || '') + '"></label>' +
        '<label>Bobot nilai<input id="f-bobot" type="number" min="0.5" step="0.5" value="' + esc(q.bobot || 1) + '"></label></div>' +
        '<label>Wacana / stimulus (opsional)<textarea id="f-wac" rows="3">' + esc(q.wacana || '') + '</textarea></label>' +
        '<label>Gambar (URL, opsional — boleh link Google Drive yang dibagikan publik)<input id="f-img" value="' + esc(q.gambar || '') + '" placeholder="https://…"></label>' +
        '<label>Pertanyaan<textarea id="f-q" rows="3">' + esc(q.pertanyaan || '') + '</textarea></label>' +
        '<div id="box-opsi"><div class="small muted" style="margin-bottom:6px;font-weight:600">Pilihan jawaban (kosongkan yang tidak dipakai) dan centang kunci</div>' + rows + '</div>' +
        '<div id="box-isian" class="hidden"><label>Kunci jawaban isian<input id="f-isian" value="' + esc(q.tipe === 'isian' ? q.kunci : '') + '"><div class="hint">Boleh lebih dari satu jawaban benar, pisahkan dengan tanda | (contoh: Jakarta|DKI Jakarta). Huruf besar/kecil tidak dibedakan.</div></label></div>',
      onOpen: function (m) {
        const tipe = m.$('#f-tipe');
        tipe.value = q.tipe || 'pg';
        function sync() {
          const t = tipe.value;
          m.$('#box-opsi').classList.toggle('hidden', t === 'isian');
          m.$('#box-isian').classList.toggle('hidden', t !== 'isian');
          let first = false;
          m.$$('[data-k]').forEach(function (i) {
            if (t === 'pg') { i.type = 'radio'; i.name = 'kunci'; if (i.checked) { if (first) i.checked = false; else first = true; } }
            else { i.type = 'checkbox'; i.name = ''; }
          });
        }
        tipe.onchange = sync; sync();
      },
      buttons: [{ text: 'Batal' }, {
        text: 'Simpan', cls: 'primary',
        onClick: async function (m) {
          const t = m.$('#f-tipe').value, d = {
            id: q.id, mapel: m.$('#f-mp').value, kelas: m.$('#f-kls').value, tipe: t, bobot: m.$('#f-bobot').value,
            wacana: m.$('#f-wac').value, gambar: m.$('#f-img').value, pertanyaan: m.$('#f-q').value
          };
          LET.forEach(function (k) { d[k] = m.$('[data-o="' + k + '"]').value; });
          d.kunci = t === 'isian' ? m.$('#f-isian').value : m.$$('[data-k]').filter(function (i) { return i.checked; }).map(function (i) { return i.getAttribute('data-k'); }).join(',');
          await U.api('g_soalSave', d);
          U.toast('Soal disimpan.', 'ok');
          if (done) done();
        }
      }]
    });
  }

  function soalImport(done) {
    const COLS = ['mapel', 'tipe', 'pertanyaan', 'A', 'B', 'C', 'D', 'E', 'kunci', 'bobot', 'wacana', 'gambar', 'kelas'];
    U.modal({
      title: 'Import Soal dari Excel', size: 'lg', sticky: true,
      body:
        '<div class="alert info small">Salin baris dari Excel/Google Sheets (Ctrl+C), lalu tempel di kotak di bawah. Urutan kolom:<br>' +
        '<span class="mono">mapel | tipe | pertanyaan | A | B | C | D | E | kunci | bobot | wacana | gambar | kelas</span><br>' +
        'Tipe: <b>pg</b> (pilihan ganda), <b>pgk</b> (kompleks, kunci mis. A,C), <b>isian</b> (kunci mis. Jakarta|DKI Jakarta). Kolom bobot, wacana, gambar, kelas boleh kosong.</div>' +
        '<textarea id="i-paste" class="field mono" rows="9" placeholder="Tempel di sini…" style="white-space:pre"></textarea><div class="hint" id="i-cnt">0 baris terbaca</div>' +
        '<p><button class="btn sm" id="b-tpl" type="button">Unduh template CSV</button></p>',
      onOpen: function (m) {
        m.$('#i-paste').oninput = function () { m.$('#i-cnt').textContent = U.parseTable(m.$('#i-paste').value, COLS).length + ' baris terbaca'; };
        m.$('#b-tpl').onclick = function () {
          U.downloadCsv('template-soal.csv', [COLS,
            ['Matematika', 'pg', '2 + 2 = ?', '3', '4', '5', '6', '', 'B', '1', '', '', 'X'],
            ['Matematika', 'pgk', 'Pilih bilangan prima', '2', '4', '5', '9', '', 'A,C', '2', '', '', 'X'],
            ['Matematika', 'isian', 'Ibukota Indonesia?', '', '', '', '', '', 'Jakarta|DKI Jakarta', '1', '', '', 'X']]);
        };
      },
      buttons: [{ text: 'Batal' }, {
        text: 'Import', cls: 'primary',
        onClick: async function (m) {
          const rows = U.parseTable(m.$('#i-paste').value, COLS);
          if (!rows.length) { U.toast('Tidak ada data untuk diimport.', 'err'); return false; }
          const r = await U.api('g_soalImport', { rows: rows }, { timeout: 90000 });
          U.toast(r.berhasil + ' soal berhasil diimport' + (r.gagal.length ? ', ' + r.gagal.length + ' gagal.' : '.'), r.gagal.length ? '' : 'ok', 5000);
          if (r.gagal.length) {
            U.modal({
              title: 'Baris yang gagal', body: '<ul class="small">' + r.gagal.slice(0, 60).map(function (g) { return '<li>Baris ' + g.baris + ': ' + esc(g.alasan) + '</li>'; }).join('') + '</ul>',
              buttons: [{ text: 'Tutup' }]
            });
          }
          if (done) done();
        }
      }]
    });
  }

  /* =============================== JADWAL UJIAN =============================== */
  VIEWS.ujian = async function (box) {
    let list = await U.api('g_ujianList');
    box.innerHTML = '<div class="toolbar"><button class="btn primary" id="b-add" type="button">+ Buat Ujian</button><span class="muted small">Atur jadwal, token, aturan pelanggaran, dan soal yang dipakai.</span></div><div id="uj-tbl"></div>';
    function draw() {
      U.$('#uj-tbl', box).innerHTML = table([
        { h: 'Ujian', f: function (u) { return '<b>' + esc(u.nama) + '</b><div class="small muted">' + esc(u.mapel) + (isAdmin() && u.guru ? ' · ' + esc(u.guru) : '') + '</div>'; } },
        { h: 'Kelas', f: function (u) { return esc(u.kelas); } },
        { h: 'Jadwal (WIB)', f: function (u) { return esc(U.fmtJadwal(u.mulai)) + '<div class="small muted">s.d. ' + esc(U.fmtJadwal(u.selesai)) + '</div>'; } },
        { h: 'Durasi', cls: 'num', f: function (u) { return u.durasi + ' mnt'; } },
        { h: 'Soal', cls: 'num', f: function (u) { return (u.jumlah > 0 ? Math.min(u.jumlah, u.jumlah_soal_tersedia) : u.jumlah_soal_tersedia) + '<div class="small muted">dari ' + u.jumlah_soal_tersedia + '</div>'; } },
        { h: 'Token', f: function (u) { return u.token ? '<b class="mono">' + esc(u.token) + '</b>' : '<span class="muted">–</span>'; } },
        { h: 'Peserta', cls: 'num', f: function (u) { return u.peserta_selesai + ' / ' + u.peserta_mulai + '<div class="small muted">selesai / mulai</div>'; } },
        { h: 'Status', f: function (u) { return '<span class="badge ' + (u.status === 'aktif' ? 'ok' : 'gray') + '">' + esc(u.status) + '</span>'; } },
        {
          h: '', cls: 'right nowrap', f: function (u) {
            return '<button class="btn sm primary" data-mon="' + esc(u.id) + '">Pantau</button> <button class="btn sm" data-hs="' + esc(u.id) + '">Hasil</button> ' +
              '<button class="btn sm" data-ed="' + esc(u.id) + '">Edit</button> <button class="btn sm danger" data-rm="' + esc(u.id) + '">Hapus</button>';
          }
        }
      ], list, 'Belum ada jadwal ujian. Klik "+ Buat Ujian".');
      const find = function (id) { return list.filter(function (u) { return u.id === id; })[0]; };
      U.$$('[data-mon]', box).forEach(function (b) { b.onclick = function () { U.go('monitor', { ujian: b.getAttribute('data-mon') }); }; });
      U.$$('[data-hs]', box).forEach(function (b) { b.onclick = function () { U.go('hasil', { ujian: b.getAttribute('data-hs') }); }; });
      U.$$('[data-ed]', box).forEach(function (b) { b.onclick = function () { ujianForm(find(b.getAttribute('data-ed')), reload); }; });
      U.$$('[data-rm]', box).forEach(function (b) {
        b.onclick = async function () {
          const u = find(b.getAttribute('data-rm'));
          if (!(await U.confirm('Hapus ujian "' + u.nama + '"?', { danger: true, okText: 'Hapus' }))) return;
          try { await U.api('g_ujianDelete', { id: u.id }); U.toast('Ujian dihapus.', 'ok'); reload(); }
          catch (e) {
            if (isAdmin() && /sudah punya/.test(e.message) && (await U.confirm(e.message + '\n\nHapus paksa beserta SEMUA hasilnya?', { danger: true, okText: 'Hapus paksa' }))) {
              await U.api('g_ujianDelete', { id: u.id, paksa: true }); U.toast('Ujian dan hasilnya dihapus.', 'ok'); reload();
            } else U.toast(e.message, 'err', 6000);
          }
        };
      });
    }
    async function reload() { list = await U.api('g_ujianList'); draw(); }
    U.$('#b-add', box).onclick = function () { ujianForm(null, reload); };
    draw();
  };

  async function ujianForm(u, done) {
    try { meta = await U.api('g_meta'); } catch (e) { /* pakai meta lama */ }
    const set = meta.settings || {};
    const now = Date.now(), start = Math.ceil(now / 900000) * 900000;
    u = u || { nama: '', mapel: '', kelas: '', durasi: 60, mulai: '', selesai: '', jumlah: 0, acak_soal: 'ya', acak_opsi: 'ya', kkm: set.kkm_default || 75, token: '', status: 'aktif', soal_ids: '', maks_langgar: set.maks_langgar_default || 3, aksi_langgar: 'kunci', tampil_nilai: 'tidak' };
    const mulai = u.mulai ? u.mulai.replace(' ', 'T') : toInput(start), selesai = u.selesai ? u.selesai.replace(' ', 'T') : toInput(start + 3 * 3600e3);
    const chosen = String(u.soal_ids || '').split(',').filter(Boolean);
    const m = U.modal({
      title: u.id ? 'Edit Ujian' : 'Buat Ujian', size: 'lg', sticky: true,
      body:
        '<datalist id="dl-m">' + (meta.mapel || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
        '<datalist id="dl-k">' + (meta.kelas || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
        '<div class="grid2"><label>Nama ujian<input id="u-nama" value="' + esc(u.nama) + '" placeholder="mis. PTS Matematika Ganjil"></label>' +
        '<label>Mata pelajaran (sesuai bank soal)<input id="u-mapel" list="dl-m" value="' + esc(u.mapel) + '"></label>' +
        '<label>Kelas peserta<input id="u-kelas" list="dl-k" value="' + esc(u.kelas === '*' ? '' : u.kelas) + '" placeholder="kosong = semua kelas"><div class="hint">Beberapa kelas dipisah koma: X-A, X-B</div></label>' +
        '<label>Durasi (menit)<input id="u-dur" type="number" min="1" max="600" value="' + esc(u.durasi) + '"></label>' +
        '<label>Mulai dibuka (WIB)<input id="u-mulai" type="datetime-local" value="' + esc(mulai) + '"></label>' +
        '<label>Ditutup (WIB)<input id="u-selesai" type="datetime-local" value="' + esc(selesai) + '"></label>' +
        '<label>Jumlah soal ditampilkan<input id="u-jml" type="number" min="0" value="' + esc(u.jumlah) + '"><div class="hint">0 = semua soal. Jika lebih kecil, tiap siswa mendapat soal acak.</div></label>' +
        '<label>KKM<input id="u-kkm" type="number" min="0" max="100" value="' + esc(u.kkm) + '"></label>' +
        '<label>Token ujian<div style="display:flex;gap:8px"><input id="u-token" class="mono" value="' + esc(u.token) + '" style="text-transform:uppercase" placeholder="kosong = tanpa token"><button class="btn" type="button" id="u-gen">Acak</button></div></label>' +
        '<label>Status<select id="u-status"><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif (disembunyikan)</option></select></label>' +
        '<label>Batas pelanggaran<input id="u-maks" type="number" min="0" value="' + esc(u.maks_langgar) + '"><div class="hint">0 = hanya dicatat, tidak ada tindakan.</div></label>' +
        '<label>Tindakan jika batas tercapai<select id="u-aksi"><option value="kunci">Kunci (guru membuka)</option><option value="kumpulkan">Kumpulkan otomatis</option></select></label></div>' +
        '<label class="chk"><input type="checkbox" id="u-as"' + (u.acak_soal === 'ya' ? ' checked' : '') + '> Acak urutan soal</label>' +
        '<label class="chk"><input type="checkbox" id="u-ao"' + (u.acak_opsi === 'ya' ? ' checked' : '') + '> Acak urutan pilihan jawaban</label>' +
        '<label class="chk"><input type="checkbox" id="u-tn"' + (u.tampil_nilai === 'ya' ? ' checked' : '') + '> Tampilkan nilai ke siswa setelah selesai</label>' +
        '<div class="small" style="font-weight:600;margin:12px 0 6px">Pilih soal <span class="muted" style="font-weight:400">(tidak ada yang dicentang = semua soal pada mapel ini)</span> ' +
        '<button class="btn sm" type="button" id="u-all">Pilih semua</button> <button class="btn sm" type="button" id="u-none">Kosongkan</button></div>' +
        '<div class="pick" id="u-pick"><span class="muted small">Isi mata pelajaran untuk menampilkan soal.</span></div>',
      onOpen: function (mm) {
        mm.$('#u-status').value = u.status || 'aktif';
        mm.$('#u-aksi').value = u.aksi_langgar || 'kunci';
        mm.$('#u-gen').onclick = function () { mm.$('#u-token').value = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(2, 8).toUpperCase(); };
        let t = null;
        async function loadPick() {
          const mp = mm.$('#u-mapel').value.trim();
          const box = mm.$('#u-pick');
          if (!mp) { box.innerHTML = '<span class="muted small">Isi mata pelajaran untuk menampilkan soal.</span>'; return; }
          try {
            const soal = await U.api('g_soalList', { mapel: mp });
            box.innerHTML = soal.length ? soal.map(function (q, i) {
              return '<label class="chk"><input type="checkbox" value="' + esc(q.id) + '"' + (chosen.indexOf(q.id) >= 0 ? ' checked' : '') + '> <span><b>' + (i + 1) + '.</b> ' + esc(cut(q.pertanyaan, 90)) + '</span></label>';
            }).join('') : '<span class="muted small">Belum ada soal untuk mapel "' + esc(mp) + '".</span>';
          } catch (e) { box.innerHTML = '<span class="muted small">' + esc(e.message) + '</span>'; }
        }
        mm.$('#u-mapel').oninput = function () { clearTimeout(t); t = setTimeout(loadPick, 500); };
        mm.$('#u-all').onclick = function () { mm.$$('#u-pick input').forEach(function (i) { i.checked = true; }); };
        mm.$('#u-none').onclick = function () { mm.$$('#u-pick input').forEach(function (i) { i.checked = false; }); };
        loadPick();
      },
      buttons: [{ text: 'Batal' }, {
        text: 'Simpan', cls: 'primary',
        onClick: async function (mm) {
          const d = {
            id: u.id, nama: mm.$('#u-nama').value, mapel: mm.$('#u-mapel').value, kelas: mm.$('#u-kelas').value,
            durasi: mm.$('#u-dur').value, mulai: mm.$('#u-mulai').value, selesai: mm.$('#u-selesai').value,
            jumlah: mm.$('#u-jml').value, kkm: mm.$('#u-kkm').value, token: mm.$('#u-token').value, status: mm.$('#u-status').value,
            maks_langgar: mm.$('#u-maks').value, aksi_langgar: mm.$('#u-aksi').value,
            acak_soal: mm.$('#u-as').checked, acak_opsi: mm.$('#u-ao').checked, tampil_nilai: mm.$('#u-tn').checked,
            soal_ids: mm.$$('#u-pick input:checked').map(function (i) { return i.value; })
          };
          await U.api('g_ujianSave', d);
          U.toast('Ujian disimpan.', 'ok');
          if (done) done();
        }
      }]
    });
    return m;
  }

  /* =============================== MONITORING =============================== */
  async function pickUjian(box, params, withAll) {
    const list = await U.api('g_ujianList');
    const nowW = toInput(Date.now()).replace('T', ' ');
    const berlangsung = list.filter(function (u) { return u.status === 'aktif' && u.mulai <= nowW && nowW <= u.selesai; })[0];
    const adaPeserta = list.filter(function (u) { return u.peserta_mulai > 0; })[0];
    const pilihan = berlangsung || adaPeserta || list[0];
    const sel = params.ujian || (U.S.lastUjian && list.some(function (u) { return u.id === U.S.lastUjian; }) ? U.S.lastUjian : (pilihan ? pilihan.id : ''));
    return { list: list, sel: sel };
  }

  VIEWS.monitor = async function (box, params) {
    const pk = await pickUjian(box, params);
    if (!pk.list.length) { box.innerHTML = '<div class="card empty">Belum ada ujian. Buat jadwal ujian terlebih dahulu.</div>'; return; }
    let sel = pk.sel;
    box.innerHTML = '<div class="toolbar no-print"><select id="m-uj">' + opts(pk.list.map(function (u) { return { v: u.id, t: u.nama + ' – ' + u.mapel }; }), sel) + '</select>' +
      '<label class="chk" style="margin:0"><input type="checkbox" id="m-auto" checked> Muat otomatis (8 dtk)</label><button class="btn" id="m-ref" type="button">Muat ulang</button><span class="muted small" id="m-time"></span></div><div id="mon"></div>';
    async function load() {
      if (!box.isConnected) return;
      U.S.lastUjian = sel;
      const d = await U.api('g_monitor', { ujian_id: sel });
      const r = d.ringkas;
      const act = function (x) {
        if (x.status === 'belum' || x.status === 'selesai' || x.aktif_detik === null) return '<span class="muted">–</span>';
        if (x.aktif_detik < 75) return '<span class="dot on"></span>online';
        if (x.aktif_detik < 240) return '<span class="dot mid"></span>' + Math.round(x.aktif_detik / 60) + ' mnt lalu';
        return '<span class="dot off"></span>terputus';
      };
      U.$('#mon', box).innerHTML =
        '<div class="chips"><span class="chip">Peserta: ' + d.rows.length + '</span><span class="chip">Belum mulai: ' + r.belum + '</span><span class="chip" style="background:var(--warnl);color:var(--warn)">Mengerjakan: ' + r.mengerjakan + '</span>' +
        '<span class="chip" style="background:var(--badl);color:var(--bad)">Terkunci: ' + r.terkunci + '</span><span class="chip" style="background:var(--okl);color:var(--ok)">Selesai: ' + r.selesai + '</span>' +
        '<span class="chip">Token: <b class="mono">' + esc((pk.list.filter(function (u) { return u.id === sel; })[0] || {}).token || '–') + '</b></span></div>' +
        table([
          { h: 'No', f: function (x, i) { return i + 1; } },
          { h: 'NIS', f: function (x) { return '<span class="mono">' + esc(x.username) + '</span>'; } },
          { h: 'Nama', f: function (x) { return '<b>' + esc(x.nama) + '</b>'; } },
          { h: 'Kelas', f: function (x) { return esc(x.kelas); } },
          { h: 'Status', f: function (x) { return sbadge(x.status); } },
          { h: 'Progres', f: function (x) { return x.total ? '<div class="bar"><i style="width:' + Math.round(x.dijawab / x.total * 100) + '%"></i></div><div class="small muted">' + x.dijawab + ' / ' + x.total + '</div>' : '<span class="muted">–</span>'; } },
          { h: 'Sisa waktu', cls: 'num', f: function (x) { return x.status === 'mengerjakan' || x.status === 'terkunci' ? U.fmtDur(x.sisa) : '–'; } },
          { h: 'Koneksi', f: act },
          { h: 'Pelanggaran', cls: 'num', f: function (x) { return x.total_langgar ? '<b style="color:var(--bad)">' + x.total_langgar + '</b>' : '0'; } },
          { h: 'Nilai', cls: 'num', f: function (x) { return x.status === 'selesai' ? '<b>' + esc(x.nilai) + '</b>' : '–'; } },
          {
            h: '', cls: 'right nowrap', f: function (x) {
              if (!x.hasil_id) return '';
              return (x.status === 'terkunci' ? '<button class="btn sm ok" data-open="' + esc(x.hasil_id) + '">Buka kunci</button> ' : '') +
                (x.status !== 'selesai' ? '<button class="btn sm" data-fin="' + esc(x.hasil_id) + '">Paksa selesai</button> ' : '') +
                '<button class="btn sm danger" data-rst="' + esc(x.hasil_id) + '">Ulang</button>';
            }
          }
        ], d.rows, 'Belum ada peserta untuk ujian ini (periksa kelas peserta dan daftar siswa).');
      U.$('#m-time', box).textContent = 'Diperbarui ' + new Date().toLocaleTimeString('id-ID');
      const guard = function (fn) { return async function () { try { await fn(this); load(); } catch (e) { U.toast(e.message, 'err'); } }; };
      U.$$('[data-open]', box).forEach(function (b) { b.onclick = guard(async function (el) { await U.api('g_buka', { hasil_id: el.getAttribute('data-open') }); U.toast('Kunci dibuka. Siswa dapat melanjutkan.', 'ok'); }); });
      U.$$('[data-fin]', box).forEach(function (b) {
        b.onclick = guard(async function (el) {
          if (!(await U.confirm('Paksa selesai? Jawaban yang sudah tersimpan akan dinilai sekarang.', { okText: 'Ya, selesaikan' }))) return;
          await U.api('g_paksaSelesai', { hasil_id: el.getAttribute('data-fin') }); U.toast('Peserta diselesaikan.', 'ok');
        });
      });
      U.$$('[data-rst]', box).forEach(function (b) {
        b.onclick = guard(async function (el) {
          if (!(await U.confirm('Reset peserta ini? Jawaban & nilai dihapus sehingga ia bisa mengulang dari awal.', { danger: true, okText: 'Reset' }))) return;
          await U.api('g_ulang', { hasil_id: el.getAttribute('data-rst') }); U.toast('Peserta di-reset.', 'ok');
        });
      });
    }
    const safeLoad = function () { load().catch(function (e) { U.toast(e.message, 'err'); }); };
    U.$('#m-uj', box).onchange = function () { sel = this.value; safeLoad(); };
    U.$('#m-ref', box).onclick = safeLoad;
    poll(box, function () { if (U.$('#m-auto', box) && U.$('#m-auto', box).checked) safeLoad(); }, 8000);
    await load();
  };

  /* =============================== HASIL =============================== */
  VIEWS.hasil = async function (box, params) {
    const pk = await pickUjian(box, params);
    if (!pk.list.length) { box.innerHTML = '<div class="card empty">Belum ada ujian.</div>'; return; }
    let sel = pk.sel, data = null;
    box.innerHTML = '<div class="toolbar no-print"><select id="h-uj">' + opts(pk.list.map(function (u) { return { v: u.id, t: u.nama + ' – ' + u.mapel }; }), sel) + '</select>' +
      '<select id="h-kls"></select><button class="btn" id="h-csv" type="button">Unduh CSV</button><button class="btn" id="h-prn" type="button">Cetak</button></div><div id="hs"></div>';
    function view() {
      const kls = U.$('#h-kls', box).value;
      const rows = data.rows.filter(function (r) { return !kls || r.kelas === kls; });
      const fin = rows.filter(function (r) { return r.status === 'selesai' && r.nilai !== ''; }), kkm = data.ujian.kkm;
      const nils = fin.map(function (r) { return r.nilai; });
      const avg = nils.length ? (nils.reduce(function (a, b) { return a + b; }, 0) / nils.length) : 0;
      const tuntas = fin.filter(function (r) { return r.nilai >= kkm; }).length;
      U.$('#hs', box).innerHTML =
        '<div class="stats"><div class="card stat"><b>' + fin.length + '</b><span>Peserta selesai</span></div><div class="card stat"><b>' + (nils.length ? avg.toFixed(1) : '–') + '</b><span>Rata-rata</span></div>' +
        '<div class="card stat ok"><b>' + (nils.length ? Math.max.apply(null, nils) : '–') + '</b><span>Tertinggi</span></div><div class="card stat bad"><b>' + (nils.length ? Math.min.apply(null, nils) : '–') + '</b><span>Terendah</span></div>' +
        '<div class="card stat"><b>' + tuntas + ' / ' + fin.length + '</b><span>Tuntas (KKM ' + kkm + ')</span></div></div>' +
        table([
          { h: 'No', f: function (r, i) { return i + 1; } },
          { h: 'NIS', f: function (r) { return '<span class="mono">' + esc(r.username) + '</span>'; } },
          { h: 'Nama', f: function (r) { return '<b>' + esc(r.nama) + '</b>'; } },
          { h: 'Kelas', f: function (r) { return esc(r.kelas); } },
          { h: 'Status', f: function (r) { return sbadge(r.status); } },
          { h: 'Benar', cls: 'num', f: function (r) { return U.num(r.benar); } },
          { h: 'Salah', cls: 'num', f: function (r) { return U.num(r.salah); } },
          { h: 'Kosong', cls: 'num', f: function (r) { return U.num(r.kosong); } },
          { h: 'Nilai', cls: 'num', f: function (r) { return r.nilai === '' ? '–' : '<b>' + esc(r.nilai) + '</b>'; } },
          { h: 'Ket.', f: function (r) { return r.nilai === '' ? '' : (r.nilai >= kkm ? '<span class="badge ok">Tuntas</span>' : '<span class="badge bad">Remedial</span>'); } },
          { h: 'Pelanggaran', cls: 'num', f: function (r) { return r.total_langgar || 0; } },
          { h: 'Selesai', f: function (r) { return r.selesai ? esc(U.fmtMs(r.selesai)) : '–'; } }
        ], rows, 'Belum ada peserta yang mengerjakan ujian ini.');
    }
    async function load() {
      data = await U.api('g_hasil', { ujian_id: sel });
      U.S.lastUjian = sel;
      const kelas = uniq(data.rows.map(function (r) { return r.kelas; })).sort(), keep = U.$('#h-kls', box).value;
      U.$('#h-kls', box).innerHTML = opts(kelas, keep, 'Semua kelas');
      view();
    }
    U.$('#h-uj', box).onchange = function () { sel = this.value; load().catch(function (e) { U.toast(e.message, 'err'); }); };
    U.$('#h-kls', box).onchange = view;
    function currentRows() { const kls = U.$('#h-kls', box).value; return data.rows.filter(function (r) { return !kls || r.kelas === kls; }); }
    U.$('#h-csv', box).onclick = function () {
      const kkm = data.ujian.kkm;
      U.downloadCsv('hasil-' + data.ujian.nama.replace(/\W+/g, '-') + '.csv',
        [['No', 'NIS', 'Nama', 'Kelas', 'Status', 'Benar', 'Salah', 'Kosong', 'Nilai', 'Keterangan', 'Pelanggaran']].concat(
          currentRows().map(function (r, i) { return [i + 1, r.username, r.nama, r.kelas, r.status, r.benar, r.salah, r.kosong, r.nilai, r.nilai === '' ? '' : (r.nilai >= kkm ? 'Tuntas' : 'Remedial'), r.total_langgar || 0]; })));
    };
    U.$('#h-prn', box).onclick = function () {
      const kkm = data.ujian.kkm;
      U.printHtml('Hasil ' + data.ujian.nama,
        '<h2>' + esc(S.settings.nama_sekolah || '') + '</h2><div><b>' + esc(data.ujian.nama) + '</b> – ' + esc(data.ujian.mapel) + ' (KKM ' + kkm + ')</div><table><thead><tr><th>No</th><th>NIS</th><th>Nama</th><th>Kelas</th><th>Benar</th><th>Salah</th><th>Nilai</th><th>Ket.</th></tr></thead><tbody>' +
        currentRows().map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.username) + '</td><td>' + esc(r.nama) + '</td><td>' + esc(r.kelas) + '</td><td>' + esc(U.num(r.benar)) + '</td><td>' + esc(U.num(r.salah)) + '</td><td>' + esc(U.num(r.nilai)) + '</td><td>' + (r.nilai === '' ? '' : r.nilai >= kkm ? 'Tuntas' : 'Remedial') + '</td></tr>'; }).join('') + '</tbody></table>');
    };
    await load();
  };

  /* =============================== PELANGGARAN =============================== */
  VIEWS.pelanggaran = async function (box, params) {
    const list = await U.api('g_ujianList');
    let sel = params.ujian || '';
    box.innerHTML = '<div class="toolbar"><select id="p-uj">' + opts(list.map(function (u) { return { v: u.id, t: u.nama + ' – ' + u.mapel }; }), sel, 'Semua ujian') + '</select>' +
      '<button class="btn" id="p-ref" type="button">Muat ulang</button><button class="btn" id="p-csv" type="button">Unduh CSV</button></div><div id="pl"></div>';
    let rows = [];
    async function load() {
      rows = await U.api('g_pelanggaran', { ujian_id: sel });
      U.$('#pl', box).innerHTML = table([
        { h: 'Waktu', f: function (r) { return '<span class="nowrap">' + esc(r.waktu) + '</span>'; } },
        { h: 'Nama', f: function (r) { return '<b>' + esc(r.nama) + '</b>'; } },
        { h: 'Kelas', f: function (r) { return esc(r.kelas); } },
        { h: 'Ujian', f: function (r) { return esc(r.ujian); } },
        { h: 'Jenis', f: function (r) { return '<span class="badge bad">' + esc(JENIS[r.jenis] || r.jenis) + '</span>'; } },
        { h: 'Keterangan', f: function (r) { return esc(r.ket); } }
      ], rows, 'Tidak ada pelanggaran tercatat.');
    }
    U.$('#p-uj', box).onchange = function () { sel = this.value; load().catch(function (e) { U.toast(e.message, 'err'); }); };
    U.$('#p-ref', box).onclick = function () { load().catch(function (e) { U.toast(e.message, 'err'); }); };
    U.$('#p-csv', box).onclick = function () {
      U.downloadCsv('pelanggaran.csv', [['Waktu', 'Nama', 'Kelas', 'Ujian', 'Jenis', 'Keterangan']].concat(rows.map(function (r) { return [r.waktu, r.nama, r.kelas, r.ujian, JENIS[r.jenis] || r.jenis, r.ket]; })));
    };
    await load();
    poll(box, function () { load().catch(function () { /* abaikan */ }); }, 20000);
  };

  /* =============================== PENGGUNA (admin) =============================== */
  function credModal(list, title) {
    const rows = list.map(function (c) { return '<tr><td>' + esc(c.nama) + '</td><td>' + esc(c.kelas || '') + '</td><td class="mono">' + esc(c.username) + '</td><td class="mono"><b>' + esc(c.password) + '</b></td></tr>'; }).join('');
    U.modal({
      title: title || 'Akun & Password', size: 'lg', sticky: true,
      body: '<div class="alert warn small">Password hanya ditampilkan <b>sekarang</b>. Simpan atau cetak kartu login sebelum menutup jendela ini.</div>' +
        '<div class="tablewrap"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Username/NIS</th><th>Password</th></tr></thead><tbody>' + rows + '</tbody></table></div>',
      buttons: [
        { text: 'Unduh CSV', onClick: function () { U.downloadCsv('akun-login.csv', [['Nama', 'Kelas', 'Username', 'Password']].concat(list.map(function (c) { return [c.nama, c.kelas || '', c.username, c.password]; }))); return false; } },
        {
          text: 'Cetak Kartu Login', onClick: function () {
            U.printHtml('Kartu Login', '<h2>Kartu Login ' + esc(S.settings.nama_aplikasi || '') + '</h2><div>' + esc(S.settings.nama_sekolah || '') + '</div><br>' +
              list.map(function (c) { return '<div class="card"><b>' + esc(c.nama) + '</b><br>Kelas: ' + esc(c.kelas || '-') + '<br>Username/NIS: <b>' + esc(c.username) + '</b><br>Password: <b>' + esc(c.password) + '</b></div>'; }).join(''));
            return false;
          }
        },
        { text: 'Tutup', cls: 'primary' }
      ]
    });
  }

  VIEWS.pengguna = async function (box) {
    let role = 'siswa', list = [];
    const sel = {};
    box.innerHTML = '<div class="tabs" id="u-tabs"><button class="tab on" data-r="siswa">Siswa</button><button class="tab" data-r="guru">Guru</button><button class="tab" data-r="admin">Admin</button></div>' +
      '<div class="toolbar"><select id="u-kls"></select><input id="u-q" class="grow" placeholder="Cari nama / username…">' +
      '<button class="btn primary" id="u-add" type="button">+ Tambah</button><button class="btn" id="u-imp" type="button">Import dari Excel</button><button class="btn danger" id="u-del" type="button" disabled>Hapus</button></div><div id="u-tbl"></div>';
    async function load() { list = await U.api('a_userList', { role: role }); draw(); }
    function draw() {
      const kf = U.$('#u-kls', box);
      kf.classList.toggle('hidden', role !== 'siswa');
      const keep = kf.value;
      kf.innerHTML = opts(uniq(list.map(function (u) { return u.kelas; })).sort(), keep, 'Semua kelas');
      U.$('#u-imp', box).classList.toggle('hidden', role === 'admin');
      const kl = role === 'siswa' ? kf.value : '', q = U.$('#u-q', box).value.toLowerCase();
      const rows = list.filter(function (u) { return (!kl || u.kelas === kl) && (!q || (u.nama + ' ' + u.username).toLowerCase().indexOf(q) >= 0); });
      const n = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
      U.$('#u-del', box).disabled = !n; U.$('#u-del', box).textContent = n ? 'Hapus (' + n + ')' : 'Hapus';
      U.$('#u-tbl', box).innerHTML = table([
        { h: '<input type="checkbox" id="u-all">', f: function (u) { return u.id === S.user.id ? '' : '<input type="checkbox" data-sel="' + esc(u.id) + '"' + (sel[u.id] ? ' checked' : '') + '>'; } },
        { h: 'No', f: function (u, i) { return i + 1; } },
        { h: 'Nama', f: function (u) { return '<b>' + esc(u.nama) + '</b>'; } },
        { h: role === 'siswa' ? 'NIS' : 'Username', f: function (u) { return '<span class="mono">' + esc(u.username) + '</span>'; } },
        role === 'siswa' ? { h: 'Kelas', f: function (u) { return esc(u.kelas); } } : role === 'guru' ? { h: 'Mapel', f: function (u) { return esc(u.mapel); } } : { h: '', f: function () { return ''; } },
        { h: 'Status', f: function (u) { return '<span class="badge ' + (u.aktif === 'tidak' ? 'gray' : 'ok') + '">' + (u.aktif === 'tidak' ? 'Nonaktif' : 'Aktif') + '</span>'; } },
        { h: '', cls: 'right nowrap', f: function (u) { return '<button class="btn sm" data-ed="' + esc(u.id) + '">Edit</button> <button class="btn sm" data-rs="' + esc(u.id) + '">Reset password</button>'; } }
      ], rows, 'Belum ada data ' + role + '.');
      U.$$('[data-sel]', box).forEach(function (c) { c.onchange = function () { sel[c.getAttribute('data-sel')] = c.checked; draw(); }; });
      const all = U.$('#u-all', box);
      if (all) all.onchange = function () { rows.forEach(function (u) { if (u.id !== S.user.id) sel[u.id] = all.checked; }); draw(); };
      U.$$('[data-ed]', box).forEach(function (b) { b.onclick = function () { userForm(list.filter(function (u) { return u.id === b.getAttribute('data-ed'); })[0], role, load); }; });
      U.$$('[data-rs]', box).forEach(function (b) {
        b.onclick = async function () {
          const u = list.filter(function (x) { return x.id === b.getAttribute('data-rs'); })[0];
          if (!(await U.confirm('Reset password untuk ' + u.nama + '? Password baru dibuat acak.', { okText: 'Reset' }))) return;
          const r = await U.api('a_userReset', { id: u.id });
          credModal([{ nama: r.nama, username: r.username, kelas: u.kelas, password: r.password }], 'Password Baru');
        };
      });
    }
    U.$$('#u-tabs .tab', box).forEach(function (t) {
      t.onclick = function () {
        U.$$('#u-tabs .tab', box).forEach(function (x) { x.classList.toggle('on', x === t); });
        role = t.getAttribute('data-r'); Object.keys(sel).forEach(function (k) { delete sel[k]; });
        U.$('#u-q', box).value = ''; U.$('#u-kls', box).value = '';
        load().catch(function (e) { U.toast(e.message, 'err'); });
      };
    });
    U.$('#u-kls', box).onchange = draw; U.$('#u-q', box).oninput = draw;
    U.$('#u-add', box).onclick = function () { userForm(null, role, load); };
    U.$('#u-imp', box).onclick = function () { userImport(role, load); };
    U.$('#u-del', box).onclick = async function () {
      const ids = Object.keys(sel).filter(function (k) { return sel[k]; });
      if (!(await U.confirm('Hapus ' + ids.length + ' akun terpilih? Riwayat nilai mereka tetap tersimpan.', { danger: true, okText: 'Hapus' }))) return;
      const r = await U.api('a_userDelete', { ids: ids });
      Object.keys(sel).forEach(function (k) { delete sel[k]; });
      U.toast(r.dihapus + ' akun dihapus.', 'ok'); load();
    };
    await load();
  };

  function userForm(u, role, done) {
    u = u || { role: role, aktif: 'ya' };
    const isNew = !u.id;
    U.modal({
      title: isNew ? 'Tambah ' + role : 'Edit ' + u.role, sticky: true,
      body:
        '<label>Nama lengkap<input id="f-nama" value="' + esc(u.nama || '') + '"></label>' +
        '<label>' + (u.role === 'siswa' ? 'NIS (dipakai untuk login)' : 'Username') + '<input id="f-user" value="' + esc(u.username || '') + '" autocapitalize="off"></label>' +
        (u.role === 'siswa' ? '<label>Kelas<input id="f-kelas" value="' + esc(u.kelas || '') + '" placeholder="mis. X-TKJ-1"></label>' : '') +
        (u.role === 'guru' ? '<label>Mata pelajaran (catatan)<input id="f-mapel" value="' + esc(u.mapel || '') + '"></label>' : '') +
        '<label>Password' + (isNew ? ' (kosong = dibuat acak)' : ' (kosong = tidak diubah)') + '<input id="f-pw" autocomplete="off" placeholder="min. 6 karakter"></label>' +
        '<label class="chk"><input type="checkbox" id="f-aktif"' + (u.aktif !== 'tidak' ? ' checked' : '') + '> Akun aktif</label>',
      buttons: [{ text: 'Batal' }, {
        text: 'Simpan', cls: 'primary',
        onClick: async function (m) {
          const d = {
            id: u.id, role: u.role, nama: m.$('#f-nama').value, username: m.$('#f-user').value, password: m.$('#f-pw').value,
            kelas: m.$('#f-kelas') ? m.$('#f-kelas').value : '', mapel: m.$('#f-mapel') ? m.$('#f-mapel').value : '', aktif: m.$('#f-aktif').checked ? 'ya' : 'tidak'
          };
          const r = await U.api('a_userSave', d);
          U.toast('Akun disimpan.', 'ok');
          if (done) done();
          if (r.password) setTimeout(function () { credModal([{ nama: d.nama, username: d.username, kelas: d.kelas, password: r.password }], 'Akun Tersimpan'); }, 150);
        }
      }]
    });
  }

  function userImport(role, done) {
    const COLS = role === 'siswa' ? ['nama', 'username', 'kelas', 'password'] : ['nama', 'username', 'mapel', 'password'];
    U.modal({
      title: 'Import ' + role + ' dari Excel', size: 'lg', sticky: true,
      body:
        '<div class="alert info small">Salin dari Excel/Google Sheets lalu tempel di bawah. Urutan kolom:<br><span class="mono">' + COLS.join(' | ') + '</span><br>' +
        'Kolom password boleh kosong, sistem membuat password acak dan menampilkannya sekali setelah import.</div>' +
        '<textarea id="i-paste" class="field mono" rows="9" placeholder="Tempel di sini…" style="white-space:pre"></textarea><div class="hint" id="i-cnt">0 baris terbaca</div>',
      onOpen: function (m) { m.$('#i-paste').oninput = function () { m.$('#i-cnt').textContent = U.parseTable(m.$('#i-paste').value, COLS).length + ' baris terbaca'; }; },
      buttons: [{ text: 'Batal' }, {
        text: 'Import', cls: 'primary',
        onClick: async function (m) {
          const rows = U.parseTable(m.$('#i-paste').value, COLS);
          if (!rows.length) { U.toast('Tidak ada data untuk diimport.', 'err'); return false; }
          const r = await U.api('a_userImport', { role: role, rows: rows }, { timeout: 90000 });
          if (done) done();
          U.toast(r.berhasil + ' akun dibuat' + (r.gagal.length ? ', ' + r.gagal.length + ' dilewati.' : '.'), 'ok', 5000);
          setTimeout(function () {
            if (r.kredensial.length) credModal(r.kredensial, 'Akun Berhasil Dibuat');
            if (r.gagal.length) U.modal({ title: 'Baris yang dilewati', body: '<ul class="small">' + r.gagal.slice(0, 80).map(function (g) { return '<li>Baris ' + g.baris + ': ' + esc(g.alasan) + '</li>'; }).join('') + '</ul>', buttons: [{ text: 'Tutup' }] });
          }, 150);
        }
      }]
    });
  }

  /* =============================== PENGATURAN (admin) =============================== */
  VIEWS.pengaturan = async function (box) {
    const s = (await U.api('g_meta')).settings;
    box.innerHTML = '<div class="card" style="max-width:640px"><div class="grid2">' +
      '<label>Nama sekolah<input id="s-sek" value="' + esc(s.nama_sekolah) + '"></label><label>Nama aplikasi<input id="s-app" value="' + esc(s.nama_aplikasi) + '"></label>' +
      '<label>Tahun ajaran<input id="s-th" value="' + esc(s.tahun_ajaran) + '"></label><label>KKM bawaan<input id="s-kkm" type="number" value="' + esc(s.kkm_default) + '"></label>' +
      '<label>Batas pelanggaran bawaan<input id="s-mx" type="number" value="' + esc(s.maks_langgar_default) + '"></label>' +
      '<label>Wajib layar penuh<select id="s-fs"><option value="ya">Ya (disarankan)</option><option value="tidak">Tidak</option></select></label></div>' +
      '<label>Logo (URL gambar, kosongkan untuk memakai logo.png)<input id="s-logo" value="' + esc(s.logo_url) + '" placeholder="https://…"></label>' +
      '<button class="btn primary" id="s-save" type="button">Simpan Pengaturan</button></div>';
    U.$('#s-fs', box).value = s.wajib_fullscreen || 'ya';
    U.$('#s-save', box).onclick = async function () {
      const r = await U.api('a_setSave', {
        nama_sekolah: U.$('#s-sek', box).value, nama_aplikasi: U.$('#s-app', box).value, tahun_ajaran: U.$('#s-th', box).value, kkm_default: U.$('#s-kkm', box).value,
        maks_langgar_default: U.$('#s-mx', box).value, wajib_fullscreen: U.$('#s-fs', box).value, logo_url: U.$('#s-logo', box).value
      });
      S.settings = r; meta.settings = r;
      U.toast('Pengaturan disimpan.', 'ok');
    };
  };

  /* =============================== AKUN =============================== */
  VIEWS.akun = async function (box) {
    box.innerHTML = '<div class="card" style="max-width:520px"><h3>' + esc(S.user.nama) + '</h3><p class="muted" style="margin:4px 0 14px">Username: <b class="mono">' + esc(S.user.username) + '</b> · Peran: ' + (isAdmin() ? 'Admin' : 'Guru') + '</p>' +
      '<button class="btn primary" id="a-pw" type="button">Ganti Password</button></div>';
    U.$('#a-pw', box).onclick = U.passwordModal;
  };
})();
