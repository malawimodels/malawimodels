/**
 * Cloudinary Image Upload Service
 * Handles all image uploads to Cloudinary
 */

// Cloudinary configuration from environment variables
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET_PROFILE = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_PROFILE || 'malawi_models_profiles';
const UPLOAD_PRESET_GALLERY = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_GALLERY || 'malawi_models_gallery';
const UPLOAD_PRESET_PAYMENT = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET_PAYMENT || 'malawi_models_payments';

const MAX_ORIGINAL_IMAGE_MB = 25;

/**
 * Upload type for different image categories
 */
export type UploadType = 'profile' | 'gallery' | 'payment' | 'agency-logo';

/**
 * Cloudinary upload response
 */
export interface CloudinaryUploadResponse {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

/**
 * Compress and optimize image before upload
 * @param file - Image file to compress
 * @param maxSizeKB - Maximum size in KB (default: 700)
 * @returns Compressed Blob
 */
async function compressImage(file: File, maxSizeKB: number = 700): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if too large (max 2048px on longest side)
        const maxDimension = 2048;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Start with quality 0.9 and reduce until under target size
        let quality = 0.9;
        
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              const sizeKB = blob.size / 1024;
              
              if (sizeKB <= maxSizeKB || quality <= 0.1) {
                resolve(blob);
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        
        tryCompress();
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get the correct upload preset for the image type
 */
function getUploadPreset(type: UploadType): string {
  switch (type) {
    case 'profile':
    case 'agency-logo':
      return UPLOAD_PRESET_PROFILE;
    case 'gallery':
      return UPLOAD_PRESET_GALLERY;
    case 'payment':
      return UPLOAD_PRESET_PAYMENT;
    default:
      return UPLOAD_PRESET_PROFILE;
  }
}

function getFriendlyUploadType(type: UploadType): string {
  switch (type) {
    case 'agency-logo':
      return 'agency logo';
    case 'gallery':
      return 'gallery image';
    case 'payment':
      return 'payment proof';
    default:
      return 'profile image';
  }
}

async function getCloudinaryError(response: Response, preset: string): Promise<string> {
  const fallback = 'Failed to upload image';

  try {
    const error = await response.json();
    const message = error.error?.message || error.message || fallback;

    if (message.toLowerCase().includes('upload preset not found')) {
      return `Cloudinary upload preset "${preset}" was not found. Create it as an unsigned preset in Cloudinary or update .env.local.`;
    }

    if (message.toLowerCase().includes('unsigned')) {
      return `Cloudinary upload preset "${preset}" must allow unsigned uploads.`;
    }

    return message;
  } catch {
    return fallback;
  }
}

/**
 * Upload image to Cloudinary
 * @param file - Image file to upload
 * @param type - Type of upload (profile, gallery, payment)
 * @param optimizeFirst - Whether to compress image before upload (default: true)
 * @returns Cloudinary upload response with URL and public_id
 */
export async function uploadImage(
  file: File,
  type: UploadType = 'profile',
  optimizeFirst: boolean = true
): Promise<CloudinaryUploadResponse> {
  if (!CLOUD_NAME) {
    throw new Error('Cloudinary not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in .env.local');
  }

  const uploadPreset = getUploadPreset(type);
  if (!uploadPreset) {
    throw new Error(`Cloudinary upload preset is missing for ${getFriendlyUploadType(type)} uploads.`);
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file.');
  }

  if (file.size > MAX_ORIGINAL_IMAGE_MB * 1024 * 1024) {
    throw new Error(`Image is too large. Please choose an image under ${MAX_ORIGINAL_IMAGE_MB}MB.`);
  }
  
  try {
    // Optimize image if requested
    const imageToUpload = optimizeFirst ? await compressImage(file, 700) : file;
    
    // Create form data
    const formData = new FormData();
    formData.append('file', imageToUpload, file.name);
    formData.append('upload_preset', uploadPreset);
    
    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!response.ok) {
      throw new Error(await getCloudinaryError(response, uploadPreset));
    }
    
    const data = await response.json();
    
    return {
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
      bytes: data.bytes,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
  }
}

/**
 * Upload multiple images in parallel
 * @param files - Array of image files to upload
 * @param type - Type of upload
 * @returns Array of Cloudinary upload responses
 */
export async function uploadImages(
  files: File[],
  type: UploadType = 'gallery'
): Promise<CloudinaryUploadResponse[]> {
  const uploads = files.map((file) => uploadImage(file, type));
  return Promise.all(uploads);
}

/**
 * Delete image from Cloudinary
 * Note: This requires a backend endpoint with your API secret.
 * For now, this is a placeholder. You can implement deletion
 * via a backend API route that uses the Cloudinary Admin API.
 * 
 * @param publicId - Cloudinary public_id of the image
 */
export async function deleteImage(publicId: string): Promise<void> {
  // TODO: Implement via backend API route with Cloudinary Admin API
  // Cloudinary deletion requires API secret, which should never be exposed client-side
  console.warn('Image deletion not implemented. Public ID:', publicId);
  
  // For now, we'll just let unused images accumulate in Cloudinary
  // You can manually clean them up from the Cloudinary dashboard
  // Or implement a backend endpoint for secure deletion
}

/**
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary image URL
 * @returns Public ID or null if not a valid Cloudinary URL
 */
export function getPublicIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/v\d+\/(.+)\.[a-z]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get optimized transformation URL for an existing Cloudinary image
 * @param url - Original Cloudinary URL
 * @param width - Target width
 * @param height - Target height
 * @returns Transformed URL
 */
export function getOptimizedUrl(
  url: string,
  width?: number,
  height?: number
): string {
  if (!url.includes('cloudinary.com')) {
    return url;
  }
  
  const transformations = [];
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  transformations.push('c_fill', 'q_auto', 'f_auto');
  
  const transformStr = transformations.join(',');
  
  // Insert transformation into URL
  return url.replace('/upload/', `/upload/${transformStr}/`);
}

type ImageTransformOptions = {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit';
  gravity?: 'auto' | 'face' | 'center';
  quality?: 'auto' | number;
};

const CLOUDINARY_TRANSFORM_TOKEN = /^(a_|ar_|b_|bo_|c_|co_|d_|e_|f_|fl_|g_|h_|l_|o_|q_|r_|t_|u_|w_|x_|y_|z_)/;

const isCloudinaryTransformSegment = (segment: string): boolean => (
  segment.includes(',') || CLOUDINARY_TRANSFORM_TOKEN.test(segment)
);

const buildCloudinaryUrl = (url: string, options: ImageTransformOptions): string => {
  if (!url.includes('cloudinary.com') || !url.includes('/upload/')) return url;

  const [prefix, uploadPath] = url.split('/upload/');
  if (!uploadPath) return url;

  const pathParts = uploadPath.split('/');
  const remainder = isCloudinaryTransformSegment(pathParts[0] || '')
    ? pathParts.slice(1).join('/')
    : uploadPath;

  const transformations = [
    options.width ? `w_${options.width}` : '',
    options.height ? `h_${options.height}` : '',
    `c_${options.crop || 'fill'}`,
    options.gravity ? `g_${options.gravity}` : '',
    `q_${options.quality || 'auto'}`,
    'f_auto',
    'dpr_auto',
  ].filter(Boolean);

  return `${prefix}/upload/${transformations.join(',')}/${remainder}`;
};

const buildPicsumUrl = (url: string, width: number, height: number): string => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('picsum.photos')) return url;

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 3 && parts[0] === 'id') {
      parsed.pathname = `/id/${parts[1]}/${width}/${height}`;
      return parsed.toString();
    }

    if (parts.length >= 2) {
      parsed.pathname = `/${width}/${height}`;
      return parsed.toString();
    }
  } catch {
    return url;
  }

  return url;
};

export const getImageVariantUrl = (
  url: string,
  variant: 'avatar' | 'card' | 'gallery' | 'hero' | 'full' = 'card'
): string => {
  if (!url || variant === 'full') return url;

  const dimensions = {
    avatar: { width: 160, height: 160, gravity: 'face' as const },
    card: { width: 420, height: 560, gravity: 'auto' as const },
    gallery: { width: 520, height: 360, gravity: 'auto' as const },
    hero: { width: 960, height: 520, gravity: 'auto' as const },
  }[variant];

  if (url.includes('cloudinary.com')) {
    return buildCloudinaryUrl(url, dimensions);
  }

  return buildPicsumUrl(url, dimensions.width, dimensions.height);
};

export const getThumbnailUrl = (url: string): string => getImageVariantUrl(url, 'card');
export const getAvatarUrl = (url: string): string => getImageVariantUrl(url, 'avatar');
export const getGalleryImageUrl = (url: string): string => getImageVariantUrl(url, 'gallery');
export const getHeroImageUrl = (url: string): string => getImageVariantUrl(url, 'hero');
export const getOriginalImageUrl = (url: string): string => url;
