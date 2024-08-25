type IResultAnswers =
  | 'projectName'
  | 'overwrite'
  | 'packageName'
  | 'tailwindCSS'
  | 'typescript';
interface IWriteDirs {
  templateDir: string;
  root: string;
}
