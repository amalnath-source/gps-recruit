/* GPS HSE — recruitment pages on GitHub (gps-recruit). Shared: talking to the Recruitment script, sign-in, and a
   stand-in for google.script.run so the pages keep their own code. Needs config.js (REC_API) loaded first. */
(function () {
  var KEY = 'gpsRecS';
  var RS = window.RS = { s: '', me: null, clientId: '', waiting: [] };
  try { RS.s = localStorage.getItem(KEY) || ''; } catch (e) { RS.s = ''; }

  RS.api = function (body) {
    return fetch(window.REC_API, { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('The server did not answer (' + r.status + ') — please try again'); return r.json(); })
      .then(function (j) {
        if (j && j.ok) return j;
        var msg = (j && j.error) || 'Something went wrong';
        if (msg === 'SIGNIN') { RS.forget(); RS.signIn(); }
        throw new Error(msg === 'SIGNIN' ? 'Please sign in again' : msg);
      });
  };
  RS.forget = function () { RS.s = ''; RS.me = null; try { localStorage.removeItem(KEY); } catch (e) { /* ok */ } };
  RS.keep = function (me) { RS.me = me; RS.s = me.s; try { localStorage.setItem(KEY, me.s); } catch (e) { /* this tab only */ } };

  // google.script.run stand-in: same chain (withSuccessHandler / withFailureHandler / withUserObject), runs on the server
  function runner() {
    var s = null, f = null, u;
    var p = new Proxy({}, { get: function (_, n) {
      if (n === 'withSuccessHandler') return function (h) { s = h; return p; };
      if (n === 'withFailureHandler') return function (h) { f = h; return p; };
      if (n === 'withUserObject') return function (o) { u = o; return p; };
      return function () {
        var args = Array.prototype.slice.call(arguments);
        RS.api({ rec: 'call', fn: n, args: args, s: RS.s })
          .then(function (j) { if (s) s(j.res, u); })
          .catch(function (e) { if (f) f(e, u); else if (window.console) console.error(e); });
      };
    } });
    return p;
  }
  window.google = window.google || {};
  window.google.script = { run: new Proxy({}, { get: function (_, n) { return runner()[n]; } }), host: { close: function () { } } };

  // Run fn once signed in (opts.open: no sign-in needed — the link key is the access)
  RS.ready = function (fn, opts) {
    opts = opts || {};
    if (opts.open) { fn(); return; }
    RS.waiting.push(fn);
    if (RS.s) {
      RS.api({ rec: 'me', s: RS.s }).then(function (me) { RS.keep(me); RS.go(); }).catch(function () { RS.forget(); RS.signIn(); });
    } else RS.signIn();
  };
  RS.go = function () {
    RS.hide();
    var w = document.getElementById('rsWho');
    if (w && RS.me) w.innerHTML = esc(RS.me.email) + ' · <a href="#" onclick="RS.out();return false">sign out</a>';
    var list = RS.waiting.splice(0, RS.waiting.length);
    list.forEach(function (fn) { try { fn(RS.me); } catch (e) { if (window.console) console.error(e); } });
  };
  RS.out = function () { var s = RS.s; RS.forget(); RS.api({ rec: 'signout', s: s }).catch(function () { }); location.reload(); };

  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(id) { return document.getElementById(id); }

  /* ---------- sign-in box ---------- */
  RS.signIn = function (err) {
    var box = $('rsSign');
    if (!box) {
      box = document.createElement('div'); box.id = 'rsSign';
      box.innerHTML = '<div class="rs-dlg" role="dialog" aria-modal="true" aria-labelledby="rsT"><div class="rs-brand">GPS HSE Department</div>' +
        '<h1 id="rsT">Sign in</h1><p class="rs-sub">Use your GPS Google account, or get a 6-digit code by e-mail.</p>' +
        '<div id="rsG" class="rs-g"></div><div class="rs-or"><span>or</span></div>' +
        '<label for="rsE">E-mail</label><div class="rs-row"><input id="rsE" type="email" autocomplete="email" placeholder="name@gpsoman.com"><button type="button" id="rsSend">Send code</button></div>' +
        '<div id="rsCodeBox" style="display:none"><label for="rsC">Code from the e-mail</label><div class="rs-row"><input id="rsC" inputmode="numeric" maxlength="6" placeholder="6 digits"><button type="button" id="rsVer">Sign in</button></div></div>' +
        '<div id="rsMsg" class="rs-msg" role="status"></div><p class="rs-foot"><a href="privacy.html">Privacy</a></p></div>';
      document.body.appendChild(box);
      $('rsSend').onclick = function () {
        var e = $('rsE').value.trim(); if (!e) return;
        this.disabled = true; msg('Sending the code…');
        RS.api({ rec: 'code', email: e }).then(function () { $('rsCodeBox').style.display = ''; msg('Code sent to ' + esc(e) + ' — it works for 15 minutes.'); $('rsC').focus(); })
          .catch(function (x) { msg(esc(x.message), true); }).then(function () { $('rsSend').disabled = false; });
      };
      $('rsVer').onclick = function () {
        msg('Checking…');
        RS.api({ rec: 'verify', email: $('rsE').value.trim(), code: $('rsC').value.trim() }).then(function (me) { RS.keep(me); RS.go(); }).catch(function (x) { msg(esc(x.message), true); });
      };
      $('rsC').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('rsVer').click(); });
      RS.api({ rec: 'config' }).then(function (c) { RS.clientId = c.clientId; gsi(); }).catch(function (x) { msg(esc(x.message), true); });
    }
    box.style.display = 'flex';
    if (err) msg(esc(err), true);
  };
  RS.hide = function () { var b = $('rsSign'); if (b) b.style.display = 'none'; };
  function msg(h, bad) { var m = $('rsMsg'); if (m) { m.innerHTML = h; m.className = 'rs-msg' + (bad ? ' bad' : ''); } }
  function gsi() {
    if (!RS.clientId) return;
    var go = function () {
      if (!(window.google && google.accounts && google.accounts.id)) return false;
      google.accounts.id.initialize({ client_id: RS.clientId, callback: function (resp) {
        msg('Signing in…');
        RS.api({ rec: 'google', idToken: resp.credential }).then(function (me) { RS.keep(me); RS.go(); }).catch(function (x) { msg(esc(x.message), true); });
      } });
      google.accounts.id.renderButton($('rsG'), { theme: 'outline', size: 'large', text: 'continue_with', width: 280 });
      return true;
    };
    if (!go()) {
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = go; document.head.appendChild(s);
    }
  }
})();
