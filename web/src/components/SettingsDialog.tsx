import { useCallback } from "react";
import { adminApi } from "../api/endpoints.ts";
import { useAsync } from "../hooks/useAsync.ts";
import { Dialog } from "./Dialog.tsx";
import { ModelSettings } from "./ModelSettings.tsx";
import { PeopleSettings } from "./PeopleSettings.tsx";

interface Props {
  currentUserId: number;
  onClose: () => void;
  onModelsChanged: () => void;
}

export function SettingsDialog({ currentUserId, onClose, onModelsChanged }: Props) {
  const state = useAsync(adminApi.state);

  const refreshModels = useCallback(async () => {
    await state.reload();
    onModelsChanged();
  }, [state, onModelsChanged]);

  return (
    <Dialog title="Settings" onClose={onClose}>
      {state.error && <p className="error">{state.error.message}</p>}
      {state.data && (
        <>
          <ModelSettings
            installed={state.data.installed}
            config={state.data.config}
            onChanged={refreshModels}
          />
          <PeopleSettings
            users={state.data.users}
            currentUserId={currentUserId}
            onChanged={state.reload}
          />
        </>
      )}
      <div className="dialog-footer">
        <span />
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  );
}
