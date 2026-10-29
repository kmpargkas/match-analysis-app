import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createAppRouter } from '@/app/router';
import { requestPersistentStorage } from '@/platform/storagePersistence';
import { RepositoryProvider } from '@/storage';
import { AppDb } from '@/storage/dexie/db';
import { createDexieRepositories } from '@/storage/dexie/repositories';
import './index.css';

const repositories = createDexieRepositories(new AppDb());
// Ask early; the footer shows the result.
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepositoryProvider repositories={repositories}>
      <RouterProvider router={createAppRouter()} />
    </RepositoryProvider>
  </StrictMode>,
);
