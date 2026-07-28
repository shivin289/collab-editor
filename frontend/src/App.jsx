import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DocumentPage from './pages/DocumentPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/doc/:id" element={<DocumentPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
