import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Landing from './pages/Landing';
import HostDashboard from './pages/HostDashboard';
import GuestView from './pages/GuestView';
import DirectJoin from './pages/DirectJoin';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/host/:code" element={<HostDashboard />} />
          <Route path="/guest/:code" element={<GuestView />} />
          <Route path="/join/:code" element={<DirectJoin />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
