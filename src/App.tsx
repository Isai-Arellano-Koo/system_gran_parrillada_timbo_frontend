import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { DishesPage } from "./pages/DishesPage";
import { InventoryPage } from "./pages/InventoryPage";
import { OrdersPage } from "./pages/OrdersPage";
import { KitchenPage } from "./pages/KitchenPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route
                element={<ProtectedRoute roles={["admin"]} />}
              >
                <Route path="/ingredients" element={<IngredientsPage />} />
                <Route path="/dishes" element={<DishesPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
              </Route>
              <Route
                element={<ProtectedRoute roles={["admin", "mesero"]} />}
              >
                <Route path="/orders" element={<OrdersPage />} />
              </Route>
              <Route
                element={
                  <ProtectedRoute roles={["admin", "cocinero", "mesero"]} />
                }
              >
                <Route path="/kitchen" element={<KitchenPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
