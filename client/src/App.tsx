import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import BusinessPage from "./pages/BusinessPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/business/:id" element={<BusinessPage />} />
    </Routes>
  );
}
