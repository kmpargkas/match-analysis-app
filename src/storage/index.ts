// Public entry point for features. Dexie stays behind this boundary.
export { useLiveQuery as useRepoQuery } from 'dexie-react-hooks';
export * from './repositories';
export { RepositoryProvider, useRepositories } from './RepositoryContext';
export { asCopy, countConflicts, parseBackup, type BackupError, type BackupFile, type BackupRecords } from './backup';
export { exportAllData, exportMatchData, lastBackupAt } from './backup/files';
export { loadReportData } from './reportData';
