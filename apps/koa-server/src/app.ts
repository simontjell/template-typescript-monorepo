import cors from '@koa/cors';
import Koa from 'koa';
import { koaBody } from 'koa-body';
import compress from 'koa-compress';
import logger from 'koa-logger';
import mount from 'koa-mount';
import send from 'koa-send';
import staticCache from 'koa-static-cache';
import path from 'path';

import { getRouter } from './getRouter.js';
import { config } from './utils/getConfig.js';

const useStaticCache = false;

export type AppProps = {
  logging: boolean;
  cors: boolean;
  compress: boolean;
};
export const getApp = (appProps: AppProps) => {
  const app = new Koa();

  if (appProps.logging) app.use(logger());

  if (appProps.cors) app.use(cors());

  if (appProps.compress)
    app.use(
      compress({
        filter() {
          return true;
        }
      })
    );

  const router = getRouter(appProps.logging);

  app.use(
    koaBody({
      multipart: true,
      formidable: {
        uploadDir: path.join(config.BASE_DIR, './tmp'),
        keepExtensions: true // Keep file extension on upload
      }
    })
  );
  app.use(router.routes());
  app.use(router.allowedMethods());

  const nodeEnv = config.NODE_ENV.toLowerCase();
  switch (nodeEnv) {
    case 'development':
    case 'test':
      {
        if (appProps.logging) console.log(`   Mode: Development`);
      }
      break;
    case 'production':
      {
        if (appProps.logging)
          console.log(
            `   Mode: Production -- ${
              useStaticCache ? 'Static Cache' : 'Serve'
            }}`
          );

        // mount immutable hashed files
        const reactAppDistAssets = path.join(
          config.BASE_DIR,
          '../react-app/dist/assets'
        );
        app.use(
          mount(
            '/assets',
            staticCache(reactAppDistAssets, {
              cacheControl: 'public, max-age=31536000, immutable'
            })
          )
        );

        // serve up other files (index.html) and public folder
        const reactAppDist = path.join(config.BASE_DIR, '../react-app/dist');
        app.use(staticCache(reactAppDist, { maxAge: 60 }));

        // This will catch all other routes that are not caught by previous middleware
        app.use(async (ctx) => {
          await send(ctx, `${reactAppDist}`, {
            root: '/',
            index: 'index.html'
          });
        });
      }
      break;
    default:
      throw new Error(`Invalid NODE_ENV: ${config.NODE_ENV}`);
  }

  return app;
};

export const getTestApp = () => {
  return getApp({
    logging: false,
    cors: true,
    compress: false
  });
};