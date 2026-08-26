import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import * as editorFs from "../../lib/editorFs";
import { mimeForExtension } from "../../lib/editorTypes";

interface ImageViewerProps {
  path: string;
  name: string;
}

export function ImageViewer({ path, name }: ImageViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    editorFs
      .readFileBase64(path)
      .then((b64) => setSrc(`data:${mimeForExtension(name)};base64,${b64}`))
      .catch(() => setFailed(true));
  }, [path]);

  return (
    <div className="editor-image-viewer">
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : failed ? (
        <div className="editor-image-fallback">
          <ImageIcon size={32} />
          <div>{name}</div>
          <div className="editor-image-fallback-note">Preview not available for this format</div>
        </div>
      ) : (
        <div className="editor-image-fallback-note">Loading...</div>
      )}
    </div>
  );
}