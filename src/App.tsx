import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { useAppStore } from './store';
import Layout from './components/Layout';
import Canvas from './components/Canvas';
import CommandPalette from './components/CommandPalette';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import PromptModal from './components/PromptModal';

// import { DataTable } from './components/DataTable';
// type ColumnDef needs to be imported if we use DataTable later, but for now we comment it out
// import type { ColumnDef } from '@tanstack/react-table';

// import SalesTable from './components/SalesTable';
// import SampleTable from './components/SampleTable';
import TableView from './components/TableView';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';


function App() {
  const { initialize, db, isLoading, queryResult, queryColumns, viewMode, appTheme, showPrivacyPolicy, showTermsOfService } = useStore();
  const { activeFile, setActiveFile, files } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle global dark mode toggle
  useEffect(() => {
    const root = window.document.documentElement;
    if (appTheme === 'dark' || (appTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [appTheme]);

  // Sync URL -> State (on load and on popstate)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file');
    console.log('[App] Initial URL file param:', fileParam);

    if (fileParam && fileParam !== activeFile) {
      console.log('[App] Setting activeFile from URL:', fileParam);
      setActiveFile(fileParam);
    } else if (!fileParam && activeFile) {
      console.log('[App] Clearing activeFile from URL');
      setActiveFile(null);
    }

    const handlePopState = () => {
      const newParams = new URLSearchParams(window.location.search);
      const newFileParam = newParams.get('file');
      console.log('[App] PopState - new file param:', newFileParam);
      setActiveFile(newFileParam);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Run once on mount to check URL, popstate handles back/forward

  // Sync State -> URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentFile = params.get('file');
    console.log('[App] activeFile changed:', activeFile, 'Current URL param:', currentFile);

    if (activeFile && activeFile !== currentFile) {
      console.log('[App] Updating URL to:', activeFile);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('file', activeFile);
      window.history.pushState({}, '', newUrl);
    } else if (!activeFile && currentFile) {
      console.log('[App] Removing file from URL');
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('file');
      window.history.pushState({}, '', newUrl);
    }
  }, [activeFile]);

  // DB Initialization effect (kept for background logic)
  useEffect(() => {
    if (db) {
      // Logic ready for real files
    }
  }, [db]);

  const activeFileObj = files.find(f => f.name === activeFile || f.tableName === activeFile);
  console.log("[App] Active file resolution:", { activeFile, found: !!activeFileObj, tableName: activeFileObj?.tableName });

  // We no longer block render on isLoading here, so the canvas background shows immediately
  // If db operations are slow, individual components handle their own states

  if (viewMode === 'query' && queryResult && queryColumns && !isLoading) {
    return (
      <>
        <TableView tableName="SQL Results" rows={queryResult} columns={queryColumns} />
        <CommandPalette />
        <SettingsModal />
        <PromptModal />
        <Toast />
      </>
    );
  }

  if (activeFile && db && !isLoading) {
    return (
      <>
        <TableView tableName={activeFileObj ? activeFileObj.tableName : activeFile} />
        <CommandPalette />
        <SettingsModal />
        <Toast />
      </>
    );
  }

  if (queryResult && queryColumns && !isLoading) {
    return (
      <>
        <TableView tableName="SQL Results" rows={queryResult} columns={queryColumns} />
        <CommandPalette />
        <SettingsModal />
        <Toast />
      </>
    );
  }

  return (
    <Layout>
      {showPrivacyPolicy && <PrivacyPolicy />}
      {showTermsOfService && <TermsOfService />}
      <Canvas />
      <CommandPalette />
      <SettingsModal />
      <Toast />
    </Layout>
  );
}

export default App;
