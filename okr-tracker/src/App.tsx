import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CountryView from './pages/CountryView';
import TeamView from './pages/TeamView';
import GlobalKRView from './pages/GlobalKRView';
import CheckIn from './pages/CheckIn';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Annexes from './pages/Annexes';
import Cascade from './pages/Cascade';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/plan" element={<Cascade />} />
        <Route path="/pays/:id" element={<CountryView />} />
        <Route path="/equipe/:id" element={<TeamView />} />
        <Route path="/kr/:id" element={<GlobalKRView />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/registre" element={<Register />} />
        <Route path="/annexes" element={<Annexes />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
