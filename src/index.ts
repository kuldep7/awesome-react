import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimist from 'minimist';
import prompts from 'prompts';

import { cyan, red, reset, yellow } from 'kolorist';
import { getPackageLatestVersion } from './helpers/packages.helper';
import {
  emptyDir,
  formatTargetDir,
  isEmpty,
  isValidPackageName,
  pkgFromUserAgent,
  toValidPackageName,
  write,
} from './helpers/main.helper';
import MAIN_CONFIG from './config';

const argv = minimist<{
  help?: boolean;
}>(process.argv.slice(2), {
  default: { help: false },
  alias: { h: 'help' },
  string: ['_'],
});
const cwd = process.cwd();

// prettier-ignore
const helpMessage = `\
Usage: create-app [OPTION]... [DIRECTORY]

Create a new Vite project in JavaScript or TypeScript.
With no arguments, start the CLI in interactive mode.
`

const defaultTargetDir = 'react-project';

async function init() {
  const argTargetDir = formatTargetDir(argv._[0]) || '';
  const help = argv.help;
  if (help) {
    console.log(`${yellow(helpMessage)}`);
    return;
  }

  let targetDir = argTargetDir || defaultTargetDir;
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir;

  let result: prompts.Answers<IResultAnswers>;

  prompts.override({
    overwrite: argv.overwrite,
  });
  try {
    result = await prompts(
      [
        {
          type: 'text',
          name: 'projectName',
          message: cyan('Project name : '),
          initial: targetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || targetDir;
          },
        },
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'select',
          name: 'overwrite',
          message: () =>
            cyan(
              (targetDir === '.'
                ? 'Current directory'
                : `Target directory "${targetDir}"`) +
                ` is not empty. Please choose how to proceed : `,
            ),
          initial: 0,
          choices: [
            {
              title: yellow('Remove existing files and continue'),
              value: 'yes',
            },
            {
              title: yellow('Cancel operation'),
              value: 'no',
            },
            {
              title: yellow('Ignore files and continue'),
              value: 'ignore',
            },
          ],
        },
        {
          type: (_, { overwrite }: { overwrite?: string }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled');
            }
            return null;
          },
          name: 'overwriteChecker',
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: cyan('Package name : '),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name',
        },
        {
          type: 'select',
          name: 'typescript',
          message: cyan('Do you want to have TypeScript ? '),
          initial: 0,
          choices: [
            {
              title: yellow('Yes'),
              value: true,
            },
            {
              title: yellow('No'),
              value: false,
            },
          ],
        },
        {
          type: 'select',
          name: 'uiLibrary',
          message: cyan('Please select an ui library of your choice : '),
          initial: 0,
          choices: [
            {
              title: yellow('None'),
              value: 'none',
            },
            {
              title: yellow('MUI'),
              value: 'mui',
            },
          ],
        },
        {
          type: 'select',
          name: 'tailwindCSS',
          message: cyan('Do you want to have Tailwind CSS ? '),
          initial: 0,
          choices: [
            {
              title: yellow('Yes'),
              value: true,
            },
            {
              title: yellow('No'),
              value: false,
            },
          ],
        },
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled');
        },
      },
    );
  } catch (cancelled: any) {
    console.log(cancelled.message);
    return;
  }

  const { overwrite, packageName, tailwindCSS, typescript, uiLibrary } = result;

  const root = path.join(cwd, targetDir);

  if (overwrite === 'yes') {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  const pkgInfo = pkgFromUserAgent(process.env.npm_MAIN_CONFIG_user_agent);
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm';

  console.log(`${reset(`\nScaffolding project in ${root}...\n`)}`);
  const template = typescript ? 'template-main' : 'template-main';

  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../..',
    template,
  );

  const { eslint, ...packageJsonDependencies } = MAIN_CONFIG.common;
  let eslintrc = await fs.promises.readFile(`${templateDir}/.eslintrc`, 'utf8');
  eslintrc = { ...JSON.parse(eslintrc), ...eslint };
  let packageJson = await fs.promises.readFile(
    `${templateDir}/package.json`,
    'utf8',
  );
  packageJson = {
    ...JSON.parse(packageJson),
    ...packageJsonDependencies,
    name: packageName || targetDir,
  };

  if (tailwindCSS) {
    mutateConfigs({ eslintrc, packageJson }, 'tailwind');
  }
  if (uiLibrary) {
    mutateConfigs({ eslintrc, packageJson }, 'mui');
  }
  if (typescript) {
    mutateConfigs({ eslintrc, packageJson }, 'typescript');
  }

  await populateDependenciesWithLatestVersion({ packageJson });

  const files = fs.readdirSync(templateDir);
  for (const file of files.filter(
    (f) => !['.eslintrc', 'package.json'].includes(f),
  )) {
    write(file, { templateDir, root });
  }
  write('.eslintrc', { templateDir, root }, JSON.stringify(eslintrc, null, 2));
  write(
    `package.json`,
    { templateDir, root },
    JSON.stringify(packageJson, null, 2),
  );
}

async function mutateConfigs(
  { eslintrc, packageJson }: any,
  type: IMutateConfig,
) {
  const { eslint, ...packageJsonDependencies } = MAIN_CONFIG[type];

  Object.entries(packageJsonDependencies).map(([key, value]) => {
    packageJson[key] = [...new Set([...packageJson[key], ...value])];
  });
  Object.entries(eslint).map(([key, value]) => {
    if (Array.isArray(value)) {
      eslintrc[key] = [...new Set([...eslintrc[key], ...value])];
    } else if (typeof value === 'string') {
      eslintrc[key] = value;
    } else {
      eslintrc[key] = { ...eslintrc[key], ...value };
    }
  });
}

async function populateDependenciesWithLatestVersion({ packageJson }: any) {
  const deps = [...packageJson.dependencies];
  const devDeps = [...packageJson.devDependencies];
  packageJson.dependencies = {};
  packageJson.devDependencies = {};
  for (const dep of deps) {
    const version = await getPackageLatestVersion(dep);
    packageJson.dependencies[dep] = `^${version}`;
  }
  for (const dep of devDeps) {
    const version = await getPackageLatestVersion(dep);
    packageJson.devDependencies[dep] = `^${version}`;
  }
}

init().catch((e) => {
  console.error(e);
});
