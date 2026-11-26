import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Activities from './pages/Activities';
import Alignment from './pages/Alignment';
import Dashboard from './pages/Dashboard';
import FollowUp from './pages/FollowUp';
import Import from './pages/Import';
import Indicators from './pages/Indicators';
import PlanBuilder from './pages/PlanBuilder';
import Plans from './pages/Plans';
import Register from './pages/Register';
import Settings from './pages/Settings';
import { useApp } from './AppContext';

export default function App() {
  const { ws } = useApp();
  return (
    <Layout>
      <Routes>
        {/* premier lancement : on commence par créer le plan de travail */}
        <Route path="/" element={ws.plans.length ? <Dashboard /> : <Navigate to="/plans" replace />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/plan" element={<PlanBuilder />} />
        <Route path="/globales" element={<Activities level="global" />} />
        <Route path="/pays" element={<Activities level="country" />} />
        <Route path="/alignement" element={<Alignment />} />
        <Route path="/suivi" element={<FollowUp />} />
        <Route path="/indicateurs" element={<Indicators />} />
        <Route path="/registre" element={<Register />} />
        <Route path="/import" element={<Import />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
