(function () {
  if (document.getElementById("st-chat-root")) return;

  var VER = Date.now();

  var css = [
    /* root */
    "#st-chat-root *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}",

    /* ── Float button group ── */
    /* safe-area-inset-bottom keeps button above home indicator on all iPhones */
    "#st-wrap{position:fixed;bottom:max(20px,calc(env(safe-area-inset-bottom,0px) + 14px));right:16px;z-index:9000;display:flex;align-items:center;gap:10px}",
    "#st-label{background:rgba(7,9,36,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(123,94,167,.38);border-radius:22px;padding:6px 14px;cursor:pointer;transition:opacity .2s,transform .2s;white-space:nowrap;user-select:none;box-shadow:0 2px 12px rgba(0,0,0,.35)}",
    "#st-label:hover{opacity:.85}",
    "#st-label-t{font-size:12.5px;font-weight:600;color:#E8E8F0;font-family:'Be Vietnam Pro',sans-serif;line-height:1.3}",
    "#st-label-s{font-size:10px;color:rgba(167,139,250,.8);font-family:'Be Vietnam Pro',sans-serif;margin-top:1px}",
    "#st-btn{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#7B5EA7,#4F6BFF);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(123,94,167,.55);transition:transform .2s,box-shadow .2s;flex-shrink:0}",
    "#st-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(123,94,167,.7)}",
    "#st-btn:active{transform:scale(.94)}",
    "#st-btn svg{width:24px;height:24px;fill:#fff}",

    /* ── Desktop chat box ── */
    "#st-box{position:fixed;bottom:84px;right:16px;z-index:8999;width:380px;height:600px;border-radius:16px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,.6);border:1px solid rgba(123,94,167,.28);background:#04051A;display:none;flex-direction:column;transform:translateY(10px) scale(.98);opacity:0;transition:opacity .2s ease,transform .2s ease}",
    "#st-box.open{display:flex;opacity:1;transform:translateY(0) scale(1)}",
    "#st-iframe{width:100%;flex:1;border:none;background:#04051A;display:block;min-height:0}",

    /* ── MOBILE: bottom sheet ── */
    /* dvh (dynamic viewport height, iOS 15.4+) adjusts when address bar shows/hides */
    /* vh fallback for older devices */
    "@media(max-width:540px){",
    "  #st-box{",
    "    left:0;right:0;bottom:0;top:auto;width:100%;",
    "    height:82vh;height:82dvh;",
    "    min-height:420px;",
    "    border-radius:20px 20px 0 0;border-left:none;border-right:none;border-bottom:none;",
    "    transform:translateY(48px);",
    "    transition:opacity .24s ease,transform .3s cubic-bezier(.32,.72,0,1)",
    "  }",
    "  #st-box.open{transform:translateY(0)}",
    "  #st-wrap{bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 10px));right:12px}",
    "  #st-label{display:none}",
    "  #st-btn{width:52px;height:52px}",
    "  #st-handle{display:flex!important}",
    "}",

    /* Drag handle (mobile only) */
    "#st-handle{display:none;justify-content:center;padding:10px 0 5px;background:#04051A;flex-shrink:0;cursor:pointer}",
    "#st-handle-bar{width:36px;height:4px;border-radius:4px;background:rgba(123,94,167,.4)}",
  ].join("");

  var el = document.createElement("style");
  el.innerHTML = css;
  document.head.appendChild(el);

  var ICON_CHAT = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>';

  /* Label */
  var label = document.createElement("div");
  label.id = "st-label";
  label.innerHTML = '<div id="st-label-t">Trợ lý tư vấn</div><div id="st-label-s">✦ Online 24/7</div>';

  /* Float button */
  var btn = document.createElement("button");
  btn.id = "st-btn";
  btn.setAttribute("aria-label", "Mở chat tư vấn");
  btn.innerHTML = ICON_CHAT;

  var wrap = document.createElement("div");
  wrap.id = "st-wrap";
  wrap.appendChild(label);
  wrap.appendChild(btn);

  /* Drag handle */
  var handle = document.createElement("div");
  handle.id = "st-handle";
  handle.innerHTML = '<div id="st-handle-bar"></div>';

  /* Iframe */
  var iframe = document.createElement("iframe");
  iframe.id = "st-iframe";
  iframe.title = "Trợ lý Thần Số Học Sammy Trương";
  iframe.setAttribute("allow", "clipboard-write; clipboard-read");
  iframe.setAttribute("loading", "lazy");

  /* Box */
  var box = document.createElement("div");
  box.id = "st-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Chat với trợ lý");
  box.appendChild(handle);
  box.appendChild(iframe);

  /* Root */
  var root = document.createElement("div");
  root.id = "st-chat-root";
  root.appendChild(wrap);
  root.appendChild(box);
  document.body.appendChild(root);

  var open = false, loaded = false;

  function openChat() {
    if (open) return;
    open = true;
    if (!loaded) {
      iframe.src = "/chatbot.html?v=" + VER;
      loaded = true;
    }
    box.classList.add("open");
    wrap.style.display = "none";
    if (window.innerWidth <= 540) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
    }
  }

  function closeChat() {
    if (!open) return;
    open = false;
    box.classList.remove("open");
    wrap.style.display = "";
    document.body.style.overflow = "";
    document.body.style.overscrollBehavior = "";
  }

  btn.addEventListener("click", function () { open ? closeChat() : openChat(); });
  label.addEventListener("click", openChat);
  handle.addEventListener("click", closeChat);

  window.addEventListener("message", function (e) {
    if (e.data === "st-close") closeChat();
    if (e.data && e.data.type === "st-navigate" && e.data.url) {
      closeChat();
      window.location.href = e.data.url;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) closeChat();
  });

  window.sammyChatOpen  = openChat;
  window.sammyChatClose = closeChat;
})();
