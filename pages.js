/* GPS HSE — Phase 5D: the link pages that came from e-mails (evaluation, CHSEM decision, flow action, client interview outcome,
   project HSE documents, HR / project update, transfer release). Each page keeps its own code from the Apps Script page; this
   file signs the person in, asks the Recruitment script for the page data (bootPage) and then starts the page's code.
   Needs config.js and rs.js first. */
(function () {
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function params() {
    var o = {};
    new URLSearchParams(location.search).forEach(function (v, k) { o[k] = v; });
    return o;
  }
  function box(title, html, bad) {
    var w = document.getElementById('pgBox');
    if (!w) { w = document.createElement('div'); w.id = 'pgBox'; document.body.insertBefore(w, document.body.firstChild); }
    show(false);
    w.innerHTML = '<div class="pg-card"><div class="pg-brand">GPS HSE Department</div><h1>' + esc(title) + '</h1><div class="pg-msg' + (bad ? ' bad' : '') + '">' + html + '</div>' +
      '<p class="pg-foot"><a href="./">All GPS HSE pages</a> · <a href="#" onclick="RS.out();return false">Sign out</a> · <a href="privacy.html">Privacy</a></p></div>';
  }
  // While the page loads (or cannot open) only the message box shows; the page's own frame comes back with its data
  function show(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.id === 'pgBox' || el.id === 'rsSign' || el.id === 'rsBusy' || el.tagName === 'SCRIPT') return;
      if (on) { if (el.hasAttribute('data-pg')) { el.style.display = el.getAttribute('data-pg'); el.removeAttribute('data-pg'); } }
      else if (!el.hasAttribute('data-pg')) { el.setAttribute('data-pg', el.style.display || ''); el.style.display = 'none'; }
    });
  }
  RS.page = function (kind) {
    var p = params();
    box('Opening…', '<span class="rs-spin dark"></span> Loading the page — one moment.');
    RS.ready(function () {
      google.script.run.withSuccessHandler(function (r) {
        if (!r || r.info) {
          document.title = (r && r.info.title) || 'GPS HSE';
          box((r && r.info.title) || 'Not available', (r && r.info.html) || 'This page could not be opened.');
          return;
        }
        var w = document.getElementById('pgBox'); if (w) w.remove();
        show(true);
        if (r.title) document.title = r.title;
        window.D_BOOT = r.data;
        var src = document.getElementById('pageJs');
        var s = document.createElement('script');
        s.text = src.text;
        document.body.appendChild(s);
      }).withFailureHandler(function (e) {
        box('Could not open the page', esc(e.message) + '<br><br><a href="#" onclick="location.reload();return false">Try again</a>', true);
      }).bootPage(kind, p);
    });
  };
})();
