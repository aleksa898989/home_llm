import { useState } from "react";
import type { PublicUser } from "../../../shared/api.ts";
import { chatApi } from "../api/endpoints.ts";
import { AccountDialog } from "../components/AccountDialog.tsx";
import { Composer } from "../components/Composer.tsx";
import { MessageList } from "../components/MessageList.tsx";
import { ModelPicker } from "../components/ModelPicker.tsx";
import { SettingsDialog } from "../components/SettingsDialog.tsx";
import { Sidebar } from "../components/Sidebar.tsx";
import { useAsync } from "../hooks/useAsync.ts";
import { useChatSession } from "../hooks/useChatSession.ts";

interface Props {
  user: PublicUser;
  onSignOut: () => void;
}

export function ChatPage({ user, onSignOut }: Props) {
  const chats = useAsync(chatApi.list);
  const models = useAsync(chatApi.models);
  const session = useChatSession(chats.reload);
  const [pickedModel, setPickedModel] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialog, setDialog] = useState<"settings" | "account" | null>(null);

  const available = models.data?.models ?? [];
  const model =
    pickedModel && available.some((m) => m.name === pickedModel)
      ? pickedModel
      : (models.data?.default ?? "");

  const openChat = async (id: string) => {
    setSidebarOpen(false);
    const chat = await session.open(id);
    if (chat.model) setPickedModel(chat.model);
  };

  const deleteChat = async (id: string) => {
    await chatApi.remove(id);
    if (session.chat?.id === id) session.reset();
    await chats.reload();
  };

  return (
    <div className="layout">
      <Sidebar
        open={sidebarOpen}
        user={user}
        chats={chats.data ?? []}
        activeId={session.chat?.id}
        onNew={() => {
          session.reset();
          setSidebarOpen(false);
        }}
        onOpen={openChat}
        onDelete={deleteChat}
        onSettings={() => setDialog("settings")}
        onAccount={() => setDialog("account")}
      />

      <main className="main">
        <header className="topbar">
          <button
            className="btn btn-ghost menu-button"
            aria-label="Toggle chat list"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            ☰
          </button>
          <ModelPicker
            models={available}
            value={model}
            onChange={setPickedModel}
            error={models.error?.message}
          />
        </header>

        <MessageList
          messages={session.chat?.messages ?? []}
          streaming={session.streaming}
          emptyText={`What's on your mind, ${user.username}?`}
        />

        <Composer
          disabled={!model}
          streaming={session.streaming}
          onSend={(text) => session.send(text, model)}
          onStop={session.stop}
        />
      </main>

      {dialog === "settings" && user.isAdmin && (
        <SettingsDialog
          currentUserId={user.id}
          onClose={() => setDialog(null)}
          onModelsChanged={models.reload}
        />
      )}
      {dialog === "account" && (
        <AccountDialog onClose={() => setDialog(null)} onSignOut={onSignOut} />
      )}
    </div>
  );
}
