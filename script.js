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
  const root = document.documentElement;
  const scrollCue = hero.querySelector(".hero__scroll");
  const video = hero.querySelector(".hero__video");
  const desktopPointer = window.matchMedia("(min-width: 768px) and (any-hover: hover) and (any-pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canStageReveal = () => desktopPointer.matches && !reducedMotion.matches;
  const revealDuration = 850;
  let revealed = !canStageReveal() || window.scrollY > 2 || Boolean(window.location.hash);
  let revealStartedAt = -Infinity;
  let lastBlockedWheelAt = -Infinity;

  if (revealed) root.classList.add("hero-revealed");
  else root.classList.add("hero-reveal-ready");

  const revealTitle = () => {
    if (revealed) return;
    revealed = true;
    revealStartedAt = performance.now();
    lastBlockedWheelAt = revealStartedAt;
    root.classList.add("hero-revealed");
  };

  const revealIsSettling = (now) =>
    now - revealStartedAt < revealDuration || now - lastBlockedWheelAt < 180;

  const blockWheel = (event, now) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    lastBlockedWheelAt = now;
  };

  window.addEventListener("wheel", (event) => {
    if (!canStageReveal() || window.scrollY > 2 || event.deltaY <= 0 || !hero.contains(event.target)) return;

    const now = performance.now();
    if (!revealed) {
      revealTitle();
      blockWheel(event, now);
    } else if (revealIsSettling(now)) {
      blockWheel(event, now);
    }
  }, { capture: true, passive: false });

  scrollCue?.addEventListener("click", (event) => {
    if (!canStageReveal() || window.scrollY > 2) return;
    if (!revealed || revealIsSettling(performance.now())) {
      event.preventDefault();
      event.stopPropagation();
      revealTitle();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!canStageReveal() || window.scrollY > 2 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!["ArrowDown", "PageDown", " "].includes(event.key)) return;
    if (event.target !== document.body && event.target !== root && !hero.contains(event.target)) return;
    if (!revealed || revealIsSettling(performance.now())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      revealTitle();
    }
  }, { capture: true });

  window.addEventListener("scroll", () => {
    if (!revealed && window.scrollY > 2) revealTitle();
  }, { passive: true });

  const revealWhenStageEnds = () => {
    if (!canStageReveal()) revealTitle();
  };
  desktopPointer.addEventListener("change", revealWhenStageEnds);
  reducedMotion.addEventListener("change", revealWhenStageEnds);

  if (video) {
    let heroVisible = true;
    const updateVideoPlayback = () => {
      if (reducedMotion.matches || document.hidden || !heroVisible) {
        video.pause();
      } else {
        video.play().catch(() => {});
      }
    };

    const showPoster = () => { video.hidden = true; };
    video.addEventListener("error", showPoster);
    video.querySelector("source")?.addEventListener("error", showPoster);
    document.addEventListener("visibilitychange", updateVideoPlayback);
    reducedMotion.addEventListener("change", updateVideoPlayback);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        updateVideoPlayback();
      }, { threshold: 0.01 }).observe(hero);
    }
    updateVideoPlayback();
  }

  root.classList.add("hero-reveal-bound");
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
const eventTrigger = document.querySelector(".work-card__open--event");
const eventViewer = document.getElementById("eventViewer");

if (eventTrigger && eventViewer) {
  const backButton = eventViewer.querySelector(".event-viewer__back");
  const media = [...eventViewer.querySelectorAll(".event-viewer__media")];
  let openedScrollY = 0;

  eventTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    eventViewer.showModal();
    eventViewer.scrollTop = 0;
    media.forEach((item) => { item.scrollLeft = 0; });
    document.documentElement.classList.add("event-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => eventViewer.close());
  eventViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("event-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    eventTrigger.focus({ preventScroll: true });
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

const dataTrigger = document.querySelector(".work-card__open--data");
const dataViewer = document.getElementById("dataViewer");

if (dataTrigger && dataViewer) {
  const backButton = dataViewer.querySelector(".data-viewer__back");
  let openedScrollY = 0;

  dataTrigger.addEventListener("click", () => {
    openedScrollY = window.scrollY;
    dataViewer.showModal();
    dataViewer.scrollTop = 0;
    dataViewer.scrollLeft = 0;
    document.documentElement.classList.add("data-viewer-open");
    pageScroller?.stop();
    backButton.focus({ preventScroll: true });
  });

  backButton.addEventListener("click", () => dataViewer.close());
  dataViewer.addEventListener("close", () => {
    document.documentElement.classList.remove("data-viewer-open");
    pageScroller?.start();
    if (Math.abs(window.scrollY - openedScrollY) > 1) {
      if (pageScroller) pageScroller.scrollTo(openedScrollY, { immediate: true, force: true });
      else window.scrollTo(0, openedScrollY);
    }
    dataTrigger.focus({ preventScroll: true });
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

const stackCards = [...document.querySelectorAll(".card-stack__card")];

if (stackCards.length) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactStack = window.matchMedia("(max-width: 1100px), (max-height: 700px)");
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

const ipItems = [...document.querySelectorAll(".ip-design__item")];

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
}

const portfolioContact = document.querySelector(".portfolio-contact");

if (portfolioContact && "IntersectionObserver" in window) {
  const contactTitle = portfolioContact.querySelector(".contact-title");
  const titleLines = [...portfolioContact.querySelectorAll("[data-decrypt-text]")];
  const contactDetails = [...portfolioContact.querySelectorAll(".contact-capabilities, .contact-methods")];
  const skipContactMotion = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 600px)");

  if (!skipContactMotion.matches) {
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
        else revealDetails();
      };

      requestAnimationFrame(animate);
    };

    Promise.resolve(document.fonts?.ready).then(() => {
      if (skipContactMotion.matches) return;
      const letters = prepareContactTitle();
      contactDetails.forEach((detail) => detail.classList.add("contact-reveal-pending"));

      const observer = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        if (skipContactMotion.matches) {
          revealDetails();
          return;
        }
        startContactAnimation(letters);
      }, { threshold: 0.2 });

      observer.observe(contactTitle);
    });

    skipContactMotion.addEventListener("change", () => {
      if (!skipContactMotion.matches) return;
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
