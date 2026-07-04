export const APP_RELEASE_MANIFEST_URL = 'https://tawakkalna-3ffc6.web.app/latest.json';
export const APP_DOWNLOAD_PAGE_URL = 'https://tawakkalna-3ffc6.web.app/';
export const APP_DOWNLOAD_FALLBACK_URL = 'https://apk.intezo.online/intezo-app-latest.apk';
const DEFAULT_ANDROID_ABI = 'arm64-v8a';

const getAndroidDevice = () => {
  const userAgent = navigator.userAgent || '';
  return /Android/i.test(userAgent) || navigator.userAgentData?.platform === 'Android';
};

const detectAndroidAbi = async () => {
  const userAgent = navigator.userAgent || '';
  if (!getAndroidDevice()) return null;

  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const hints = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness']);
      const architecture = String(hints.architecture || '').toLowerCase();
      const bitness = String(hints.bitness || '');
      if (architecture.includes('arm') && bitness === '64') return 'arm64-v8a';
      if (architecture.includes('arm') && bitness === '32') return 'armeabi-v7a';
    }
  } catch {
    // Browser privacy settings can withhold high-entropy architecture hints.
  }

  if (/arm64|aarch64|armv8/i.test(userAgent)) return 'arm64-v8a';
  if (/armv7|armeabi/i.test(userAgent)) return 'armeabi-v7a';
  // Most current Android phones are ARM64. Browsers commonly hide CPU details,
  // so prefer the smaller ARM64 APK instead of automatically serving Universal.
  return DEFAULT_ANDROID_ABI;
};

export const resolveAppDownload = async () => {
  if (!getAndroidDevice()) {
    return { url: APP_DOWNLOAD_PAGE_URL, usedUniversalFallback: false };
  }

  const [manifestResponse, detectedAbi] = await Promise.all([
    fetch(APP_RELEASE_MANIFEST_URL, { cache: 'no-store' }),
    detectAndroidAbi()
  ]);

  if (!manifestResponse.ok) {
    throw new Error('The latest Android release is temporarily unavailable.');
  }

  const manifest = await manifestResponse.json();
  const selectedDownload = manifest.downloads?.[detectedAbi] || manifest.downloads?.universal;
  if (!selectedDownload?.url) {
    throw new Error('No compatible Android download is available.');
  }

  return {
    url: selectedDownload.url,
    abi: detectedAbi,
    versionName: manifest.versionName,
    usedUniversalFallback: selectedDownload === manifest.downloads?.universal
  };
};
