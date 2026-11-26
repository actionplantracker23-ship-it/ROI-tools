import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useApp } from './AppContext';
import Alignment from './pages/Alignment';
import Dashboard from './pages/Dashboard';
import Gantt from './pages/Gantt';
import Import from './pages/Import';
import Indicators from './pages/Indicators';
import Issues from './pages/Issues';
import Kanban from './pages/Kanban';
import People from './pages/People';
import Plans from './pages/Plans';
import Schedule from './pages/Schedule';
import Settings from './pages/Settings';
import TaskList from './pages/TaskList';

export default function App() {
  const { ws } = useApp();
  return (
    <Layout>
      <Routes>
        {/* premier lancement : on commence par créer le plan de travail */}
        <Route path="/" element={ws.plans.length ? <Dashboard /> : <Navigate to="/plans" replace />} />
        <Route path="/taches" element={<TaskList />} />
        <Route path="/gantt" element={<Gantt />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/echeancier" element={<Schedule />} />
        <Route path="/responsables" element={<People />} />
        <Route path="/risques" element={<Issues />} />
        <Route path="/alignement" element={<Alignment />} />
        <Route path="/indicateurs" element={<Indicators />} />
        <Route path="/import" element={<Import />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="/plan" element={<Navigate to="/taches" replace />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
