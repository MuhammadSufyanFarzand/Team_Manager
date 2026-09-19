export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  original_filename?: string;
}

export function getCloudinaryDownloadUrl(url: string, _fileName?: string): string {
  if (!url) return '';
  
  // Ensure https protocol
  let secureUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url;

  // Simply return clean secure URL without unsigned transformations
  // Injecting fl_attachment without a signed URL causes Cloudinary HTTP 401 Unauthorized errors
  return secureUrl;
}

export async function uploadToCloudinary(
  file: File | Blob,
  customFileName?: string,
  folder: string = 'chat_uploads'
): Promise<CloudinaryUploadResult> {
  const cloudName = 'mktf0vjw';
  const apiKey = '765128628834469';
  const apiSecret = 'skMS6gjBcxiyj2JokXKHrKoewjw';

  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Determine resource type: 'image', 'video' (also used for audio/voice), or 'auto'
  let resourceType = 'auto';
  const mimeType = file.type || '';
  if (mimeType.startsWith('image/')) {
    resourceType = 'image';
  } else if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
    resourceType = 'video';
  } else {
    resourceType = 'auto';
  }

  // Parameters to sign (sorted alphabetically)
  const paramsToSign: Record<string, string> = {
    folder,
    timestamp
  };

  const sortedKeys = Object.keys(paramsToSign).sort();
  const signatureString = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&') + apiSecret;

  // Calculate SHA-1 hex digest using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const nameToUse = customFileName || (file as File).name || `file_${Date.now()}`;

  const formData = new FormData();
  formData.append('file', file, nameToUse);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('folder', folder);
  formData.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    // If specific resource_type fails, retry with auto endpoint
    const autoEndpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const autoResponse = await fetch(autoEndpoint, {
      method: 'POST',
      body: formData
    });

    if (!autoResponse.ok) {
      const errorData = await autoResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to upload media file');
    }

    return await autoResponse.json();
  }

  return await response.json();
}
