import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import GovIdentityStrip from './components/GovIdentityStrip';
import AccessibilityBar from './components/AccessibilityBar';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import GovFooter from './components/GovFooter';
import Toast from './components/Toast';

import Login from './pages/Login';
import VendorRegistration from './pages/VendorRegistration';
import TenderBrowse from './pages/TenderBrowse';
import TenderDetail from './pages/TenderDetail';
import SealedBidSubmission from './pages/SealedBidSubmission';
import DisputeFiling from './pages/DisputeFiling';
import TenderCreation from './pages/TenderCreation';
import EvaluationAward from './pages/EvaluationAward';

export default function App() {
  const [selectedPSU, setSelectedPSU] = useState('IOCL');
  const [portalRole, setPortalRole] = useState('PSU'); // 'PSU' | 'Vendor'
  const [walletAddress, setWalletAddress] = useState('0xfe3b2075775791234567890abcdef1234567bd73');
  const [toast, setToast] = useState(null);

  const triggerToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Shared Tenders Initial State
  const [tenders, setTenders] = useState([
    {
      id: 'TND-24-9982-A',
      psu: 'IOCL',
      category: 'Pipeline Infrastructure',
      title: 'Expansion of Offshore Pipeline Routing & Actuator Valves',
      desc: 'High-pressure offshore subsea pipeline valve procurement and commissioning for Refinery Sector 4B.',
      valueCr: '45.50',
      emd: '910,000 INR',
      deadline: '2026-11-15 18:00',
      status: 'OPEN',
      cid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco'
    },
    {
      id: 'TND-24-9983-B',
      psu: 'ONGC',
      category: 'Heavy Machinery',
      title: 'Procurement of 15 Industrial Deepwater Drilling Rigs',
      desc: 'Offshore deepwater exploratory drilling rig fleet expansion for Krishna Godavari basin operations.',
      valueCr: '120.00',
      emd: '2,400,000 INR',
      deadline: '12:45:10',
      status: 'CLOSING SOON',
      cid: 'QmYwAPJzv5CZsnA625s3Xf2sm5DyaRtPu85X61mWO6uco'
    },
    {
      id: 'TND-24-9984-C',
      psu: 'IOCL',
      category: 'Consulting',
      title: 'Refinery Environmental Safety Audit & Compliance Q4',
      desc: 'Third-party environmental audit and hazard identification for Mathura and Koyali refineries.',
      valueCr: '2.75',
      emd: '55,000 INR',
      deadline: '2026-11-20 12:00',
      status: 'OPEN',
      cid: 'QmZtrL359vC2V7xW981smL2vedxjQkDDP1mXWo6uco'
    },
    {
      id: 'TND-24-9985-D',
      psu: 'BPCL',
      category: 'IT Infrastructure',
      title: 'High-Availability Data Center Server Cluster Upgrade',
      desc: 'Enterprise cloud infrastructure and private ledger node server hardware expansion.',
      valueCr: '18.20',
      emd: '364,000 INR',
      deadline: '38:15:00',
      status: 'CLOSING SOON',
      cid: 'QmB21xM99vC2V7xW981smL2vedxjQkDDP1mXWo6uco'
    }
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-offwhite text-graphite font-sans antialiased">
      {/* 1. National Identity Strip */}
      <GovIdentityStrip />

      {/* 2. Accessibility Bar */}
      <AccessibilityBar />

      {/* 3. Main Header TopBar */}
      <TopBar 
        selectedPSU={selectedPSU}
        setSelectedPSU={setSelectedPSU}
        portalRole={portalRole}
        setPortalRole={setPortalRole}
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
      />

      {/* 4. Layout Canvas with Sidebar + Page Content */}
      <div className="flex flex-1 max-w-container-max mx-auto w-full relative">
        <Sidebar portalRole={portalRole} selectedPSU={selectedPSU} />

        <main className="flex-1 p-6 overflow-y-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                <Login 
                  setPortalRole={setPortalRole} 
                  walletAddress={walletAddress} 
                  setWalletAddress={setWalletAddress} 
                />
              } 
            />
            <Route 
              path="/tenders" 
              element={
                <TenderBrowse 
                  tenders={tenders} 
                  selectedPSU={selectedPSU} 
                  setSelectedPSU={setSelectedPSU} 
                />
              } 
            />
            <Route 
              path="/tenders/:id" 
              element={<TenderDetail tenders={tenders} />} 
            />
            <Route 
              path="/register" 
              element={
                <VendorRegistration 
                  walletAddress={walletAddress} 
                  triggerToast={triggerToast} 
                />
              } 
            />
            <Route 
              path="/submit-bid" 
              element={
                <SealedBidSubmission 
                  triggerToast={triggerToast} 
                  walletAddress={walletAddress} 
                />
              } 
            />
            <Route 
              path="/dispute" 
              element={<DisputeFiling triggerToast={triggerToast} />} 
            />
            <Route 
              path="/create-tender" 
              element={
                <TenderCreation 
                  selectedPSU={selectedPSU} 
                  triggerToast={triggerToast} 
                  setTenders={setTenders} 
                  tenders={tenders} 
                />
              } 
            />
            <Route 
              path="/evaluation" 
              element={
                <EvaluationAward 
                  triggerToast={triggerToast} 
                  selectedPSU={selectedPSU} 
                />
              } 
            />
          </Routes>
        </main>
      </div>

      {/* 5. Government Footer */}
      <GovFooter />

      {/* 6. Notification Toast Banner */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
