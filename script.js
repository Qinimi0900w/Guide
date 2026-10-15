/* Логика визитки. Данные — в config.js, тексты интерфейса — в i18n.js.
   Здесь ничего менять не нужно. */
(function () {
  "use strict";

  const BASE = GUIDE_CONFIG;
  const C = BASE;
  const LEVELS = ["easy", "medium", "hard"];
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Создание элемента: текст вставляется через textContent, поэтому любые символы в config безопасны
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style") node.style.cssText = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    (children || []).forEach((child) => node.append(child));
    return node;
  }

  const cssUrl = (src) => 'url("' + (src.startsWith("data:") ? src : encodeURI(src)) + '")';

  /* ---------- Язык ---------- */

  const LANG_KEY = "guide-card-lang";
  const languages = BASE.languages.map((l) => l.code).filter((code) => UI_TEXT[code]);

  function savedLang() {
    try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; }
  }

  let lang = [savedLang(), BASE.defaultLanguage, "ru"].find((code) => languages.includes(code)) || languages[0];

  // Текст из config: строка — одна на все языки, объект — по языкам (запасной вариант — русский)
  function tr(value) {
    if (value == null) return "";
    if (typeof value !== "object") return String(value);
    return value[lang] || value.ru || Object.values(value)[0] || "";
  }

  // Текст интерфейса из i18n.js; {t} заменяется на arg
  function ui(key, arg) {
    const text = (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.ru[key] || "";
    return typeof text === "string" ? text.replace("{t}", arg == null ? "" : arg) : text;
  }

  const levelLabel = (level) => (ui("levels")[level] || "");

  function setLanguage(code) {
    if (code === lang || !languages.includes(code)) return;
    lang = code;
    try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* без сохранения — не страшно */ }
    renderAll();
  }

  function applyStaticTexts() {
    document.documentElement.lang = lang;
    document.title = tr(C.name) + " — " + ui("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = ui(node.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", ui(node.dataset.i18nAria));
    });
  }

  const pageUrl = C.shareUrl || window.location.href;

  /* ---------- Заполнение страницы ---------- */

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
  }

  function renderAvatar() {
    const box = $("avatar");
    const img = box.querySelector("img");
    if (img) { img.alt = tr(C.name); return; }
    if (!C.avatar) { box.textContent = initials(tr(C.name)); return; }
    box.textContent = "";
    const photo = el("img", { src: C.avatar, alt: tr(C.name) });
    photo.addEventListener("error", () => {
      C.avatar = "";
      box.textContent = initials(tr(C.name));
    }, { once: true });
    box.append(photo);
  }

  function renderProfile() {
    $("guide-name").textContent = tr(C.name);
    $("guide-role").textContent = tr(C.role);
    $("stat-years").textContent = C.stats.years;
    $("stat-tourists").textContent = C.stats.tourists;
    $("stat-rating").textContent = "★ " + C.stats.rating;
    $("stat-reviews").textContent = C.stats.reviews + " " + ui("statReviews");
    $("about-text").textContent = tr(C.about);
  }

  /* ---------- Кнопка «Онлайн-запись»: обычная внешняя ссылка ---------- */

  function setupBookingLink() {
    $("open-booking").href = BASE.bookingUrl || "#";
  }

  /* ---------- Баннеры-карусель ---------- */

  const carousel = $("carousel");
  const track = $("carousel-track");
  const dotsBox = $("carousel-dots");
  const pauseBtn = $("carousel-pause");

  let slideEls = [];
  let bannerIndex = 0;
  let autoplayOn = true;
  let holdUntil = 0; // после касания или клика автопрокрутка молчит несколько секунд
  let timer = null;

  function goTo(index, smooth) {
    const slide = slideEls[index];
    if (!slide) return;
    track.scrollTo({ left: slide.offsetLeft, behavior: smooth && !reducedMotion.matches ? "smooth" : "auto" });
  }

  function setActiveDot() {
    Array.from(dotsBox.children).forEach((dot, i) => dot.setAttribute("aria-current", String(i === bannerIndex)));
  }

  function updatePauseButton() {
    pauseBtn.dataset.playing = String(autoplayOn);
    pauseBtn.setAttribute("aria-label", ui(autoplayOn ? "autoplayStop" : "autoplayStart"));
  }

  function stopAutoplay() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function startAutoplay() {
    stopAutoplay();
    if (slideEls.length < 2 || !autoplayOn || reducedMotion.matches) return;
    timer = setInterval(() => {
      const busy = document.hidden || Date.now() < holdUntil ||
        carousel.matches(":hover") || carousel.contains(document.activeElement);
      if (!busy) goTo((bannerIndex + 1) % slideEls.length, true);
    }, BASE.bannerAutoplayMs || 6000);
  }

  function renderBanners() {
    const list = C.banners.filter((b) => b.show);
    carousel.hidden = !list.length;

    slideEls = list.map((b, i) => {
      const slide = el("article", {
        class: "banner" + (b.image ? " banner--image" : ""),
        role: "group",
        "aria-roledescription": ui("slideWord"),
        "aria-label": (i + 1) + " / " + list.length,
      }, [
        el("div", { class: "banner__shine", "aria-hidden": "true" }),
        el("span", { class: "banner__label", text: tr(b.label) }),
        el("h2", { class: "banner__title", text: tr(b.title) }),
        el("p", { class: "banner__subtitle", text: tr(b.subtitle) }),
      ]);
      if (b.background) slide.style.background = b.background;
      if (b.image) slide.style.backgroundImage = cssUrl(b.image);
      return slide;
    });

    dotsBox.replaceChildren(...slideEls.map((_, i) => el("button", {
      type: "button",
      class: "dot",
      "aria-label": ui("bannerDot", String(i + 1)),
      onclick: () => { holdUntil = Date.now() + 10000; goTo(i, true); },
    }, [el("span", { class: "dot__mark", "aria-hidden": "true" })])));
    track.replaceChildren(...slideEls);
    $("carousel-controls").hidden = slideEls.length < 2;

    bannerIndex = Math.min(bannerIndex, Math.max(0, slideEls.length - 1));
    goTo(bannerIndex, false);
    setActiveDot();
    updatePauseButton();
    startAutoplay();
  }

  // Какой слайд сейчас показан — определяем по прокрутке (работает и для свайпа, и для клавиатуры)
  let scrollFrame = 0;
  track.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      let best = 0;
      let distance = Infinity;
      slideEls.forEach((slide, i) => {
        const d = Math.abs(slide.offsetLeft - track.scrollLeft);
        if (d < distance) { distance = d; best = i; }
      });
      if (best !== bannerIndex) { bannerIndex = best; setActiveDot(); }
    });
  }, { passive: true });

  track.addEventListener("pointerdown", () => { holdUntil = Date.now() + 10000; });
  window.addEventListener("resize", () => goTo(bannerIndex, false));
  pauseBtn.addEventListener("click", () => {
    autoplayOn = !autoplayOn;
    updatePauseButton();
    startAutoplay();
  });
  reducedMotion.addEventListener("change", startAutoplay);

  /* ---------- Чипсы: языки и сложность ---------- */

  let activeLevel = null;

  // Тур можно скрыть, добавив ему в config.js строку active: false
  const activeTours = () => C.tours.filter((t) => t.active !== false);

  // Перерисовка группы кнопок с сохранением фокуса на той же позиции
  function refill(container, buttons) {
    const focusedIndex = Array.from(container.children).indexOf(document.activeElement);
    container.replaceChildren(...buttons);
    if (focusedIndex >= 0 && buttons[focusedIndex]) buttons[focusedIndex].focus();
  }

  const checkIcon = () => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "chip__icon");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M20 6 9 17l-5-5");
    svg.append(path);
    return svg;
  };

  function renderChips() {
    refill($("lang-chips"), BASE.languages.filter((l) => UI_TEXT[l.code]).map((l) => {
      const active = l.code === lang;
      return el("button", {
        type: "button",
        class: "chip chip--lang",
        lang: l.code,
        "aria-pressed": String(active),
        onclick: () => setLanguage(l.code),
      }, active ? [checkIcon(), l.label] : [l.label]);
    }));

    // Чипс сложности показываем, только если есть хотя бы один включённый тур такой сложности
    const present = new Set(activeTours().map((t) => t.level));
    if (activeLevel && !present.has(activeLevel)) activeLevel = null;
    const buttons = LEVELS.filter((l) => present.has(l)).map((l) => el("button", {
      type: "button",
      class: "chip chip--topic",
      "aria-pressed": String(activeLevel === l),
      "aria-controls": "tours",
      onclick: () => setLevel(activeLevel === l ? null : l, true),
    }, [levelLabel(l)]));
    $("topic-chips").hidden = !buttons.length;
    refill($("topic-chips"), buttons);
  }

  /* ---------- Туры и фильтр по сложности ---------- */

  // Шапка карточки: фото (если указано image), под ним цвет — он виден, пока фото грузится или если файла нет
  function tourBackground(t) {
    const fallback = t.color || "linear-gradient(135deg, #6E8F7E, #2E5443)";
    return t.image ? cssUrl(t.image) + " center / cover no-repeat, " + fallback : fallback;
  }

  function tourMeta(t) {
    return [tr(t.duration), levelLabel(t.level).toLowerCase()].filter(Boolean).join(" · ");
  }

  function renderTours() {
    const list = $("tours");
    const all = activeTours();
    const shown = all.filter((t) => !activeLevel || t.level === activeLevel);

    list.replaceChildren(...shown.map((t) =>
      el("article", { class: "tour" }, [
        el("div", { class: "tour__cover", style: "background:" + tourBackground(t) }, [
          el("span", { class: "tour__meta", text: tourMeta(t) }),
        ]),
        el("div", { class: "tour__body" }, [
          el("div", { class: "tour__info" }, [
            el("h3", { class: "tour__title", text: tr(t.title) }),
            el("p", { class: "tour__price", text: tr(t.price) }),
          ]),
        ]),
      ])));

    if (!shown.length) list.append(el("p", { class: "tours__empty", text: ui(all.length ? "noTours" : "noActiveTours") }));

    $("filter").hidden = !activeLevel;
    $("filter-text").textContent = activeLevel ? ui("filterStatus", levelLabel(activeLevel)) : "";
  }

  function setLevel(level, scroll) {
    activeLevel = level;
    renderChips();
    renderTours();
    $("filter-live").textContent = level ? ui("filterStatus", levelLabel(level)) : "";
    if (scroll && level) {
      $("tours-section").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
    }
  }

  $("filter-reset").addEventListener("click", () => {
    setLevel(null);
    const first = $("topic-chips").querySelector("button");
    if (first) first.focus();
  });

  /* ---------- Сохранить контакт (.vcf) ---------- */

  function vEscape(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }

  function downloadVCard() {
    const name = tr(C.name);
    const parts = name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:" + vEscape(last) + ";" + vEscape(parts[0]) + ";;;",
      "FN:" + vEscape(name),
      "TITLE:" + vEscape(tr(C.role)),
      "TEL;TYPE=CELL:" + vEscape(C.contact.phone),
      "EMAIL:" + vEscape(C.contact.email),
      "URL:" + vEscape(pageUrl),
      "NOTE:" + vEscape(tr(C.about)),
      "END:VCARD",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name + ".vcf" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- QR и «Поделиться» ---------- */

  const qrReady = typeof QRCode !== "undefined";
  const shareMode = navigator.share ? "share"
    : (navigator.clipboard && window.isSecureContext) ? "copy" : null;

  function renderQr() {
    const box = $("qr");
    if (!qrReady) {
      box.textContent = ui("qrOffline");
      return;
    }
    new QRCode(box, {
      text: pageUrl,
      width: 184,
      height: 184,
      colorDark: "#1B1B18",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M,
    });
    // библиотека добавляет title с длинной ссылкой — описание уже есть в aria-label
    box.removeAttribute("title");
  }

  function setupShare() {
    const btn = $("share-btn");
    const status = $("share-status");
    if (!shareMode) return;
    btn.hidden = false;
    btn.addEventListener("click", () => {
      if (shareMode === "share") {
        navigator.share({ title: tr(C.name), text: tr(C.role), url: pageUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(pageUrl)
          .then(() => { status.textContent = ui("copied"); })
          .catch(() => { status.textContent = ui("copyFail"); });
      }
    });
  }

  function renderShareTexts() {
    $("share-btn").textContent = ui(shareMode === "share" ? "share" : "copyLink");
    $("share-status").textContent = "";
    if (!qrReady) $("qr").textContent = ui("qrOffline");
  }

  /* ---------- Запуск ---------- */

  function renderAll() {
    applyStaticTexts();
    renderAvatar();
    renderProfile();
    renderBanners();
    renderChips();
    renderTours();
    renderShareTexts();
  }

  renderAll();
  renderQr();
  setupShare();
  setupBookingLink();
  $("save-contact").addEventListener("click", downloadVCard);
})();
