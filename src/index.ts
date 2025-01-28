import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimist from 'minimist';
import prompts from 'prompts';

import { cyan, red, reset, yellow } from 'kolorist';
import { getPackageLatestVersion } from './helpers/packages.helper';
import {
  emptyDir,
  executeCliCommand,
  formatTargetDir,
  isEmpty,
  isValidPackageName,
  pkgFromUserAgent,
  toValidPackageName,
  writeToFile
} from './helpers/main.helper';

// Import the MAIN_CONFIG object which contains configuration for the project
import PACKAGE_CONFIG, {
  TAILWIND_CONFIG,
  MAIN_CONFIG,
  MUI_CONFIG,
  TS_CONFIG
} from './config';
import MAIN_FILE_CONTENT from './constants/mainTemplateContent';
import appContent from './constants/appComponent';

const mainConfigRegex = new RegExp(/~~(.*?)~~/g);

// Parse command-line arguments using minimist
const argv = minimist<{
  help?: boolean;
}>(process.argv.slice(2), {
  default: { help: false },
  alias: { h: 'help' },
  string: ['_']
});

// Get the current working directory
const cwd = process.cwd();

// prettier-ignore
const helpMessage = `\
Usage: create-app [OPTION]... [DIRECTORY]

Create a new Vite project in JavaScript or TypeScript.
With no arguments, start the CLI in interactive mode.
`

// Define the default target directory for the new project
const defaultTargetDir = 'react-project';

async function init() {
  const argTargetDir = formatTargetDir(argv._[0]) || '';
  const { help } = argv;
  if (help) {
    console.log(`${yellow(helpMessage)}`);
    return;
  }

  let targetDir = argTargetDir || defaultTargetDir;
  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir;

  let result: prompts.Answers<IResultAnswers>;

  prompts.override({
    overwrite: argv.overwrite
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
          }
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
                ` is not empty. Please choose how to proceed : `
            ),
          initial: 0,
          choices: [
            {
              title: yellow('Remove existing files and continue'),
              value: 'yes'
            },
            {
              title: yellow('Cancel operation'),
              value: 'no'
            },
            {
              title: yellow('Ignore files and continue'),
              value: 'ignore'
            }
          ]
        },
        {
          type: (_, { overwrite }: { overwrite?: string }) => {
            if (overwrite === 'no') {
              throw new Error(red('✖') + ' Operation cancelled');
            }
            return null;
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: cyan('Package name : '),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: 'select',
          name: 'typescript',
          message: cyan('Do you want to have TypeScript ? '),
          initial: 0,
          choices: [
            {
              title: yellow('Yes'),
              value: true
            },
            {
              title: yellow('No'),
              value: false
            }
          ]
        },
        {
          type: 'select',
          name: 'uiLibrary',
          message: cyan('Please select an ui library of your choice : '),
          initial: 0,
          choices: [
            {
              title: yellow('None'),
              value: 'none'
            },
            {
              title: yellow('MUI'),
              value: 'mui'
            }
          ]
        },
        {
          type: 'select',
          name: 'tailwindCSS',
          message: cyan('Do you want to have Tailwind CSS ? '),
          initial: 0,
          choices: [
            {
              title: yellow('Yes'),
              value: true
            },
            {
              title: yellow('No'),
              value: false
            }
          ]
        }
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled');
        }
      }
    );
  } catch (cancelled: any) {
    console.log(cancelled.message);
    return;
  }

  const { overwrite, packageName, tailwindCSS, typescript, uiLibrary } = result;

  // Get the absolute path of the target directory
  const root = path.join(cwd, targetDir);

  // Check if the target directory already exists and is not empty
  if (overwrite === 'yes') {
    emptyDir(root);
  } else if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  // Get information about the package manager being used
  const pkgInfo = pkgFromUserAgent(process.env.npm_MAIN_CONFIG_user_agent);
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm';
  const filesToExclude = ['.eslintrc', 'package.json'];
  let mainFileContent = MAIN_FILE_CONTENT;

  console.log(`${reset(`\nScaffolding project in ${root}...\n`)}`);

  // Define the template directory based on whether TypeScript is enabled
  const template = typescript ? 'template-main' : 'template-main';

  // Get the absolute path of the template directory
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    './..',
    template
  );

  const { eslint, ...packageJsonDependencies } = PACKAGE_CONFIG.common;

  // Read the contents of .eslintrc and package.json files in the template directory
  let eslintrc = await fs.promises.readFile(`${templateDir}/.eslintrc`, 'utf8');
  eslintrc = { ...JSON.parse(eslintrc), ...eslint };
  let packageJson = await fs.promises.readFile(
    `${templateDir}/package_json`,
    'utf8'
  );
  packageJson = {
    ...JSON.parse(packageJson),
    ...packageJsonDependencies,
    name: packageName || targetDir
  };

  const srcDir = `${root}/src`;

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  fs.writeFileSync(`${root}/src/index.css`, '');

  try {
    const file = `${root}/src/App.${typescript ? 'tsx' : 'jsx'}`;
    fs.writeFileSync(file, appContent);
    // file written successfully
  } catch (err) {
    console.error(err);
  }

  // If Tailwind CSS is enabled, mutate the configs for ESLint and package.json
  if (tailwindCSS) {
    mutateConfigs({ eslintrc, packageJson }, 'tailwind');
    writeToFile(
      `tailwind.config.js`,
      { root, templateDir },
      TAILWIND_CONFIG.files['tailwind.config.js']
    );

    writeToFile(
      `postcss.config.js`,
      { root, templateDir },
      TAILWIND_CONFIG.files['postcss.config.js']
    );

    writeToFile(
      `src/index.css`,
      { root, templateDir },
      TAILWIND_CONFIG.files['src/index.css']
    );
  }

  // If a UI library is selected, mutate the configs for ESLint and package.json
  if (uiLibrary !== 'none') {
    mutateConfigs({ eslintrc, packageJson }, 'mui');
    mainFileContent = mainFileContent.replace(mainConfigRegex, (match) => {
      const matchStr = match.replace(/~/g, '') as keyof typeof MAIN_CONFIG;
      if (MUI_CONFIG.muiMainConfigs.includes(matchStr)) {
        return MAIN_CONFIG[matchStr];
      }
      return match;
    });

    writeToFile(
      `src/theme.ts`,
      { root, templateDir },
      `import { createTheme } from '@mui/material';\nconst theme = createTheme({});\nexport default theme;`
    );
  }

  // If TypeScript is enabled, mutate the configs for ESLint and package.json
  if (typescript) {
    mutateConfigs({ eslintrc, packageJson }, 'typescript');
    const indexHtmlPath = templateDir + '/index.html';
    let indexHtmlContent = await fs.promises.readFile(indexHtmlPath, 'utf8');
    indexHtmlContent = indexHtmlContent.replace('src/main.jsx', 'src/main.tsx');

    mainFileContent = mainFileContent.replace('~~main-ts-non-null~~', '!');

    fs.writeFileSync(`${root}/tsconfig.json`, JSON.stringify(TS_CONFIG.main));
    fs.writeFileSync(
      `${root}/tsconfig.app.json`,
      JSON.stringify(TS_CONFIG.app)
    );
    fs.writeFileSync(
      `${root}/tsconfig.node.json`,
      JSON.stringify(TS_CONFIG.node)
    );
    fs.writeFileSync(
      `${root}/src/vite-env.d.ts`,
      `/// <reference types="vite/client" />`
    );

    fs.writeFileSync(`${root}/index.html`, indexHtmlContent);
    filesToExclude.push('index.html');
  }

  // Get the latest versions of dependencies from npm registry
  await populateDependenciesWithLatestVersion({ packageJson });
  // remove unused imports from the main file content
  mainFileContent = mainFileContent.replace(mainConfigRegex, '');
  try {
    const file = `${root}/src/main.${typescript ? 'tsx' : 'jsx'}`;
    fs.writeFileSync(file, mainFileContent);
    // file written successfully
  } catch (err) {
    console.error(err);
  }

  // Read the contents of all files in the template directory except .eslintrc and package.json
  const files = fs.readdirSync(templateDir);
  for (const file of files.filter((f) => !filesToExclude.includes(f))) {
    writeToFile(file, { templateDir, root });
  }

  // Write the contents of .eslintrc and package.json files to the target directory
  writeToFile(
    '.eslintrc',
    { templateDir, root },
    JSON.stringify(eslintrc, null, 2)
  );
  writeToFile(
    `package.json`,
    { templateDir, root },
    JSON.stringify(packageJson, null, 2)
  );

  executeCliCommand(
    'npx',
    [
      '--yes',
      'prettier',
      '--log-level',
      'silent',
      '--config',
      `${root}/.prettierrc`,
      '--write',
      `${root}`
    ],
    { cwd: root }
  );
  executeCliCommand('git', ['init', '--quiet'], { cwd: root });
}

// This function takes the eslintrc and packageJson objects and mutates them according to the type of feature being added
async function mutateConfigs(
  { eslintrc, packageJson }: any,
  type: IMutateConfig
) {
  const { eslint, ...packageJsonDependencies } = PACKAGE_CONFIG[type];

  // add the dependencies and eslint configurations from the MAIN_CONFIG object to the respective objects
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

// this function takes the packageJson object from the mutateConfigs and adds the latest version of each dependency to it
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
