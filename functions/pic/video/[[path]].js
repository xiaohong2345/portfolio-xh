// Cloudflare Pages currently returns 200 for static Range requests. Video
// elements need 206 responses so they can start and seek without downloading
// the entire MP4 first.
// Pages' ASSETS binding omits Content-Length in local development, so keep the
// byte sizes of these checked-in videos as a fallback when they are replaced.
const videoSizes = {
  "手机新.mp4": 14041051,
  "最新手机.mp4": 23552896,
  "鲜奇一路整颗满足.mp4": 23419186,
  "vivo.mp4": 4942460,
  "fanxiejiao.mp4": 23314061,
  "anmuxi.mp4": 8636852,
  "欧珑.mp4": 11926024,
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const filename = decodeURIComponent(new URL(request.url).pathname.split("/").pop());
  if (!filename.endsWith(".mp4")) return context.next();

  const range = request.headers.get("Range");
  if (!range) return context.next();

  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 200 || !asset.body) return asset;

  const total = Number(asset.headers.get("Content-Length")) || videoSizes[filename];
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!Number.isSafeInteger(total) || total <= 0 || !match || (!match[1] && !match[2])) {
    return asset;
  }

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    start = Math.max(0, total - suffixLength);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= total || end < start) {
    await asset.body.cancel();
    return new Response(null, {
      status: 416,
      headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${total}` },
    });
  }

  const headers = new Headers(asset.headers);
  headers.delete("Connection");
  headers.delete("Transfer-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(end - start + 1));

  if (start === 0 && end === total - 1) {
    return new Response(asset.body, { status: 206, headers });
  }

  const reader = asset.body.getReader();
  let position = 0;
  const body = new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunkStart = position;
        position += value.byteLength;
        if (position <= start) continue;

        const from = Math.max(0, start - chunkStart);
        const to = Math.min(value.byteLength, end + 1 - chunkStart);
        if (to > from) controller.enqueue(value.subarray(from, to));
        if (position > end) {
          controller.close();
          reader.cancel().catch(() => {});
        }
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, { status: 206, headers });
}
