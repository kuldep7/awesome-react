// import path from 'node:path';
// import url from 'node:url';
import { defineBuildConfig } from 'unbuild';
import { copy } from 'fs-extra';
// const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineBuildConfig({
  entries: ['src/index'],
  clean: true,
  rollup: {
    inlineDependencies: true,
    esbuild: {
      target: 'node18',
      minify: true
    }
  },
  alias: {
    // we can always use non-transpiled code since we support node 18+
    prompts: 'prompts/lib/index.js'
  },
  hooks: {
    'rollup:options'(ctx, options) {
      options.plugins = [
        options.plugins
        // // @ts-expect-error TODO: unbuild uses rollup v3 and Vite uses rollup v4
        // licensePlugin(
        //   path.resolve(__dirname, './LICENSE'),
        //   'create-app license',
        //   'create-app'
        // ),
      ];
    },
    'build:done'() {
      copy('./src/template-main', './dist/template-main', (err) => {
        if (err) {
          console.error('Error copying template-main folder:', err);
        } else {
          console.log('template-main folder copied successfully.');
        }
      });
    }
  }
});
