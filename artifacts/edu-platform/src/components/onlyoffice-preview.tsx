import { useEffect, useId, useMemo, useState } from "react";

type OnlyOfficePreviewProps = {
  documentServerUrl: string;
  config: Record<string, unknown>;
  title: string;
};

type DocsApi = {
  DocEditor: new (placeholderId: string, config: Record<string, unknown>) => { destroyEditor?: () => void };
};

declare global {
  interface Window {
    DocsAPI?: DocsApi;
  }
}

const loadedScripts = new Map<string, Promise<void>>();

function loadOnlyOfficeScript(documentServerUrl: string): Promise<void> {
  const scriptUrl = `${documentServerUrl.replace(/\/+$/, "")}/web-apps/apps/api/documents/api.js`;
  const existing = loadedScripts.get(scriptUrl);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cannot load OnlyOffice document editor script"));
    document.body.appendChild(script);
  });

  loadedScripts.set(scriptUrl, promise);
  return promise;
}

export function OnlyOfficePreview({ documentServerUrl, config, title }: OnlyOfficePreviewProps) {
  const reactId = useId();
  const placeholderId = useMemo(() => `onlyoffice-${reactId.replace(/:/g, "")}`, [reactId]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let editor: { destroyEditor?: () => void } | null = null;

    async function mountEditor() {
      setError(null);
      try {
        await loadOnlyOfficeScript(documentServerUrl);
        if (cancelled) return;
        if (!window.DocsAPI) {
          throw new Error("OnlyOffice API is not available");
        }
        console.log(config)
        editor = new window.DocsAPI.DocEditor(placeholderId, config);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cannot open OnlyOffice preview");
        }
      }
    }

    void mountEditor();

    return () => {
      cancelled = true;
      editor?.destroyEditor?.();
    };
  }, [config, documentServerUrl, placeholderId]);

  if (error) {
    return (
      <div className="flex h-[75vh] items-center justify-center rounded border bg-[#fafafa] px-4 text-center text-sm text-[#b91c1c]">
        {error}
      </div>
    );
  }

  return (
    <div className="h-[75vh] w-full overflow-hidden rounded border">
      <div id={placeholderId} title={title} className="h-full w-full" />
    </div>
  );
}
