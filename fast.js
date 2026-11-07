/* GPS HSE — Phase 5F-2: fast pages on the site. The copy on this computer shows at once, then one Firebase read of your own
   copy, then the Recruitment script checks for changes. Needs config.js and rs.js first. The Sheets stay the master record;
   saves go to the script as before. */
(function () {
  var F = RS.F = { db: null, uid: '', ready: null, typed: 0 };
  var SDK = ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'];
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lsKey(k) { return 'gpsRecFast|' + String(RS.me && RS.me.email || '').toLowerCase() + '|' + k; }
  function addScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s); });
  }
  function within(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('slow')); }, ms); })]); }
  document.addEventListener('input', function (e) { if (!e.target || e.target.type !== 'search') F.typed = Date.now(); }, true);
  (function () {
    var st = document.createElement('style');
    st.textContent = '.rs-newer{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:6000;background:#2D2647;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.2)}' +
      '.rs-newer button{margin-left:8px;border:0;border-radius:8px;padding:6px 10px;background:#B8AEE6;color:#2D2647;font-weight:bold;cursor:pointer}';
    document.head.appendChild(st);
  })();

  RS.fid = function (s) { return String(s == null ? '' : s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 200); };

  // Firebase sign-in once per page (a token made by the script for the signed-in person)
  RS.fireStart = function () {
    if (F.ready) return F.ready;
    F.ready = new Promise(function (res) {
      RS.api({ rec: 'call', fn: 'fireSession5', args: [], s: RS.s }).then(function (j) {
        var s = j.res;
        if (!s || !s.on) return res(false);
        F.uid = s.uid;
        (window.firebase && firebase.firestore ? Promise.resolve() : SDK.reduce(function (p, src) { return p.then(function () { return addScript(src); }); }, Promise.resolve()))
          .then(function () {
            var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(s.config);
            return within(app.auth().signInWithCustomToken(s.token), 8000).then(function () { return app; });
          })
          .then(function (app) { F.db = app.firestore(); res(true); })
          .catch(function () { res(false); });
      }).catch(function () { res(false); });
    });
    return F.ready;
  };

  function fireRead(k, have) {
    return RS.fireStart().then(function (ok) {
      if (!ok) throw new Error('no firebase');
      var col = F.db.collection('users').doc(F.uid).collection('pages');
      return within(col.doc(k + '_meta').get().then(function (m) {
        if (!m.exists) throw new Error('no copy');
        var meta = m.data();
        if (meta.hash && meta.hash === have) return { same: true };
        var reads = [];
        for (var i = 0; i < meta.parts; i++) reads.push(col.doc(k + '_' + i).get());
        return Promise.all(reads).then(function (docs) {
          var json = docs.map(function (d) { if (!d.exists || Number(d.data().at) !== Number(meta.at)) throw new Error('updating'); return d.data().json; }).join('');
          return { data: JSON.parse(json), hash: meta.hash };
        });
      }), 6000);
    });
  }
  function localGet(k) { try { return JSON.parse(localStorage.getItem(lsKey(k)) || 'null'); } catch (e) { return null; } }
  function localPut(k, hash, data) { try { localStorage.setItem(lsKey(k), JSON.stringify({ hash: hash, at: Date.now(), data: data })); } catch (e) { /* full */ } }

  // Someone is typing on the page: a newer copy waits behind a "Show the latest" bar instead of redrawing the form
  function editing(since) {
    var a = document.activeElement;
    return F.typed > since || !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'search');
  }
  function later(apply, d) {
    var b = document.getElementById('rsNewer');
    if (!b) { b = document.createElement('div'); b.id = 'rsNewer'; b.className = 'rs-newer'; document.body.appendChild(b); }
    b.innerHTML = 'This page has newer information. <button type="button">Show the latest</button>';
    b.querySelector('button').onclick = function () { b.remove(); apply(d, 'server'); };
  }

  // k: copy name; fn: the script call (its last argument is the fingerprint); fresh: after your own change (wait for the script)
  RS.fast = function (k, fn, args, apply, fail, fresh) {
    var shown = false, shownAt = 0, done = false, hash = '';
    var take = function (d, h, src) { if (done || !d) return; shown = true; shownAt = Date.now(); hash = h || ''; try { apply(d, src); } catch (e) { if (window.console) console.error(e); } };
    if (!fresh) {
      var L = localGet(k);
      if (L && L.data) take(L.data, L.hash, 'device');
      fireRead(k, hash).then(function (r) {
        if (done || r.same) return;
        localPut(k, r.hash, r.data);
        if (shown && editing(shownAt)) later(apply, r.data); else take(r.data, r.hash, 'firebase');
      }).catch(function () { /* the script answers */ });
    }
    RS.api({ rec: 'call', fn: fn, args: args.concat([hash]), s: RS.s }).then(function (j) {
      done = true;
      var r = j.res || {};
      if (r.same) return;
      if (r.hash) localPut(k, r.hash, r.data);
      if (shown && r.hash && r.hash === hash) return;
      if (shown && editing(shownAt)) later(apply, r.data);
      else { try { apply(r.data, 'server'); } catch (e) { if (window.console) console.error(e); } }
    }).catch(function (e) {
      done = true;
      if (!shown) fail(e);
      else if (window.console) console.warn('Could not check for changes: ' + e.message);
    });
    RS.busy(0, shown ? 'Checking for changes…' : 'Opening…');
  };
})();
