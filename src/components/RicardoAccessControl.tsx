import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface RicardoAccessControlProps {
  children: ReactNode;
  restrictedPaths: string[];
}

const RicardoAccessControl = ({ children, restrictedPaths }: RicardoAccessControlProps) => {
  const { user } = useAuth();
  const currentPath = window.location.pathname;

  // Verifica se é o usuário Ricardo e se está tentando acessar uma rota restrita
  const isRicardo = user?.email === "ricardorpc11@gmail.com";
  const isRestrictedPath = restrictedPaths.includes(currentPath);

  if (isRicardo && isRestrictedPath) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
};

export default RicardoAccessControl;