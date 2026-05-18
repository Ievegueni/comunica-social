import { FastifyInstance } from 'fastify';
import {
  createFolderSchema,
  updateFolderSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
} from './schemas.js';
import * as mediaService from './service.js';
import { AppError } from '../../lib/errors.js';

export async function mediaRoutes(app: FastifyInstance) {
  // ============ FOLDERS ============

  app.post(
    '/media/folders',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const parsed = createFolderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'Validation failed', details: parsed.error.flatten() });
      }

      try {
        const folder = await mediaService.createFolder(request.tenantId, parsed.data);
        return reply.status(201).send(folder);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get(
    '/media/folders',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const folders = await mediaService.listFolders(request.tenantId);
      return reply.send(folders);
    },
  );

  app.patch(
    '/media/folders/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateFolderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed' });
      }

      try {
        const folder = await mediaService.updateFolder(request.tenantId, id, parsed.data);
        return reply.send(folder);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.delete(
    '/media/folders/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await mediaService.deleteFolder(request.tenantId, id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  // ============ ASSETS ============

  app.post(
    '/media/upload',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const buffer = await data.toBuffer();
      const folderId = (data.fields.folderId as { value?: string } | undefined)?.value;

      try {
        const asset = await mediaService.uploadAsset(
          request.tenantId,
          { buffer, filename: data.filename, mimetype: data.mimetype },
          folderId,
        );
        return reply.status(201).send(asset);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get(
    '/media/assets',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = listAssetsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query params' });
      }

      const result = await mediaService.listAssets(request.tenantId, parsed.data);
      return reply.send(result);
    },
  );

  app.get(
    '/media/assets/:id',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const asset = await mediaService.getAsset(request.tenantId, id);
        return reply.send(asset);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.patch(
    '/media/assets/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Validation failed' });
      }

      try {
        const asset = await mediaService.updateAsset(request.tenantId, id, parsed.data);
        return reply.send(asset);
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );

  app.delete(
    '/media/assets/:id',
    {
      preHandler: [app.authorize('OWNER', 'ADMIN', 'EDITOR')],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await mediaService.deleteAsset(request.tenantId, id);
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AppError)
          return reply.status(err.statusCode).send({ error: err.message });
        throw err;
      }
    },
  );
}
