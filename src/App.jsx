import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import StepIndicator from './components/layout/StepIndicator.jsx';
import Step1ResumeInput from './components/steps/Step1_ResumeInput.jsx';
import Step2JDInput from './components/steps/Step2_JDInput.jsx';
import Step3Analysis from './components/steps/Step3_Analysis.jsx';
import Step4Export from './components/steps/Step4_Export.jsx';
import SettingsPage from './components/settings/SettingsPage.jsx';
import ApiKeyModal from './components/ui/ApiKeyModal.jsx';
import ToastContainer from './components/ui/Toast.jsx';
import { useAppStore } from './store/appStore.js';
import { useEffect } from 'react';
import { initFromStorage } from './services/storage.js';

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(initFromStorage());
  }, [hydrate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <StepIndicator />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/step/1" replace />} />
          <Route path="/step/1" element={<Step1ResumeInput />} />
          <Route path="/step/2" element={<Step2JDInput />} />
          <Route path="/step/3" element={<Step3Analysis />} />
          <Route path="/step/4" element={<Step4Export />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/step/1" replace />} />
        </Routes>
      </main>
      <ApiKeyModal />
      <ToastContainer />
    </div>
  );
}
