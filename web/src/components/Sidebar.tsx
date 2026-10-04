import type { ChatSummary, PublicUser } from "../../../shared/api.ts";

interface Props {
  open: boolean;
  user: PublicUser;
  chats: ChatSummary[];
  activeId?: string;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  onAccount: () => void;
}

export function Sidebar({
  open,
  user,
  chats,
  activeId,
  onNew,
  onOpen,
  onDelete,
  onSettings,
  onAccount,
}: Props) {
  return (
    <aside className="sidebar" data-open={open}>
      <div className="sidebar-header">
        <button className="btn btn-primary" onClick={onNew}>
          + New chat
        </button>
      </div>

      <ul className="chat-list" aria-label="Chats">
        {chats.map((chat) => (
          <li key={chat.id} className="chat-item" aria-current={chat.id === activeId}>
            <button onClick={() => onOpen(chat.id)} title={chat.title}>
              {chat.title}
            </button>
            <button
              className="delete"
              aria-label={`Delete ${chat.title}`}
              onClick={() => onDelete(chat.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <footer className="sidebar-footer">
        <span className="muted">{user.username}</span>
        <div>
          {user.isAdmin && (
            <button className="btn btn-ghost" aria-label="Settings" onClick={onSettings}>
              ⚙
            </button>
          )}
          <button className="btn btn-ghost" aria-label="Account" onClick={onAccount}>
            👤
          </button>
        </div>
      </footer>
    </aside>
  );
}
