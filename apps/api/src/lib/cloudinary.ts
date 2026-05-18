import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

export interface UploadResult {
  publicId: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  resourceType: 'image' | 'video';
  duration?: number;
}

export async function uploadToCloudinary(
  file: Buffer,
  options: { folder: string; resourceType?: 'image' | 'video' },
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType || 'auto',
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload failed'));
          return;
        }

        resolve({
          publicId: result.public_id,
          url: result.secure_url,
          thumbnailUrl: cloudinary.url(result.public_id, {
            width: 300,
            height: 300,
            crop: 'fill',
            quality: 'auto',
            fetch_format: 'auto',
          }),
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          resourceType: result.resource_type as 'image' | 'video',
          duration: result.duration,
        });
      },
    );

    uploadStream.end(file);
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'video' = 'image',
) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
