import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { DishesPage } from "./pages/DishesPage";
import { InventoryPage } from "./pages/InventoryPage";
import { OrdersPage } from "./pages/OrdersPage";
import { KitchenPage } from "./pages/KitchenPage";
import { UsersPage } from "./pages/UsersPage";
import { UserFormPage } from "./pages/UserFormPage";

export default function App() {
  return (
    <ThemeProvider>
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
                <Route path="/users" element={<UsersPage />} />
                <Route path="/users/nuevo" element={<UserFormPage />} />
                <Route path="/users/:id" element={<UserFormPage />} />
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
    </ThemeProvider>
  );
}
