import { metaApiFetch } from './client.js';
import { logger } from '../logger.js';

interface PublishResult {
  externalPostId: string;
}

interface PublishPayload {
  content: string;
  mediaUrls: string[];
  accessToken: string;
  externalId: string; // page_id for FB, ig_user_id for IG
  pageId?: string; // FB page id (needed for IG)
}

/**
 * Publish a post to Facebook.
 * Supports: text-only, single photo, single video.
 */
export async function publishToFacebook(payload: PublishPayload): Promise<PublishResult> {
  const { content, mediaUrls, accessToken, externalId } = payload;

  logger.info({ externalId, mediaCount: mediaUrls.length }, 'Publishing to Facebook');

  // Text-only post
  if (mediaUrls.length === 0) {
    const data = await metaApiFetch(`/${externalId}/feed`, accessToken, {
      method: 'POST',
      body: { message: content },
    });
    return { externalPostId: data.id };
  }

  // Single photo
  if (mediaUrls.length === 1) {
    const data = await metaApiFetch(`/${externalId}/photos`, accessToken, {
      method: 'POST',
      body: { url: mediaUrls[0], message: content },
    });
    return { externalPostId: data.id || data.post_id };
  }

  // Multiple photos — unpublished uploads then multi-photo post
  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    const data = await metaApiFetch(`/${externalId}/photos`, accessToken, {
      method: 'POST',
      body: { url, published: false },
    });
    photoIds.push(data.id);
  }

  const attachedMedia: Record<string, string> = {};
  photoIds.forEach((id, i) => {
    attachedMedia[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });

  const data = await metaApiFetch(`/${externalId}/feed`, accessToken, {
    method: 'POST',
    body: { message: content, ...attachedMedia },
  });

  return { externalPostId: data.id };
}

/**
 * Publish a post to Instagram (2-step: create container → publish).
 * Supports: single image, single video (reels), carousel.
 */
export async function publishToInstagram(payload: PublishPayload): Promise<PublishResult> {
  const { content, mediaUrls, accessToken, externalId } = payload;

  logger.info({ externalId, mediaCount: mediaUrls.length }, 'Publishing to Instagram');

  if (mediaUrls.length === 0) {
    throw new Error('Instagram requires at least one media item');
  }

  // Single media
  if (mediaUrls.length === 1) {
    const mediaUrl = mediaUrls[0];
    const isVideo = /\.(mp4|mov|avi|wmv)$/i.test(mediaUrl);

    // Step 1: Create media container
    const containerBody: Record<string, unknown> = {
      caption: content,
    };

    if (isVideo) {
      containerBody.media_type = 'REELS';
      containerBody.video_url = mediaUrl;
    } else {
      containerBody.image_url = mediaUrl;
    }

    const container = await metaApiFetch(`/${externalId}/media`, accessToken, {
      method: 'POST',
      body: containerBody,
    });

    // Step 2: Wait for container to be ready (for videos) then publish
    if (isVideo) {
      await waitForContainerReady(externalId, container.id, accessToken);
    }

    const published = await metaApiFetch(`/${externalId}/media_publish`, accessToken, {
      method: 'POST',
      body: { creation_id: container.id },
    });

    return { externalPostId: published.id };
  }

  // Carousel (multiple media)
  const childIds: string[] = [];

  for (const url of mediaUrls) {
    const isVideo = /\.(mp4|mov|avi|wmv)$/i.test(url);
    const childBody: Record<string, unknown> = {
      is_carousel_item: true,
    };

    if (isVideo) {
      childBody.media_type = 'VIDEO';
      childBody.video_url = url;
    } else {
      childBody.image_url = url;
    }

    const child = await metaApiFetch(`/${externalId}/media`, accessToken, {
      method: 'POST',
      body: childBody,
    });

    if (isVideo) {
      await waitForContainerReady(externalId, child.id, accessToken);
    }

    childIds.push(child.id);
  }

  // Create carousel container
  const carousel = await metaApiFetch(`/${externalId}/media`, accessToken, {
    method: 'POST',
    body: {
      media_type: 'CAROUSEL',
      caption: content,
      children: childIds.join(','),
    },
  });

  // Publish carousel
  const published = await metaApiFetch(`/${externalId}/media_publish`, accessToken, {
    method: 'POST',
    body: { creation_id: carousel.id },
  });

  return { externalPostId: published.id };
}

/**
 * Poll container status until it's ready (for video uploads).
 * Timeout after 5 minutes.
 */
async function waitForContainerReady(
  igUserId: string,
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await metaApiFetch(`/${containerId}`, accessToken, {
      params: { fields: 'status_code' },
    });

    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR') {
      throw new Error(`Instagram container ${containerId} failed processing`);
    }

    // Wait 10 seconds between checks
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  throw new Error(`Instagram container ${containerId} timed out`);
}
