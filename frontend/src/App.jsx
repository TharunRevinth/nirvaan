import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AccessibilityBar from './components/AccessibilityBar';
import GovIdentityStrip from './components/GovIdentityStrip';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import GovFooter from './components/GovFooter';
import Toast from './components/Toast';

import Landing from './pages/Landing';
import About from './pages/About';
import VendorRegistration from './pages/VendorRegistration';
import TenderBrowse from './pages/TenderBrowse';
import TenderDetail from './pages/TenderDetail';
import SealedBidSubmission from './pages/SealedBidSubmission';
import DisputeFiling from './pages/DisputeFiling';
import TenderCreation from './pages/TenderCreation';
import EvaluationAward from './pages/EvaluationAward';
import VendorReveal from './pages/VendorReveal';
import CVCResolution from './pages/CVCResolution';
import Withdraw from './pages/Withdraw';
import OfficerVendorApproval from './pages/OfficerVendorApproval';
import { API_URL } from './config';

export default function App() {
  const location = useLocation();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const flash = sessionStorage.getItem('flash_toast');
    if (flash) {
      sessionStorage.removeItem('flash_toast');
      try {
        setToast(JSON.parse(flash));
        setTimeout(() => setToast(null), 5000);
      } catch (e) {}
    }
  }, [location.pathname]);

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const [tenders, setTenders] = useState([]);

  // Fetch tenders from canonical backend API on mount
  useEffect(() => {
    async function syncWithServer() {
      try {
        const res = await fetch(`${API_URL}/api/tenders`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tenders)) {
            setTenders(data.tenders);
          }
        }
      } catch (err) {
        console.warn('Backend tender sync standby:', err.message);
      }
    }
    syncWithServer();
  }, []);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-[#FAFAF9] text-[#1A1A18] font-sans antialiased selection:bg-[#A13D2B]/10 selection:text-[#A13D2B]">
        {/* 1. GIGW Accessibility Header Bar */}
        <AccessibilityBar />

        {/* 2. Government of India Identity Strip */}
        <GovIdentityStrip />

        {/* 3. Main Header TopBar */}
        <TopBar />

        {/* 4. Canvas with Sidebar + Guarded Routes */}
        <div className="flex flex-1 max-w-7xl mx-auto w-full relative">
          <Sidebar />

          <main className="flex-1 p-6 overflow-y-auto">
            <Routes>
              {/* Public Entry Point Landing Page */}
              <Route path="/" element={<Landing triggerToast={triggerToast} />} />

              {/* Dedicated Platform Overview / About Page */}
              <Route path="/about" element={<About />} />

              {/* Vendor Routes (Protected for Vendor Sessions) */}
              <Route 
                path="/vendor/dashboard" 
                element={
                  <ProtectedRoute allowedRole="Vendor" triggerToast={triggerToast}>
                    <TenderBrowse tenders={tenders} selectedPSU="ALL" setSelectedPSU={() => {}} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vendor/kyc" 
                element={
                  <ProtectedRoute allowedRole="Vendor" triggerToast={triggerToast}>
                    <VendorRegistration triggerToast={triggerToast} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vendor/submit-bid" 
                element={
                  <ProtectedRoute allowedRole="Vendor" requiresRegistration={true} triggerToast={triggerToast}>
                    <SealedBidSubmission triggerToast={triggerToast} tenders={tenders} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vendor/reveal" 
                element={
                  <ProtectedRoute allowedRole="Vendor" requiresRegistration={true} triggerToast={triggerToast}>
                    <VendorReveal triggerToast={triggerToast} tenders={tenders} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vendor/dispute" 
                element={
                  <ProtectedRoute allowedRole="Vendor" requiresRegistration={true} triggerToast={triggerToast}>
                    <DisputeFiling triggerToast={triggerToast} tenders={tenders} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/vendor/withdraw" 
                element={
                  <ProtectedRoute allowedRole="Vendor" triggerToast={triggerToast}>
                    <Withdraw triggerToast={triggerToast} />
                  </ProtectedRoute>
                } 
              />

              {/* PSU Officer Routes (Protected for PSU Officer JWT Sessions) */}
              <Route 
                path="/psu/dashboard" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <TenderBrowse tenders={tenders} selectedPSU="ALL" setSelectedPSU={() => {}} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/psu/create-tender" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <TenderCreation triggerToast={triggerToast} setTenders={setTenders} tenders={tenders} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/officer/vendors" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <OfficerVendorApproval triggerToast={triggerToast} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/psu/vendors" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <OfficerVendorApproval triggerToast={triggerToast} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/psu/evaluation" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <EvaluationAward triggerToast={triggerToast} tenders={tenders} setTenders={setTenders} />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/cvc/disputes" 
                element={
                  <CVCResolution triggerToast={triggerToast} tenders={tenders} />
                } 
              />

              {/* Shared Tender Detail Page & Public Aliases */}
              <Route path="/tenders/:id" element={<TenderDetail tenders={tenders} />} />
              <Route path="/tenders" element={<TenderBrowse tenders={tenders} selectedPSU="ALL" setSelectedPSU={() => {}} />} />
              <Route path="/register" element={<VendorRegistration triggerToast={triggerToast} />} />
              <Route path="/login" element={<Navigate to="/" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>

        {/* 5. Government Footer */}
        <GovFooter />

        {/* 6. Toast Notification Banner */}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </AuthProvider>
  );
}
