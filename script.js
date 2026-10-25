let startEntryWait;
let entrySceneReady = false;
let resolveEntryScene;
let entryScenePromise = new Promise((resolve) => {
  resolveEntryScene = resolve;
});

const resetEntryScene = () => {
  entrySceneReady = false;
  entryScenePromise = new Promise((resolve) => {
    resolveEntryScene = resolve;
  });
};

if (window.entryLoading) {
  const waitForImage = (image) => {
    image.loading = "eager";
    const decode = () => image.naturalWidth && typeof image.decode === "function"
      ? image.decode().catch(() => {})
      : Promise.resolve();
    if (image.complete) return decode();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    }).then(decode);
  };

  const desktopScene = window.matchMedia("(min-width: 768px)");
  const root = document.documentElement;
  let revision = 0;
  let minimumTimer;
  const isInViewport = (image) => {
    const bounds = image.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0
      && bounds.right > 0 && bounds.left < window.innerWidth
      && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };

  const checkVisibleAssets = () => {
    if (!root.classList.contains("is-entry-loading")) {
      desktopScene.removeEventListener("change", checkVisibleAssets);
      window.removeEventListener("resize", checkVisibleAssets);
      return;
    }
    const currentRevision = ++revision;
    clearTimeout(minimumTimer);
    let assets;
    if (desktopScene.matches) {
      assets = [entrySceneReady ? Promise.resolve() : entryScenePromise];
    } else {
      const mobileArt = document.querySelector(".hero__mobile-art");
      const visibleCardImages = [...document.querySelectorAll(".coverflow__card-image")]
        .filter(isInViewport);
      assets = [mobileArt, ...visibleCardImages].filter(Boolean).map(waitForImage);
    }

    Promise.allSettled(assets).then(() => {
      if (currentRevision !== revision || !root.classList.contains("is-entry-loading")) return;
      const remaining = Math.max(0, 450 - (performance.now() - window.entryLoading.startedAt));
      minimumTimer = setTimeout(() => {
        if (currentRevision !== revision) return;
        desktopScene.removeEventListener("change", checkVisibleAssets);
        window.removeEventListener("resize", checkVisibleAssets);
        window.entryLoading.finish();
      }, remaining);
    });
  };

  startEntryWait = () => {
    desktopScene.addEventListener("change", checkVisibleAssets);
    window.addEventListener("resize", checkVisibleAssets);
    checkVisibleAssets();
  };
}

const pageScroller = typeof Lenis !== "undefined"
  ? new Lenis({
      autoRaf: true,
      anchors: true,
      smoothWheel: true,
      syncTouch: true,
      stopInertiaOnNavigate: true,
      respectReducedMotion: true,
    })
  : null;

const hero = document.querySelector(".hero");

if (hero) {
  const scene = hero.querySelector(".hero__scene");
  if (scene) {
    const soundToggle = document.querySelector(".hero__sound-toggle");
    const interactionHint = hero.querySelector(".hero__interaction-hint");
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const sceneOrigin = window.location.protocol === "file:" ? "*" : window.location.origin;
    const desktopScene = window.matchMedia("(min-width: 768px)");
    const backgroundMusic = new Audio();
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3;
    backgroundMusic.preload = "none";
    let sceneVisible = true;
    let soundContext;
    let soundEnabled = true;
    let lastChimeAt = -Infinity;
    const playingVideos = new Set();
    let resumeMusicTimer;
    let sceneReady = false;
    let pendingStar = null;

    const updateSoundToggle = () => {
      if (!soundToggle) return;
      const isPlaying = soundEnabled && desktopScene.matches && !document.hidden && !backgroundMusic.paused;
      const label = isPlaying ? "关闭声音" : "开启声音";
      soundToggle.setAttribute("aria-label", label);
      soundToggle.setAttribute("aria-pressed", String(isPlaying));
      soundToggle.title = label;
    };

    const unlockSound = () => {
      if (!soundEnabled || !desktopScene.matches || document.hidden || !AudioContextClass) return;
      try {
        soundContext ||= new AudioContextClass();
        if (soundContext.state !== "running") soundContext.resume().catch(() => {});
      } catch {}
    };

    const startSound = () => {
      if (!soundEnabled || !desktopScene.matches || document.hidden || playingVideos.size) return;
      if (!backgroundMusic.hasAttribute("src")) {
        backgroundMusic.src = "./ICARUS.MP3";
        backgroundMusic.preload = "auto";
      }
      unlockSound();
      backgroundMusic.play().then(() => {
        if (!soundEnabled || !desktopScene.matches || document.hidden || playingVideos.size) backgroundMusic.pause();
        updateSoundToggle();
      }).catch(updateSoundToggle);
      updateSoundToggle();
    };

    const playChime = () => {
      const now = soundContext.currentTime;
      if (now - lastChimeAt < 0.12) return;
      lastChimeAt = now;

      const envelope = soundContext.createGain();
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      envelope.connect(soundContext.destination);

      let voicesLeft = 3;
      for (const [frequency, volume] of [[1046.5, 1], [1568, 0.3], [2093, 0.12]]) {
        const oscillator = soundContext.createOscillator();
        const partial = soundContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        partial.gain.value = volume;
        oscillator.connect(partial);
        partial.connect(envelope);
        oscillator.onended = () => {
          oscillator.disconnect();
          partial.disconnect();
          if (--voicesLeft === 0) envelope.disconnect();
        };
        oscillator.start(now);
        oscillator.stop(now + 0.46);
      }
    };

    if (soundToggle) {
      updateSoundToggle();
      soundToggle.addEventListener("click", () => {
        if (soundEnabled && backgroundMusic.paused) {
          startSound();
        } else {
          soundEnabled = !soundEnabled;
          if (soundEnabled) startSound();
          else backgroundMusic.pause();
          updateSoundToggle();
        }
      });
      const startAfterInteraction = (event) => {
        if (event.target instanceof Node && soundToggle.contains(event.target)) return;
        if (backgroundMusic.paused) startSound();
        else unlockSound();
      };
      window.addEventListener("pointerdown", startAfterInteraction, { capture: true });
      window.addEventListener("keydown", startAfterInteraction, { capture: true });
    }

    backgroundMusic.addEventListener("play", updateSoundToggle);
    backgroundMusic.addEventListener("pause", updateSoundToggle);
    for (const video of document.querySelectorAll("video")) {
      video.addEventListener("play", () => {
        clearTimeout(resumeMusicTimer);
        playingVideos.add(video);
        backgroundMusic.pause();
        updateSoundToggle();
      });

      const resumeAfterVideo = () => {
        if (!playingVideos.delete(video) || playingVideos.size) return;
        clearTimeout(resumeMusicTimer);
        resumeMusicTimer = setTimeout(startSound, 150);
      };
      video.addEventListener("pause", resumeAfterVideo);
      video.addEventListener("ended", resumeAfterVideo);
      video.addEventListener("error", resumeAfterVideo);
      video.addEventListener("emptied", resumeAfterVideo);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) backgroundMusic.pause();
      else startSound();
      updateSoundToggle();
    });

    window.addEventListener("message", (event) => {
      if (event.source !== scene.contentWindow) return;
      if (window.location.protocol !== "file:" && event.origin !== window.location.origin) return;
      if (event.data?.type === "portfolio-scene:interactive-star") {
        interactionHint?.classList.add("is-dismissed");
        interactionHint?.setAttribute("aria-hidden", "true");
        return;
      }
      if (event.data?.type !== "portfolio-scene:star-impact") return;
      if (!soundEnabled || !desktopScene.matches || !sceneVisible || document.hidden) return;
      if (soundContext?.state === "running") playChime();
    });

    const sendInteractiveStar = (point) => {
      if (!sceneReady) {
        pendingStar = point;
        return;
      }
      scene.contentWindow?.postMessage({ type: "portfolio-scene:interactive-star", ...point }, sceneOrigin);
    };

    hero.addEventListener("click", (event) => {
      if (!desktopScene.matches || document.hidden || !sceneVisible || !scene.hasAttribute("src")) return;
      if (event.target instanceof Element && event.target.closest(".hero__categories, .hero__sound-toggle")) return;
      const bounds = scene.getBoundingClientRect();
      sendInteractiveStar({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    });

    const syncScene = () => {
      if (!desktopScene.matches || !scene.hasAttribute("src")) return;
      scene.contentWindow?.postMessage(
        { type: sceneVisible ? "portfolio-scene:resume" : "portfolio-scene:pause" },
        sceneOrigin
      );
    };

    const syncSceneWidth = () => {
      if (desktopScene.matches) {
        if (!scene.hasAttribute("src")) {
          sceneReady = false;
          resetEntryScene();
          scene.src = scene.dataset.src;
        }
        else syncScene();
        startSound();
      } else {
        backgroundMusic.pause();
        if (scene.hasAttribute("src")) {
          scene.contentWindow?.postMessage({ type: "portfolio-scene:pause" }, sceneOrigin);
          scene.removeAttribute("src");
          sceneReady = false;
          resetEntryScene();
          pendingStar = null;
        }
      }
      updateSoundToggle();
    };

    scene.addEventListener("load", () => {
      if (!desktopScene.matches || !scene.hasAttribute("src")) return;
      sceneReady = true;
      entrySceneReady = true;
      resolveEntryScene();
      syncScene();
      if (pendingStar) {
        sendInteractiveStar(pendingStar);
        pendingStar = null;
      }
    });
    desktopScene.addEventListener("change", syncSceneWidth);
    syncSceneWidth();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        sceneVisible = entry.isIntersecting;
        syncScene();
      }, { threshold: 0.01 }).observe(hero);
    }
  }
}

if ("IntersectionObserver" in window) {
  const targets = document.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
  );

  for (const target of targets) observer.observe(target);
  document.documentElement.classList.add("has-reveal");
}

const workCards = document.querySelector(".work-collection__cards");

if (workCards) {
  const cards = [...workCards.querySelectorAll(".work-card, .work-collection__placeholder")];
  const desktopPointer = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)");

  const updateBorderPosition = (event) => {
    if (event.pointerType !== "mouse" || !desktopPointer.matches) return;

    for (const card of cards) {
      const bounds = card.getBoundingClientRect();
      const distanceX = Math.max(bounds.left - event.clientX, 0, event.clientX - bounds.right);
      const distanceY = Math.max(bounds.top - event.clientY, 0, event.clientY - bounds.bottom);
      const isNearby = Math.hypot(distanceX, distanceY) <= 210;

      card.style.setProperty("--border-x", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--border-y", `${event.clientY - bounds.top}px`);
      card.style.setProperty("--border-opacity", isNearby ? "1" : "0");
    }
  };

  workCards.addEventListener("pointerenter", updateBorderPosition);
  workCards.addEventListener("pointermove", updateBorderPosition);
  workCards.addEventListener("pointerleave", () => {
    for (const card of cards) card.style.setProperty("--border-opacity", "0");
  });
}

const compactWorkViewer = window.matchMedia("(max-width: 900px)");
const ecommerceTrigger = document.querySelector(".ecommerce-design__open");
const ecommerceViewer = document.getElementById("ecommerceViewer");

if (ecommerceTrigger && ecommerceViewer) {
  const backButton = ecommerceViewer.querySelector(".ecommerce-viewer__back");
  let openedScrollY = 0;

  ecommerceTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    ecommerceViewer.showModal();
    ecommerceViewer.scrollTop = 0;
    document.documentElement.classList.add("ecommerce-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => ecommerceViewer.close());
  ecommerceViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("ecommerce-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    ecommerceTrigger.focus({ preventScroll: true });
  });
}

const ipTrigger = document.querySelector(".work-card__open--ip");
const ipViewer = document.getElementById("ipViewer");

if (ipTrigger && ipViewer) {
  const backButton = ipViewer.querySelector(".ip-viewer__back");
  let openedScrollY = 0;

  ipTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    ipViewer.showModal();
    ipViewer.scrollTop = 0;
    document.documentElement.classList.add("ip-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => ipViewer.close());
  ipViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("ip-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    ipTrigger.focus({ preventScroll: true });
  });
}

const appTrigger = document.querySelector(".work-card__open--app");
const appViewer = document.getElementById("appViewer");

if (appTrigger && appViewer) {
  const stage = appViewer.querySelector(".app-viewer__stage");
  const track = appViewer.querySelector(".app-viewer__track");
  const slides = [...appViewer.querySelectorAll(".app-viewer__slide")];
  const backButton = appViewer.querySelector(".app-viewer__back");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let openedScrollY = 0;
  let dragStart = null;
  let currentIndex = 0;
  let wheelTotal = 0;
  let wheelIdleTimer;
  let wheelGestureHandled = false;
  let scrollIdleTimer;

  const slideOffset = (slide) => {
    const slideRect = slide.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return stage.scrollLeft + slideRect.left - stageRect.left + slideRect.width / 2 - stage.clientWidth / 2;
  };

  const centerSlide = (index, animate = true) => {
    currentIndex = Math.max(0, Math.min(slides.length - 1, index));
    stage.scrollTo({
      left: slideOffset(slides[currentIndex]),
      behavior: animate && !reducedMotion.matches ? "smooth" : "auto",
    });
  };

  const updateSidePadding = () => {
    track.style.paddingLeft = `${Math.max(24, (stage.clientWidth - slides[0].getBoundingClientRect().width) / 2)}px`;
    track.style.paddingRight = `${Math.max(24, (stage.clientWidth - slides.at(-1).getBoundingClientRect().width) / 2)}px`;
  };

  const nearestSlideIndex = () => slides.reduce((closest, slide, index) => (
    Math.abs(slideOffset(slide) - stage.scrollLeft) < Math.abs(slideOffset(slides[closest]) - stage.scrollLeft) ? index : closest
  ), 0);

  appTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    appViewer.showModal();
    if (compactWorkViewer.matches) {
      track.style.paddingLeft = "";
      track.style.paddingRight = "";
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    } else {
      updateSidePadding();
      centerSlide(0, false);
    }
    document.documentElement.classList.add("app-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => appViewer.close());
  appViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("app-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    appTrigger.focus({ preventScroll: true });
  });

  appViewer.addEventListener("keydown", (event) => {
    if (compactWorkViewer.matches) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      centerSlide(currentIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  stage.addEventListener("wheel", (event) => {
    if (event.ctrlKey || compactWorkViewer.matches) return;
    event.preventDefault();
    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      wheelTotal = 0;
      wheelGestureHandled = false;
    }, 180);
    if (wheelGestureHandled) return;
    const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const delta = rawDelta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    wheelTotal += delta;
    if (Math.abs(wheelTotal) < 35) return;
    centerSlide(currentIndex + Math.sign(wheelTotal));
    wheelTotal = 0;
    wheelGestureHandled = true;
  }, { passive: false });

  stage.addEventListener("scroll", () => {
    if (compactWorkViewer.matches) return;
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      currentIndex = nearestSlideIndex();
    }, 140);
  });

  stage.addEventListener("pointerdown", (event) => {
    if (compactWorkViewer.matches) return;
    if (event.pointerType !== "mouse" || event.button !== 0 || event.target.closest(".app-viewer__copy")) return;
    dragStart = { x: event.clientX, scrollLeft: stage.scrollLeft };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("is-dragging");
  });

  stage.addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    stage.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.x);
  });

  const endDrag = () => {
    if (dragStart && !compactWorkViewer.matches) centerSlide(nearestSlideIndex());
    dragStart = null;
    stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("lostpointercapture", endDrag);

  window.addEventListener("resize", () => {
    if (!appViewer.open) return;
    if (compactWorkViewer.matches) return;
    updateSidePadding();
    centerSlide(currentIndex, false);
  });

  compactWorkViewer.addEventListener("change", () => {
    if (!appViewer.open) return;
    dragStart = null;
    stage.classList.remove("is-dragging");
    stage.scrollTop = 0;
    if (compactWorkViewer.matches) {
      track.style.paddingLeft = "";
      track.style.paddingRight = "";
      stage.scrollLeft = 0;
    } else {
      updateSidePadding();
      centerSlide(currentIndex, false);
    }
  });
}

const creativeTrigger = document.querySelector(".work-card__open--creative");
const creativeViewer = document.getElementById("creativeViewer");

if (creativeTrigger && creativeViewer) {
  const backButton = creativeViewer.querySelector(".creative-viewer__back");
  let openedScrollY = 0;

  creativeTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    creativeViewer.showModal();
    creativeViewer.scrollTop = 0;
    creativeViewer.scrollLeft = 0;
    document.documentElement.classList.add("creative-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => creativeViewer.close());
  creativeViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("creative-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    creativeTrigger.focus({ preventScroll: true });
  });
}

const researchTrigger = document.querySelector(".work-card__open--research");
const researchViewer = document.getElementById("researchViewer");

if (researchTrigger && researchViewer) {
  const track = researchViewer.querySelector(".research-viewer__track");
  const slides = [...researchViewer.querySelectorAll(".research-viewer__slide")];
  const stage = researchViewer.querySelector(".research-viewer__stage");
  const backButton = researchViewer.querySelector(".research-viewer__back");
  const previousButton = researchViewer.querySelector(".research-viewer__previous");
  const nextButton = researchViewer.querySelector(".research-viewer__next");
  const count = researchViewer.querySelector(".research-viewer__count");
  let currentSlide = 0;
  let openedScrollY = 0;
  let wheelTotal = 0;
  let lastWheelTime = 0;
  let wheelLockedUntil = 0;
  let touchStart = null;

  const showSlide = (index) => {
    if (compactWorkViewer.matches) return;
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    if (currentSlide === nextIndex && researchViewer.open) return;

    currentSlide = nextIndex;
    track.classList.toggle("is-second", currentSlide === 1);
    slides.forEach((slide, slideIndex) => {
      slide.setAttribute("aria-hidden", String(slideIndex !== currentSlide));
    });
    previousButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === slides.length - 1;
    count.textContent = `${currentSlide + 1} / ${slides.length}`;
  };

  const syncResearchMode = () => {
    track.classList.toggle("is-second", !compactWorkViewer.matches && currentSlide === 1);
    slides.forEach((slide, index) => {
      slide.setAttribute("aria-hidden", String(!compactWorkViewer.matches && index !== currentSlide));
    });
    previousButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === slides.length - 1;
    count.textContent = `${currentSlide + 1} / ${slides.length}`;
    if (compactWorkViewer.matches) stage.scrollTop = 0;
  };

  researchTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    wheelTotal = 0;
    lastWheelTime = 0;
    wheelLockedUntil = 0;
    touchStart = null;
    currentSlide = 0;
    showSlide(0);
    researchViewer.showModal();
    syncResearchMode();
    document.documentElement.classList.add("research-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => researchViewer.close());
  researchViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("research-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    researchTrigger.focus({ preventScroll: true });
  });

  previousButton.addEventListener("click", () => showSlide(currentSlide - 1));
  nextButton.addEventListener("click", () => showSlide(currentSlide + 1));

  researchViewer.addEventListener("keydown", (event) => {
    if (compactWorkViewer.matches) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(currentSlide + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  researchViewer.addEventListener("wheel", (event) => {
    if (compactWorkViewer.matches) return;
    event.preventDefault();
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const now = performance.now();
    if (now < wheelLockedUntil) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (now - lastWheelTime > 200 || Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    lastWheelTime = now;
    wheelTotal += delta;

    if (Math.abs(wheelTotal) >= 65) {
      showSlide(currentSlide + Math.sign(wheelTotal));
      wheelTotal = 0;
      wheelLockedUntil = now + 550;
    }
  }, { passive: false });

  stage.addEventListener("touchstart", (event) => {
    if (compactWorkViewer.matches) return;
    touchStart = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }, { passive: true });

  stage.addEventListener("touchend", (event) => {
    if (compactWorkViewer.matches) return;
    if (!touchStart || event.changedTouches.length !== 1) return;
    const distanceX = event.changedTouches[0].clientX - touchStart.x;
    const distanceY = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(distanceX) > 50 && Math.abs(distanceX) > Math.abs(distanceY) * 1.2) {
      showSlide(currentSlide + (distanceX < 0 ? 1 : -1));
    }
  }, { passive: true });

  compactWorkViewer.addEventListener("change", () => {
    if (researchViewer.open) syncResearchMode();
  });
}

const quizTrigger = document.querySelector(".work-card__open--quiz");
const quizViewer = document.getElementById("quizViewer");

if (quizTrigger && quizViewer) {
  const backButton = quizViewer.querySelector(".quiz-viewer__back");
  const activities = [...quizViewer.querySelectorAll(".quiz-viewer__activity")];
  const flows = [...quizViewer.querySelectorAll(".quiz-viewer__flow")];
  const peachResult = quizViewer.querySelector(".quiz-viewer__result");
  const aiResult = quizViewer.querySelector(".quiz-viewer__ai-result");
  const resultImage = peachResult.querySelector(".quiz-viewer__result-image");
  const previousButton = peachResult.querySelector(".quiz-viewer__result-arrow--previous");
  const nextButton = peachResult.querySelector(".quiz-viewer__result-arrow--next");
  const resultCount = peachResult.querySelector(".quiz-viewer__result-count");
  const aiResultImage = aiResult.querySelector(".quiz-viewer__ai-result-image");
  const aiPreviousButton = aiResult.querySelector(".quiz-viewer__result-arrow--previous");
  const aiNextButton = aiResult.querySelector(".quiz-viewer__result-arrow--next");
  const aiResultCount = aiResult.querySelector(".quiz-viewer__result-count");
  const aiVideo = quizViewer.querySelector(".quiz-viewer__ai-video video");
  const aiVideoPlay = quizViewer.querySelector(".quiz-viewer__video-play");
  const aiPopupVideo = quizViewer.querySelector(".quiz-viewer__ai-popup video");
  const colorVideo = quizViewer.querySelector(".quiz-viewer__color-video video");
  const quizVideos = [aiVideo, aiPopupVideo, colorVideo];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const resultImages = [1, 2, 3, 4].map((number) => `./pic/测试结果/桃花结果${number}.png`);
  const aiResultImages = Array.from({ length: 8 }, (_, index) => `./pic/测试结果/恋人结果${index + 1}.png`);
  let resultIndex = 0;
  let aiResultIndex = 0;
  let activityIndex = 0;
  let openedScrollY = 0;
  let wheelTotal = 0;
  let lastWheelTime = 0;
  let wheelLockedUntil = 0;
  let touchStart = null;

  const showResult = (index) => {
    resultIndex = Math.max(0, Math.min(resultImages.length - 1, index));
    resultImage.src = resultImages[resultIndex];
    resultImage.alt = `桃花签测试结果 ${resultIndex + 1}，共 ${resultImages.length} 个结果`;
    resultCount.textContent = `${resultIndex + 1} / ${resultImages.length}`;
    previousButton.disabled = resultIndex === 0;
    nextButton.disabled = resultIndex === resultImages.length - 1;
  };

  const showAiResult = (index) => {
    aiResultIndex = Math.max(0, Math.min(aiResultImages.length - 1, index));
    aiResultImage.src = aiResultImages[aiResultIndex];
    aiResultImage.alt = `AI 恋人测试结果 ${aiResultIndex + 1}，共 ${aiResultImages.length} 个结果`;
    aiResultCount.textContent = `${aiResultIndex + 1} / ${aiResultImages.length}`;
    aiPreviousButton.disabled = aiResultIndex === 0;
    aiNextButton.disabled = aiResultIndex === aiResultImages.length - 1;
  };

  const showActivity = (index, focus = false) => {
    const nextIndex = Math.max(0, Math.min(activities.length - 1, index));
    if (activityIndex === nextIndex && quizViewer.open) return;

    if (nextIndex === 2 && activityIndex !== 2) flows[2].scrollTop = 0;
    activityIndex = nextIndex;
    quizViewer.classList.toggle("is-ai", activityIndex === 1);
    quizViewer.classList.toggle("is-color", activityIndex === 2);
    activities.forEach((activity, activityNumber) => {
      const active = activityNumber === activityIndex;
      activity.setAttribute("aria-hidden", String(!active));
      if (active) activity.removeAttribute("inert");
      else activity.setAttribute("inert", "");
    });

    if (activityIndex === 1 && !compactWorkViewer.matches) {
      if (!aiPopupVideo.getAttribute("src")) aiPopupVideo.src = aiPopupVideo.dataset.src;
      if (!reducedMotion.matches) aiPopupVideo.play()?.catch(() => {});
    } else {
      aiPopupVideo.pause();
      aiVideo.pause();
    }
    if (activityIndex === 2 && !compactWorkViewer.matches) {
      if (!colorVideo.getAttribute("src")) colorVideo.src = colorVideo.dataset.src;
      if (!reducedMotion.matches) colorVideo.play()?.catch(() => {});
    } else colorVideo.pause();
    if (focus) activities[activityIndex].focus({ preventScroll: true });
  };

  const syncQuizMode = () => {
    activities.forEach((activity, index) => {
      const visible = compactWorkViewer.matches || index === activityIndex;
      activity.setAttribute("aria-hidden", String(!visible));
      if (visible) activity.removeAttribute("inert");
      else activity.setAttribute("inert", "");
    });
    if (compactWorkViewer.matches) {
      for (const video of quizVideos) {
        video.pause();
        if (video.hasAttribute("src")) {
          video.removeAttribute("src");
          video.load();
        }
      }
      quizViewer.scrollTop = 0;
    } else if (activityIndex === 1) {
      if (!aiPopupVideo.hasAttribute("src")) aiPopupVideo.src = aiPopupVideo.dataset.src;
      if (!reducedMotion.matches) aiPopupVideo.play()?.catch(() => {});
    } else if (activityIndex === 2) {
      if (!colorVideo.hasAttribute("src")) colorVideo.src = colorVideo.dataset.src;
      if (!reducedMotion.matches) colorVideo.play()?.catch(() => {});
    }
  };

  quizTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    wheelTotal = 0;
    lastWheelTime = 0;
    wheelLockedUntil = 0;
    touchStart = null;
    showResult(0);
    showAiResult(0);
    showActivity(0);
    quizViewer.showModal();
    syncQuizMode();
    flows.forEach((flow) => { flow.scrollLeft = 0; });
    document.documentElement.classList.add("quiz-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => quizViewer.close());
  quizViewer.addEventListener("close", () => {
    aiVideo.pause();
    aiPopupVideo.pause();
    colorVideo.pause();
    showActivity(0);
    document.documentElement.classList.remove("quiz-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    quizTrigger.focus({ preventScroll: true });
  });

  previousButton.addEventListener("click", () => showResult(resultIndex - 1));
  nextButton.addEventListener("click", () => showResult(resultIndex + 1));
  aiPreviousButton.addEventListener("click", () => showAiResult(aiResultIndex - 1));
  aiNextButton.addEventListener("click", () => showAiResult(aiResultIndex + 1));
  aiVideoPlay.addEventListener("click", () => {
    if (compactWorkViewer.matches) return;
    if (!aiVideo.getAttribute("src")) aiVideo.src = aiVideo.dataset.src;
    aiVideo.play()?.catch(() => {});
  });
  aiVideo.addEventListener("play", () => aiVideo.parentElement.classList.add("is-playing"));
  aiVideo.addEventListener("pause", () => aiVideo.parentElement.classList.remove("is-playing"));
  aiVideo.addEventListener("ended", () => aiVideo.parentElement.classList.remove("is-playing"));
  reducedMotion.addEventListener("change", (event) => {
    if (event.matches) {
      aiPopupVideo.pause();
      colorVideo.pause();
    }
  });

  quizViewer.addEventListener("wheel", (event) => {
    if (compactWorkViewer.matches) return;
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    const flow = event.target.closest(".quiz-viewer__flow");
    if (event.shiftKey && flow) {
      flow.scrollLeft += event.deltaY;
      return;
    }

    const now = performance.now();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (activityIndex === 2) {
      const colorFlow = flows[2];
      const maxScroll = colorFlow.scrollHeight - colorFlow.clientHeight;
      if ((delta > 0 && colorFlow.scrollTop < maxScroll - 1) || (delta < 0 && colorFlow.scrollTop > 1)) {
        colorFlow.scrollTop += delta;
        wheelTotal = 0;
        return;
      }
      if (delta > 0) return;
    }
    if (now < wheelLockedUntil) return;
    if (now - lastWheelTime > 200 || Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    lastWheelTime = now;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) >= 65) {
      showActivity(activityIndex + Math.sign(wheelTotal), true);
      wheelTotal = 0;
      wheelLockedUntil = now + 650;
    }
  }, { passive: false });

  quizViewer.addEventListener("touchstart", (event) => {
    if (compactWorkViewer.matches) return;
    touchStart = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }, { passive: true });

  quizViewer.addEventListener("touchend", (event) => {
    if (compactWorkViewer.matches) return;
    if (!touchStart || event.changedTouches.length !== 1) return;
    const distanceX = event.changedTouches[0].clientX - touchStart.x;
    const distanceY = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(distanceY) > 60 && Math.abs(distanceY) > Math.abs(distanceX) * 1.2) {
      if (activityIndex === 2) {
        if (distanceY > 0 && flows[2].scrollTop <= 1) showActivity(1, true);
        return;
      }
      showActivity(activityIndex + (distanceY < 0 ? 1 : -1), true);
    }
  }, { passive: true });

  quizViewer.addEventListener("keydown", (event) => {
    if (compactWorkViewer.matches) return;
    if (event.target.closest("video")) return;
    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      const direction = (event.key === "ArrowDown" || event.key === "PageDown") ? 1 : -1;
      if (activityIndex === 2) {
        const colorFlow = flows[2];
        const maxScroll = colorFlow.scrollHeight - colorFlow.clientHeight;
        if ((direction > 0 && colorFlow.scrollTop < maxScroll - 1) || (direction < 0 && colorFlow.scrollTop > 1)) {
          colorFlow.scrollTop += direction * (event.key.startsWith("Page") ? colorFlow.clientHeight * 0.8 : 100);
          return;
        }
      }
      showActivity(activityIndex + direction, true);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (activityIndex === 0) showResult(resultIndex + (event.key === "ArrowRight" ? 1 : -1));
      else if (activityIndex === 1) showAiResult(aiResultIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });

  compactWorkViewer.addEventListener("change", () => {
    if (quizViewer.open) syncQuizMode();
  });
}

const aiVideoSection = document.querySelector(".ai-video");

if (aiVideoSection) {
  const works = [
    {
      title: "向日葵",
      tag: "竖屏 · 产品展示",
      description: "视觉方向：摄影级产品实拍感。一束晨光沿产品游走，逐步揭开整座向日葵庭院。温暖、细腻，适合突出成品。",
      src: "./pic/video/web/sunflower.mp4",
      poster: "./pic/video/posters/向日葵.webp",
      portrait: true,
    },
    {
      title: "vivo精彩随行",
      tag: "产品广告 · 手机TVC",
      description: "用高频使用场景来展示产品卖点：远处拍得清 → 身边拍得好 → 动态抓得住，然后卖点收束，进入产品展示，“这一切来自这台手机”，记录值得珍藏的鲜活记忆。",
      src: "./pic/video/手机更新2.mp4",
      poster: "./pic/video/posters/最新手机.webp",
    },
    {
      title: "珍爱APP短片",
      tag: "产品宣传",
      description: "从相似的日常切入，珍爱网中的活动成为相遇的契机，让两个陌生人从线上到线下，在自然相处与共同经历中，完成从“相遇”到“相爱”的情感递进。",
      src: "./pic/video/web/zhenai.mp4",
      poster: "./pic/video/posters/珍爱最新-换前段.webp",
    },
    {
      title: "安慕希\n整颗蓝莓酸奶",
      tag: "食品广告 · 奇幻动画",
      description: "把蓝莓拟人化、从种植园到入口的过程旅程化，从摘下枝头开始“锁鲜”，到通关时完好无损，叙事节奏松紧交替，强化故事情绪起伏。",
      src: "./pic/video/web/anmuxi.mp4",
      poster: "./pic/video/posters/鲜奇一路整颗满足.webp",
    },
  ];

  const player = aiVideoSection.querySelector(".ai-video__player");
  const title = aiVideoSection.querySelector(".ai-video__work-title");
  const tag = aiVideoSection.querySelector(".ai-video__tag");
  const description = aiVideoSection.querySelector(".ai-video__description");
  const currentNumber = aiVideoSection.querySelector(".ai-video__current");
  const errorMessage = aiVideoSection.querySelector(".ai-video__error");
  const screen = aiVideoSection.querySelector(".ai-video__screen");
  const rail = aiVideoSection.querySelector(".ai-video__rail");
  const thumbnails = [...aiVideoSection.querySelectorAll(".ai-video__thumb")];
  const compactRail = window.matchMedia("(max-width: 1250px)");
  let activeIndex = 0;
  let playRequest = 0;
  let userSelectedVideo = false;
  let firstVideoStartedByScroll = false;
  let screenVisible = false;
  let resumeFirstWhenVisible = false;
  const suspendedImages = new Map();

  const suspendOffscreenImages = () => {
    for (const image of document.querySelectorAll("main img")) {
      if (aiVideoSection.contains(image) || image.closest(".ecommerce-design__preview") || image.complete || !image.hasAttribute("src")) continue;
      const bounds = image.getBoundingClientRect();
      if (bounds.bottom > 0 && bounds.top < window.innerHeight) continue;
      suspendedImages.set(image, image.getAttribute("src"));
      image.removeAttribute("src");
    }
  };

  const restoreOffscreenImages = () => {
    for (const [image, src] of suspendedImages) {
      if (image.isConnected && !image.hasAttribute("src")) image.setAttribute("src", src);
    }
    suspendedImages.clear();
  };

  const updateRail = () => {
    const railHeight = rail.clientHeight;
    const thumbnailHeight = 70;
    const edgeGap = 8;
    const step = compactRail.matches ? 0 : Math.min(88, Math.max(0, (railHeight - 2 * edgeGap - thumbnailHeight) / (thumbnails.length - 1)));
    const firstCenter = railHeight / 2 - activeIndex * step;
    const lastCenter = railHeight / 2 + (thumbnails.length - 1 - activeIndex) * step;
    const minCenter = edgeGap + thumbnailHeight / 2;
    const maxCenter = railHeight - minCenter;
    const shift = compactRail.matches ? 0 : Math.min(maxCenter - lastCenter, Math.max(minCenter - firstCenter, 0));
    if (compactRail.matches) {
      rail.style.removeProperty("--ai-video-active-center");
    } else {
      rail.style.setProperty("--ai-video-active-center", `${railHeight / 2 + shift}px`);
    }

    thumbnails.forEach((thumbnail, index) => {
      const offset = index - activeIndex;
      const distance = Math.abs(offset);
      const isActive = offset === 0;
      thumbnail.classList.toggle("is-active", isActive);
      thumbnail.setAttribute("aria-pressed", String(isActive));

      if (compactRail.matches) {
        thumbnail.style.removeProperty("transform");
        thumbnail.style.removeProperty("opacity");
        thumbnail.style.removeProperty("z-index");
        return;
      }

      const x = distance * distance * 4;
      const y = offset * step + shift;
      const scale = Math.max(0.86, 1 - distance * 0.04) * (isActive ? 122 / 112 : 1);
      const opacity = Math.max(0.22, 1 - distance * 0.18);
      thumbnail.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale.toFixed(3)})`;
      thumbnail.style.opacity = String(opacity);
      thumbnail.style.zIndex = String(20 - distance);
    });
  };

  const releaseVideo = () => {
    player.pause();
    player.removeAttribute("src");
    player.load();
  };

  const setVideoStartMuted = () => {
    player.defaultMuted = true;
    player.muted = true;
    player.volume = 1;
  };

  const playVideo = (request) => {
    suspendOffscreenImages();
    player.play().catch(() => {
      if (request !== playRequest || !player.hasAttribute("src")) return;
      restoreOffscreenImages();
      errorMessage.textContent = "播放未能开始，请点击播放器的播放按钮或再次点击缩略图重试。";
      errorMessage.hidden = false;
    });
  };

  const selectVideo = (index) => {
    const work = works[index];
    if (!work) return;

    suspendOffscreenImages();
    const request = ++playRequest;
    releaseVideo();
    errorMessage.hidden = true;
    title.textContent = work.title;
    tag.textContent = work.tag;
    description.textContent = work.description;
    currentNumber.textContent = String(index + 1).padStart(2, "0");
    activeIndex = index;
    updateRail();

    screen.classList.toggle("is-portrait", Boolean(work.portrait));
    player.poster = work.poster;
    player.setAttribute("aria-label", work.title);
    player.controls = true;
    setVideoStartMuted();
    player.src = work.src;
    player.load();
    playVideo(request);
  };

  const playFirstWhenVisible = () => {
    if (compactRail.matches || document.hidden || !screenVisible || userSelectedVideo) return;

    if (!firstVideoStartedByScroll) {
      firstVideoStartedByScroll = true;
      selectVideo(0);
    } else if (resumeFirstWhenVisible && player.hasAttribute("src")) {
      resumeFirstWhenVisible = false;
      setVideoStartMuted();
      playVideo(++playRequest);
    }
  };

  thumbnails.forEach((thumbnail) => {
    thumbnail.addEventListener("click", () => {
      userSelectedVideo = true;
      resumeFirstWhenVisible = false;
      selectVideo(Number(thumbnail.dataset.videoIndex));
    });
  });
  compactRail.addEventListener("change", () => {
    updateRail();
    if (compactRail.matches && firstVideoStartedByScroll && !userSelectedVideo) {
      resumeFirstWhenVisible = player.hasAttribute("src") && !player.paused;
      player.pause();
      restoreOffscreenImages();
      ++playRequest;
    } else {
      playFirstWhenVisible();
    }
  });
  window.addEventListener("resize", updateRail);
  updateRail();

  player.addEventListener("playing", () => {
    errorMessage.hidden = true;
  });
  player.addEventListener("play", suspendOffscreenImages);

  player.addEventListener("error", () => {
    if (!player.error || !player.hasAttribute("src")) return;
    ++playRequest;
    releaseVideo();
    restoreOffscreenImages();
    errorMessage.textContent = "视频暂时无法播放，请再次点击缩略图重试。";
    errorMessage.hidden = false;
  });
  player.addEventListener("ended", restoreOffscreenImages);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (firstVideoStartedByScroll && !userSelectedVideo) {
        resumeFirstWhenVisible = player.hasAttribute("src") && !player.paused;
      }
      player.pause();
      restoreOffscreenImages();
      ++playRequest;
    } else {
      playFirstWhenVisible();
    }
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      screenVisible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
      if (!entry.isIntersecting) {
        if (firstVideoStartedByScroll && !userSelectedVideo) {
          resumeFirstWhenVisible = player.hasAttribute("src") && !player.paused;
        }
        player.pause();
        restoreOffscreenImages();
        ++playRequest;
      } else {
        playFirstWhenVisible();
      }
    }, { threshold: [0, 0.35] }).observe(screen);
  }
}

const stackCards = [...document.querySelectorAll(".card-stack__card")];

if (stackCards.length) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactStack = window.matchMedia("(max-width: 1100px), (max-height: 620px)");
  const usesStaticLayout = () => reducedMotion.matches || compactStack.matches;
  const settledScale = 0.96;
  const stackSurfaces = stackCards.map((card) => card.querySelector(".card-stack__surface"));
  let updateQueued = false;
  let outlineQueued = false;

  const drawStackOutlines = () => {
    outlineQueued = false;
    if (usesStaticLayout()) {
      for (const surface of stackSurfaces) {
        const number = surface.querySelector(".card-stack__number");
        number.style.removeProperty("top");
        number.style.removeProperty("height");
      }
      return;
    }
    const firstTop = Number.parseFloat(window.getComputedStyle(stackCards[0]).top);
    const secondTop = Number.parseFloat(window.getComputedStyle(stackCards[1]).top);
    const step = secondTop - firstTop;

    for (const [index, surface] of stackSurfaces.entries()) {
      const width = surface.clientWidth;
      const height = surface.clientHeight;
      const number = surface.querySelector(".card-stack__number");
      const outline = surface.querySelector(".card-stack__outline");
      const notch = Number.parseFloat(window.getComputedStyle(number).width);
      const radius = Number.parseFloat(window.getComputedStyle(surface).getPropertyValue("--stack-radius"));
      // At the settled scale, the three tabs span from card 01's top to card 03's bottom.
      const tabHeight = (height + (2 * step) / settledScale) / 3;
      const tabStart = index * (tabHeight - step / settledScale);
      const tabEnd = tabStart + tabHeight;
      const left = 1;
      const bodyLeft = notch;
      const right = width - 1;
      const top = 1;
      const bottom = height - 1;
      const corner = Math.min(radius, notch / 3, tabHeight / 4);

      number.style.top = `${tabStart}px`;
      number.style.height = `${tabHeight}px`;
      outline.setAttribute("viewBox", `0 0 ${width} ${height}`);

      let path = `M ${index === 0 ? left + corner : bodyLeft + corner} ${top} H ${right - corner} Q ${right} ${top} ${right} ${top + corner} V ${bottom - corner} Q ${right} ${bottom} ${right - corner} ${bottom}`;

      if (index === 2) {
        path += ` H ${left + corner} Q ${left} ${bottom} ${left} ${bottom - corner}`;
      } else {
        path += ` H ${bodyLeft + corner} Q ${bodyLeft} ${bottom} ${bodyLeft} ${bottom - corner} V ${tabEnd + corner} Q ${bodyLeft} ${tabEnd} ${bodyLeft - corner} ${tabEnd} H ${left + corner} Q ${left} ${tabEnd} ${left} ${tabEnd - corner}`;
      }

      if (index === 0) {
        path += ` V ${top + corner} Q ${left} ${top} ${left + corner} ${top} Z`;
      } else {
        path += ` V ${tabStart + corner} Q ${left} ${tabStart} ${left + corner} ${tabStart} H ${bodyLeft - corner} Q ${bodyLeft} ${tabStart} ${bodyLeft} ${tabStart - corner} V ${top + corner} Q ${bodyLeft} ${top} ${bodyLeft + corner} ${top} Z`;
      }
      outline.querySelector("path").setAttribute("d", path);
    }
  };

  const queueOutlineUpdate = () => {
    if (outlineQueued) return;
    outlineQueued = true;
    window.requestAnimationFrame(drawStackOutlines);
  };

  const updateStackScale = () => {
    updateQueued = false;

    for (const card of stackCards) {
      const surface = card.querySelector(".card-stack__surface");
      if (usesStaticLayout()) {
        surface.style.removeProperty("--stack-scale");
        continue;
      }

      const stopTop = Number.parseFloat(window.getComputedStyle(card).top);
      const scaleStart = Math.max(stopTop + 1, window.innerHeight * 0.45);
      const progress = Math.max(
        0,
        Math.min(1, (scaleStart - card.getBoundingClientRect().top) / (scaleStart - stopTop)),
      );
      surface.style.setProperty("--stack-scale", (1 - progress * (1 - settledScale)).toFixed(4));
    }
  };

  const queueStackUpdate = () => {
    if (updateQueued) return;
    updateQueued = true;
    window.requestAnimationFrame(updateStackScale);
  };

  window.addEventListener("scroll", queueStackUpdate, { passive: true });
  window.addEventListener("resize", queueStackUpdate);
  window.addEventListener("resize", queueOutlineUpdate);
  reducedMotion.addEventListener("change", queueStackUpdate);
  reducedMotion.addEventListener("change", queueOutlineUpdate);
  compactStack.addEventListener("change", queueStackUpdate);
  compactStack.addEventListener("change", queueOutlineUpdate);
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(queueOutlineUpdate);
    for (const surface of stackSurfaces) observer.observe(surface);
  }
  queueOutlineUpdate();
  queueStackUpdate();
}

const ipItems = [...document.querySelectorAll(".ip-design__item")].filter((item) => item.querySelector("video"));

if (ipItems.length) {
  const canPlayOnHover = window.matchMedia(
    "(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
  );
  const stopVideos = [];

  for (const item of ipItems) {
    const video = item.querySelector("video");
    let hoverVersion = 0;

    const stop = () => {
      hoverVersion += 1;
      item.classList.remove("is-playing");
      video.pause();
      if (video.readyState >= 1) video.currentTime = 0;
    };

    stopVideos.push(() => {
      stop();
      if (!canPlayOnHover.matches && video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
    });

    item.addEventListener("pointerenter", async (event) => {
      if (event.pointerType !== "mouse" || !canPlayOnHover.matches) return;
      const currentHover = ++hoverVersion;

      if (!video.hasAttribute("src")) {
        video.src = video.dataset.videoSrc;
        video.load();
      }

      try {
        await video.play();
        if (currentHover === hoverVersion && canPlayOnHover.matches) {
          item.classList.add("is-playing");
        } else {
          video.pause();
        }
      } catch {
        item.classList.remove("is-playing");
      }
    });

    item.addEventListener("pointerleave", stop);
    video.addEventListener("error", stop);
  }

  canPlayOnHover.addEventListener("change", () => {
    if (!canPlayOnHover.matches) stopVideos.forEach((stop) => stop());
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopVideos.forEach((stop) => stop());
  });
  ipViewer?.addEventListener("close", () => stopVideos.forEach((stop) => stop()));
}

const portfolioContact = document.querySelector(".portfolio-contact");

if (portfolioContact) {
  const titleLines = [...portfolioContact.querySelectorAll("[data-decrypt-text]")];
  const contactDetails = [...portfolioContact.querySelectorAll(".contact-capabilities, .contact-methods")];
  const skipContactMotion = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 600px)");

  if (!skipContactMotion.matches) {
    let stopWaitingForEnd = () => {};
    const prepareContactTitle = () => {
      const letters = [];

      for (const line of titleLines) {
        const characters = [...line.dataset.decryptText];
        const fragments = characters.map((character) => {
          const span = document.createElement("span");
          span.className = "contact-title-char";
          span.textContent = character;
          if (character !== " ") letters.push({ span, character });
          return span;
        });
        line.replaceChildren(...fragments);

        for (const span of fragments) {
          span.style.setProperty("--glyph-width", `${span.getBoundingClientRect().width}px`);
        }
      }

      return letters;
    };

    const revealDetails = () => {
      for (const detail of contactDetails) {
        detail.classList.remove("contact-reveal-pending");
        detail.classList.add("is-revealed");
      }
    };

    const startContactAnimation = (letters) => {
      const randomCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let startTime;

      const animate = (time) => {
        if (skipContactMotion.matches) {
          revealDetails();
          return;
        }
        if (startTime === undefined) startTime = time;
        const progress = Math.min((time - startTime) / 800, 1);

        letters.forEach(({ span, character }, index) => {
          const revealAt = 0.12 + ((index + 1) / letters.length) * 0.76;
          span.textContent = progress >= revealAt
            ? character
            : randomCharacters[Math.floor(Math.random() * randomCharacters.length)];
        });

        if (progress < 1) requestAnimationFrame(animate);
        else {
          titleLines.forEach((line) => { line.textContent = line.dataset.decryptText; });
          revealDetails();
        }
      };

      requestAnimationFrame(animate);
    };

    Promise.resolve(document.fonts?.ready).then(() => {
      if (skipContactMotion.matches) return;
      const letters = prepareContactTitle();
      contactDetails.forEach((detail) => detail.classList.add("contact-reveal-pending"));
      let animationStarted = false;

      const startNearPageEnd = () => {
        if (animationStarted) return;
        const scrollHeight = document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight;
        const remaining = scrollHeight - window.innerHeight - window.scrollY;
        if (remaining > Math.min(120, window.innerHeight * 0.16)) return;
        stopWaitingForEnd();
        if (skipContactMotion.matches) {
          revealDetails();
          return;
        }
        startContactAnimation(letters);
      };

      stopWaitingForEnd = () => {
        animationStarted = true;
        window.removeEventListener("scroll", startNearPageEnd);
        window.removeEventListener("resize", startNearPageEnd);
      };
      window.addEventListener("scroll", startNearPageEnd, { passive: true });
      window.addEventListener("resize", startNearPageEnd);
      startNearPageEnd();
    });

    skipContactMotion.addEventListener("change", () => {
      if (!skipContactMotion.matches) return;
      stopWaitingForEnd();
      titleLines.forEach((line) => { line.textContent = line.dataset.decryptText; });
      revealDetails();
    });
  }
}

const backToTop = document.getElementById("backToTop");

if (backToTop) {
  const updateBackToTop = () => {
    backToTop.classList.toggle("is-visible", window.scrollY > 600);
  };

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  updateBackToTop();

  backToTop.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (pageScroller) {
      pageScroller.scrollTo(0, { immediate: reduceMotion, duration: 0.8, force: true });
    } else {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
}

const coverflow = document.querySelector(".coverflow");

if (coverflow) {
  const slides = [
    { number: "01", src: "./pic/组件/01.png", alt: "户外木质机械蜻蜓与莲花装置" },
    { number: "02", src: "./pic/组件/02.png", alt: "木质机械小提琴与红色帷幕" },
    { number: "03", src: "./pic/组件/03.png", alt: "缘·记忆手卡包装展示" },
    { number: "04", src: "./pic/组件/04.png", alt: "万用模板手卡包装展示" },
    { number: "05", src: "./pic/组件/手卡1.png", alt: "识字碰碰卡包装与竖立的识字卡片" },
    { number: "06", src: "./pic/组件/手卡2.png", alt: "识字碰碰卡包装与铺开的识字卡片" },
    { number: "07", src: "./pic/组件/05.png", alt: "深色花园中的香水瓶" },
    { number: "08", src: "./pic/组件/06.png", alt: "白色花朵间的香水瓶" },
    { number: "09", src: "./pic/组件/07.png", alt: "水边的木质机械小提琴装置" },
  ];

  const stage = coverflow.querySelector(".coverflow__stage");
  const track = coverflow.querySelector(".coverflow__track");
  const status = coverflow.querySelector(".coverflow__status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards = slides.map((slide, index) => {
    const card = document.createElement("div");
    card.className = "coverflow__card";
    card.setAttribute("role", "group");
    card.setAttribute("aria-roledescription", "slide");
    card.setAttribute("aria-label", `第 ${index + 1} 张，共 ${slides.length} 张`);
    if (slide.gradient) card.style.setProperty("--coverflow-gradient", slide.gradient);

    if (slide.src) {
      const image = document.createElement("img");
      image.className = "coverflow__card-image";
      image.src = slide.src;
      image.alt = slide.alt || `作品 ${slide.number}`;
      image.draggable = false;
      image.loading = index === 0 ? "eager" : "lazy";
      card.append(image);
    } else {
      card.classList.add("is-placeholder");
      const number = document.createElement("span");
      number.className = "coverflow__card-number";
      number.textContent = slide.number;
      number.setAttribute("aria-hidden", "true");
      card.append(number);
    }

    track.append(card);
    return card;
  });

  let position = 0;
  let target = 0;
  let cardWidth = 0;
  const pitchRatio = 0.985;
  let animationFrame = null;
  let drag = null;

  const selectedIndex = (value) => ((Math.round(value) % slides.length) + slides.length) % slides.length;

  const updateSelection = (value) => {
    const selected = selectedIndex(value);
    cards.forEach((card, index) => {
      if (index === selected) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    });
    status.textContent = `第 ${selected + 1} 张，共 ${slides.length} 张`;
  };

  const paint = () => {
    if (!cardWidth) return;
    const pitch = cardWidth * pitchRatio;

    cards.forEach((card, index) => {
      let offset = ((index - position) % slides.length + slides.length) % slides.length;
      if (offset > slides.length / 2) offset -= slides.length;

      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, 0.56);
      const tilt = Math.min(44 * ramp, 82) * Math.sign(offset);
      const edge = Math.min(1, Math.max(0, slides.length / 2 - distance));

      card.style.transform = `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-0.6 * cardWidth * ramp}px) rotateY(${-tilt}deg)`;
      card.style.opacity = String(Math.max(0, 1 - 0.1 * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  };

  const settle = (next) => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    target = next;
    updateSelection(target);

    if (reduceMotion.matches) {
      position = target;
      animationFrame = null;
      paint();
      return;
    }

    const step = () => {
      const remaining = target - position;
      if (Math.abs(remaining) < 0.0004) {
        position = target;
        paint();
        animationFrame = null;
        return;
      }
      position += remaining * 0.16;
      paint();
      animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
  };

  const measure = () => {
    cardWidth = cards[0].offsetWidth;
    paint();
  };

  measure();
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(stage);
  else window.addEventListener("resize", measure);

  stage.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    settle(Math.round(target) + (event.key === "ArrowRight" ? 1 : -1));
  });

  stage.addEventListener("pointerdown", (event) => {
    if (drag || !event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    stage.setPointerCapture(event.pointerId);
    target = position;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      startPosition: position,
      velocity: 0,
      time: performance.now(),
    };
    stage.classList.add("is-dragging");
  });

  stage.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId || !cardWidth) return;
    const now = performance.now();
    const previous = position;
    position = drag.startPosition - (event.clientX - drag.x) / (cardWidth * pitchRatio);
    drag.velocity = (position - previous) / Math.max(now - drag.time, 1) * 1000;
    drag.time = now;
    paint();
  });

  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const velocity = performance.now() - drag.time > 100 ? 0 : drag.velocity;
    const carried = event.type === "pointercancel" ? 0 : Math.max(-2, Math.min(2, velocity * 0.18));
    drag = null;
    stage.classList.remove("is-dragging");
    settle(Math.round(position + carried));
  };

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("lostpointercapture", endDrag);
  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches && animationFrame !== null) settle(target);
  });
  updateSelection(0);
}

startEntryWait?.();
