const DEFAULT_GATEWAY_HOST = 'gateway.pinata.cloud';
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 12 * 1024 * 1024;
const SAFE_IMAGE_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const CID_PATTERN = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/;

export function normalizeGatewayHost(value = DEFAULT_GATEWAY_HOST) {
  const candidate = String(value || DEFAULT_GATEWAY_HOST).trim();
  const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new TypeError('The public IPFS gateway must be an HTTPS host without credentials, path, query, or fragment');
  }
  return url.host;
}

export function parseIpfsIdentity(imageUri, imageCid = null) {
  let cid = imageCid;
  let path = '';
  if (typeof imageUri === 'string' && imageUri.startsWith('ipfs://')) {
    const value = imageUri.slice('ipfs://'.length).replace(/^ipfs\//, '').split(/[?#]/, 1)[0];
    const [uriCid, ...segments] = value.split('/').filter(Boolean);
    cid = uriCid || cid;
    path = segments.map(segment => encodeURIComponent(decodeURIComponent(segment))).join('/');
  }
  if (typeof cid !== 'string' || !CID_PATTERN.test(cid)) throw new TypeError('A valid IPFS CID is required');
  return { cid, path, imageUri: imageUri ?? `ipfs://${cid}${path ? `/${path}` : ''}` };
}

export function resolveIpfsImageUrl(asset, { gatewayHost = DEFAULT_GATEWAY_HOST } = {}) {
  const host = normalizeGatewayHost(gatewayHost);
  const identity = parseIpfsIdentity(asset?.imageUri, asset?.imageCid);
  return { ...identity, url: `https://${host}/ipfs/${identity.cid}${identity.path ? `/${identity.path}` : ''}` };
}

export async function fetchValidatedImage(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be a positive integer');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('Image request timed out', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, mode: 'cors', credentials: 'omit', redirect: 'follow' });
    if (!response.ok) throw new TypeError(`Image request failed with HTTP ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (!SAFE_IMAGE_TYPES.has(contentType)) throw new TypeError(`Unsupported image MIME type: ${contentType || 'missing'}`);
    const declaredBytes = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) throw new TypeError('Image exceeds the configured byte limit');
    const blob = await response.blob();
    if (blob.size > maxBytes) throw new TypeError('Image exceeds the configured byte limit');
    return { blob, contentType, bytes: blob.size };
  } finally {
    clearTimeout(timeout);
  }
}

export function readMediaConfig(root = document) {
  return {
    gatewayHost: normalizeGatewayHost(root.querySelector('meta[name="titans-ipfs-gateway"]')?.content),
  };
}

export function createTitanImage(asset, {
  gatewayHost = DEFAULT_GATEWAY_HOST,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  fetchImpl = globalThis.fetch,
  intersectionObserver = globalThis.IntersectionObserver,
  createObjectURL = blob => URL.createObjectURL(blob),
  revokeObjectURL = url => URL.revokeObjectURL(url),
} = {}) {
  const figure = document.createElement('figure');
  figure.className = 'titan-media is-loading';
  figure.setAttribute('aria-busy', 'true');
  const fallback = document.createElement('div');
  fallback.className = 'titan-media-fallback';
  fallback.setAttribute('role', 'img');
  fallback.setAttribute('aria-label', 'Titan image loading');
  const fallbackMark = document.createElement('span');
  fallbackMark.setAttribute('aria-hidden', 'true');
  fallbackMark.textContent = 'T';
  const fallbackLabel = document.createElement('small');
  fallbackLabel.textContent = 'LOADING TITAN';
  fallback.append(fallbackMark, fallbackLabel);
  figure.append(fallback);

  let identity;
  try {
    identity = resolveIpfsImageUrl(asset, { gatewayHost });
    figure.dataset.ipfsUri = identity.imageUri;
    figure.dataset.ipfsCid = identity.cid;
  } catch {
    figure.className = 'titan-media is-unavailable';
    figure.setAttribute('aria-busy', 'false');
    fallback.setAttribute('aria-label', 'Titan image unavailable');
    fallbackLabel.textContent = 'IMAGE UNAVAILABLE';
    return figure;
  }

  const caption = document.createElement('figcaption');
  caption.className = 'sr-only';
  caption.textContent = `Original image ${identity.imageUri}; IPFS CID ${identity.cid}`;
  figure.append(caption);

  let started = false;
  const load = async () => {
    if (started) return;
    started = true;
    try {
      const { blob } = await fetchValidatedImage(identity.url, { fetchImpl, timeoutMs, maxBytes });
      const objectUrl = createObjectURL(blob);
      const image = document.createElement('img');
      image.alt = asset?.displayName || asset?.name ? `${asset.displayName ?? asset.name}, House of Titans NFT` : 'House of Titans NFT';
      image.width = 800;
      image.height = 800;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('load', () => {
        revokeObjectURL(objectUrl);
        figure.className = 'titan-media is-ready';
        figure.setAttribute('aria-busy', 'false');
      }, { once: true });
      image.addEventListener('error', () => {
        revokeObjectURL(objectUrl);
        image.remove();
        figure.className = 'titan-media is-unavailable';
        fallback.setAttribute('aria-label', 'Titan image unavailable');
        fallbackLabel.textContent = 'IMAGE UNAVAILABLE';
      }, { once: true });
      image.src = objectUrl;
      figure.prepend(image);
    } catch {
      figure.className = 'titan-media is-unavailable';
      figure.setAttribute('aria-busy', 'false');
      fallback.setAttribute('aria-label', 'Titan image unavailable');
      fallbackLabel.textContent = 'IMAGE UNAVAILABLE';
    }
  };

  if (typeof intersectionObserver === 'function') {
    const observer = new intersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      load();
    }, { rootMargin: '300px 0px' });
    observer.observe(figure);
  } else {
    queueMicrotask(load);
  }
  return figure;
}

export const MEDIA_DEFAULTS = Object.freeze({
  gatewayHost: DEFAULT_GATEWAY_HOST,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxBytes: DEFAULT_MAX_BYTES,
  safeImageTypes: Object.freeze([...SAFE_IMAGE_TYPES]),
});
