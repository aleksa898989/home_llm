import { useCallback, useEffect, useState } from "react";
import type { PublicUser } from "../../shared/api.ts";
import { setUnauthorizedHandler } from "./api/client.ts";
import { authApi } from "./api/endpoints.ts";
import { AuthPage } from "./pages/AuthPage.tsx";
import { ChatPage } from "./pages/ChatPage.tsx";

type Session =
  { state: "loading" } | { state: "signed-out" } | { state: "signed-in"; user: PublicUser };

export function App() {
  const [session, setSession] = useState<Session>({ state: "loading" });

  const refresh = useCallback(
    () =>
      authApi.me().then(
        (user) => setSession({ state: "signed-in", user }),
        () => setSession({ state: "signed-out" }),
      ),
    [],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => setSession({ state: "signed-out" }));
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setSession({ state: "signed-out" });
  }, []);

  switch (session.state) {
    case "loading":
      return null;
    case "signed-out":
      return <AuthPage onSignedIn={refresh} />;
    case "signed-in":
      return <ChatPage user={session.user} onSignOut={signOut} />;
  }
}
