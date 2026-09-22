// src/App.tsx
import { Outlet } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Todo lo que esté fuera de Outlet (ej: una Navbar global) se mantendrá siempre */}
      <Outlet />
    </div>
  );
}