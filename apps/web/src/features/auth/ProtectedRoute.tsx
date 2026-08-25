import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingState } from "@electronic-erp/ui";
import { useAuth } from "./AuthContext";

export function ProtectedRoute() {
  const { loading, session, sessionExpiredMessage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <LoadingState label="Restoring session…" />
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          sessionExpired: Boolean(sessionExpiredMessage),
          sessionExpiredMessage: sessionExpiredMessage ?? undefined,
        }}
      />
    );
  }

  return <Outlet />;
}
