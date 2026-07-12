declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }

  interface QueryExecResult {
    columns: string[]
    values: (string | number | null)[][]
  }

  interface Database {
    exec(sql: string, params?: (string | number | null)[]): QueryExecResult[]
    run(sql: string, params?: (string | number | null)[]): void
    getRowsModified(): number
  }

  export default function initSqlJs(): Promise<SqlJsStatic>
  export type { Database, SqlJsStatic, QueryExecResult }
}
