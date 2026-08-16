import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import GovIdentityStrip from './components/GovIdentityStrip';
import AccessibilityBar from './components/AccessibilityBar';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import GovFooter from './components/GovFooter';
import Toast from './components/Toast';

import Landing from './pages/Landing';
import VendorRegistration from './pages/VendorRegistration';
import TenderBrowse from './pages/TenderBrowse';
import TenderDetail from './pages/TenderDetail';
import SealedBidSubmission from './pages/SealedBidSubmission';
import DisputeFiling from './pages/DisputeFiling';
import TenderCreation from './pages/TenderCreation';
import EvaluationAward from './pages/EvaluationAward';

export default function App() {
  const [toast, setToast] = useState(null);

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Shared Tenders Initial Data
  const [tenders, setTenders] = useState([
    {
      id: 'TND-24-9982-A',
      psu: 'IOCL',
      category: 'Pipeline Infrastructure',
      title: 'Expansion of Offshore Pipeline Routing & Actuator Valves',
      desc: 'High-pressure offshore subsea pipeline valve procurement and commissioning for Refinery Sector 4B.',
      valueCr: '45.50',
      minEmdAmount: 500000,
      emd: '500,000 INR',
      deadline: '2026-11-15 18:00',
      isExpired: false,
      appealWindowClosed: false,
      status: 'OPEN',
      cid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
    },
    {
      id: 'TND-24-9983-B',
      psu: 'ONGC',
      category: 'Heavy Machinery',
      title: 'Procurement of 15 Industrial Deepwater Drilling Rigs',
      desc: 'Offshore deepwater exploratory drilling rig fleet expansion for KG basin operations.',
      valueCr: '120.00',
      minEmdAmount: 2400000,
      emd: '2,400,000 INR',
      deadline: '12:45:10',
      isExpired: false,
      appealWindowClosed: false,
      status: 'CLOSING SOON',
      cid: 'QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu85X61mWO6uco'
    },
    {
      id: 'TND-24-9984-C',
      psu: 'IOCL',
      category: 'Consulting',
      title: 'Refinery Environmental Safety Audit & Compliance Q4',
      desc: 'Third-party environmental audit for Mathura and Koyali refineries.',
      valueCr: '2.75',
      minEmdAmount: 55000,
      emd: '55,000 INR',
      deadline: '2026-01-10 12:00 (EXPIRED)',
      isExpired: true,
      appealWindowClosed: true,
      status: 'EXPIRED',
      cid: 'QmZtrL359vC2V7xW981smL2vedxjQkDDP1mXWo6uco'
    }
  ]);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-offwhite text-graphite font-sans antialiased">
        {/* 1. National Identity Strip */}
        <GovIdentityStrip />

        {/* 2. Accessibility Bar */}
        <AccessibilityBar />

        {/* 3. Main Header TopBar */}
        <TopBar />

        {/* 4. Canvas with Sidebar + Guarded Routes */}
        <div className="flex flex-1 max-w-container-max mx-auto w-full relative">
          <Sidebar />

          <main className="flex-1 p-6 overflow-y-auto">
            <Routes>
              {/* Public Entry Point Landing Page */}
              <Route path="/" element={<Landing triggerToast={triggerToast} />} />

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
                path="/vendor/dispute" 
                element={
                  <ProtectedRoute allowedRole="Vendor" requiresRegistration={true} triggerToast={triggerToast}>
                    <DisputeFiling triggerToast={triggerToast} tenders={tenders} />
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
                path="/psu/evaluation" 
                element={
                  <ProtectedRoute allowedRole="PSU" triggerToast={triggerToast}>
                    <EvaluationAward triggerToast={triggerToast} />
                  </ProtectedRoute>
                } 
              />

              {/* Shared Tender Detail Page */}
              <Route path="/tenders/:id" element={<TenderDetail tenders={tenders} />} />
              <Route path="/tenders" element={<Navigate to="/vendor/dashboard" replace />} />

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
