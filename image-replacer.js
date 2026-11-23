(() => {
  const DB_NAME = "portfolio-image-replacements";
  const STORE_NAME = "images";
  const openDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const database = openDatabase();
  const blobs = new Map();
  let selectedKey = "";
  let selectedImage = null;

  const toolbar = document.createElement("aside");
  toolbar.className = "image-replacer-toolbar";
  toolbar.setAttribute("aria-label", "图片替换工具");
  toolbar.innerHTML = `
    <p class="image-replacer-toolbar__hint">点击页面图片选择新图片</p>
    <span class="image-replacer-toolbar__status" aria-live="polite">替换会保存在本机浏览器</span>
    <button type="button" data-action="restore" disabled>恢复原图</button>
    <button type="button" data-action="exit">完成</button>
    <input type="file" accept="image/*" aria-label="选择替换图片" />
  `;
  document.body.append(toolbar);
  document.body.classList.add("image-replace-mode");

  const status = toolbar.querySelector(".image-replacer-toolbar__status");
  const restoreButton = toolbar.querySelector('[data-action="restore"]');
  const fileInput = toolbar.querySelector('input[type="file"]');

  const getOriginalUrl = (image) => {
    const existing = image.dataset.imageReplaceKey;
    const source = image.getAttribute("src") || image.getAttribute("data-src");
    if (!source) return existing || "";
    if (source.startsWith("blob:") || source.startsWith("data:")) return existing || "";
    const key = new URL(source, document.baseURI).href;
    if (existing === key) return existing;
    image.dataset.imageReplaceKey = key;
    image.dataset.imageReplaceOriginal = source;
    return key;
  };

  const transaction = async (mode, key, value) => {
    const db = await database;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = mode === "delete" ? store.delete(key) : store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const fetchReplacement = async (key) => {
    const db = await database;
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  };

  const matchingImages = (key) => [...document.images].filter((image) => getOriginalUrl(image) === key);
  const applyBlob = (key, blob) => {
    const previousUrl = blobs.get(key);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const objectUrl = URL.createObjectURL(blob);
    blobs.set(key, objectUrl);
    matchingImages(key).forEach((image) => { image.src = objectUrl; });
  };

  const restoreOriginal = async (key) => {
    await transaction("delete", key);
    const objectUrl = blobs.get(key);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    blobs.delete(key);
    matchingImages(key).forEach((image) => {
      image.removeAttribute("src");
      const original = image.dataset.imageReplaceOriginal;
      if (original) image.setAttribute("src", original);
      image.removeAttribute("data-image-replaced");
    });
    status.textContent = "已恢复原图";
    restoreButton.disabled = true;
  };

  const loadReplacementIfPresent = async (image) => {
    const key = getOriginalUrl(image);
    if (!key || image.dataset.imageReplaced === "true") return;
    try {
      const blob = await fetchReplacement(key);
      if (blob && image.isConnected) {
        applyBlob(key, blob);
        image.dataset.imageReplaced = "true";
      }
    } catch {
      status.textContent = "图片存储不可用，请检查浏览器设置";
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) {
        loadReplacementIfPresent(record.target);
      }
      for (const node of record.addedNodes || []) {
        if (node instanceof HTMLImageElement) loadReplacementIfPresent(node);
        node.querySelectorAll?.("img").forEach(loadReplacementIfPresent);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "data-src"] });
  document.images.forEach(loadReplacementIfPresent);

  document.addEventListener("pointerdown", (event) => {
    const image = event.target.closest?.("img");
    if (!image || !getOriginalUrl(image)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("click", (event) => {
    const image = event.target.closest?.("img");
    if (!image) return;
    const key = getOriginalUrl(image);
    if (!key) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectedImage = image;
    selectedKey = key;
    restoreButton.disabled = false;
    status.textContent = "请选择新图片";
    fileInput.value = "";
    fileInput.click();
  }, true);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file || !selectedKey) return;
    if (!file.type.startsWith("image/")) {
      status.textContent = "请选择图片文件";
      return;
    }
    try {
      await transaction("put", selectedKey, file);
      applyBlob(selectedKey, file);
      matchingImages(selectedKey).forEach((image) => { image.dataset.imageReplaced = "true"; });
      status.textContent = `已替换：${file.name}`;
      restoreButton.disabled = false;
    } catch {
      status.textContent = "保存失败，浏览器存储空间可能不足";
    }
  });

  restoreButton.addEventListener("click", async () => {
    if (!selectedKey) return;
    try {
      await restoreOriginal(selectedKey);
    } catch {
      status.textContent = "恢复失败，请刷新后重试";
    }
  });

  toolbar.querySelector('[data-action="exit"]').addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("editImages");
    location.href = url.href;
  });
})();
