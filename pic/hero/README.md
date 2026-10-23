# 流星窗景首屏：移植说明

这份包从 `meteor-window-study/index.html` 拆出动画，并与练习页同步使用兔子形象。`scene.html` 只包含背景、窗户、流星、瓶子、窗台星星和兔子，不包含 `PORTFOLIO`、分类文字或 `xiaohong`。新页面可以独立安排标题、导航和作品内容。

## 文件

| 文件 | 用途 |
| --- | --- |
| `scene.html` | 可独立运行的纯动画页，HTML、CSS、SVG、JavaScript 都在同一文件中，无外部素材依赖。 |
| `host-example.html` | 首屏接入示例。分类已经写成可点击链接，下一屏是占位板块。 |
| `README.md` | 当前版式、动态内容和接入方法。 |

## 当前原页面的排版

- **背景**：窗外与窗内天空同为 `#0F1110`。窗户上方两角略带圆弧，填充和流星裁切与轮廓一致。窗框、窗台横线与瓶身描边同为 `#d0dce9`；瓶口描边偏白。
- **左上角**：`Visual Design`、`AI Video`、`Vibe Coding` 纵向排列。距顶部 `22px`，左边距为 `clamp(22px, 3.2vw, 42px)`；Arial 字体，字号 `clamp(14px, .95vw, 18px)`，字重 `700`，行间距 `4px`。
- **右上角**：`xiaohong`。顶部和右边距与左侧一致，字体、字号、字重也一致。
- **中央标题**：`PORTFOLIO` 居中，Arial 字重 `800`，字号 `clamp(44px, calc(5.7vw + 4px), 114px)`，字距 `-.04em`。标题贴近并轻微叠在窗户上沿。
- **动画区域**：SVG 坐标系为 `1276 × 468`，按 `xMidYMax meet` 等比缩放并靠底部对齐。区域宽 `105vw`，高度为视口高度减去 `clamp(150px, 21vh, 170px)`，底部再下移 `16px`。因此顶部为标题留白，底部的瓶子和兔子靠近视口下沿。

这些文字和字号只用于描述原页面。移植时让目标页自己实现标题和分类链接；`scene.html` 不会生成它们。

## 动态内容

1. 窗内有约 **110 颗普通流星**持续以不同亮度、速度和拖尾划过，另有 **1 颗暖色过境流星**周期出现。
2. 独立的入瓶流星会接近瓶口，变色后落入瓶内；最先碰到瓶底的两颗星星各会让瓶子短暂震动一次（约 `0.32` 秒）。瓶里继续累积黄色星星、碎片和沙粒，并有发光与沙堆变化。瓶内星星最多 `40` 颗。
3. 另一条黄色流星落到瓶子右侧的窗台上，变成有透视缩放和接触阴影的星星，落地瞬间让瓶子明显但短暂地轻晃一次（约 `0.36` 秒，水平位移峰值约 `5.5` 个 SVG 单位），停留约 `2.5` 秒后渐隐。首次约在播放第 `3` 秒飞入，此后独立计时，每次发射后随机等待 `12–15` 秒。它会等待正在下落或待发的成对入瓶流星结束；窗台流星下落时，入瓶流星也会等待，避免两类流星同时下落。
4. 兔子使用三张内嵌 SVG 按 `1→2→3→2→1→2→3→2→1` 序列持续循环，每帧约 `180` 毫秒。动画由 `requestAnimationFrame` 驱动；页面暂停、浏览器标签页隐藏或系统启用“减少动态效果”时，兔子显示为第一帧。
5. 窗框和窗台横线与兔子同步切换三帧细微的手绘线形，线条端点保持固定；暂停或启用“减少动态效果”时回到原始线形。

## 接到另一个网页

将 `scene.html` 放入目标网站的静态资源目录，例如 `public/portfolio-scene.html`。在目标页创建一个满屏首屏，把动画放在底层，文字和链接放在上层：

```html
<section class="portfolio-hero">
  <iframe class="portfolio-scene" src="/portfolio-scene.html"
          title="流星窗景动画" loading="eager" tabindex="-1"></iframe>
  <div class="portfolio-content">
    <a href="#visual-design">Visual Design</a>
    <a href="#ai-video">AI Video</a>
    <a href="#vibe-coding">Vibe Coding</a>
    <h1>PORTFOLIO</h1>
  </div>
</section>
<!-- 后面继续放其他页面内容 -->
```

```css
.portfolio-hero { position: relative; height: 100svh; overflow: hidden; background: #0F1110; }
.portfolio-scene { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
.portfolio-content { position: relative; z-index: 1; }
```

`pointer-events: none` 使动画层不会挡住导航点击或页面滚动。`src` 应使用部署后的站内路径，不要填写本机的 `D:\...` 路径。纯静态网站也可以把本包文件放在目标 HTML 旁边，将 `src` 改为相对路径 `./scene.html`；`host-example.html` 展示了这种写法。

### 离开首屏时暂停

`scene.html` 还接受父页面发来的两个消息：`portfolio-scene:pause` 和 `portfolio-scene:resume`。`host-example.html` 已用 `IntersectionObserver` 在首屏离开视野时暂停动画，滚回来时恢复。移植到长页面时建议保留这段逻辑，避免用户浏览其他作品时动画继续运行。

### 调整动画位置

如目标页的标题区域不同，可以在 `scene.html` 顶部修改 `--header-clearance`，以及 `main` 的 `width` 和 `bottom`。这些值只改变整体位置与缩放，不会影响 SVG 内流星、瓶子和兔子的坐标关系。

## 检查清单

1. 打开 `host-example.html`，确认动画出现在首屏，分类文字可以跳到对应占位板块。
2. 滚到下一屏，再滚回首屏，确认动画暂停后能继续运行。
3. 用手机宽度检查标题与窗户的叠合程度。需要时只修改目标页标题排版和 `scene.html` 的 `--header-clearance`。
