type IResultAnswers =
  | 'projectName'
  | 'overwrite'
  | 'packageName'
  | 'tailwindCSS'
  | 'uiLibrary'
  | 'typescript';
interface IWriteDirs {
  templateDir: string;
  root: string;
}

type IMutateConfig = 'tailwind' | 'typescript' | 'mui';