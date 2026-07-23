"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  RefObject,
  useCallback,
  useRef,
  useState,
} from "react";

export type AttachedImage = {
  dataUrl: string;
  name: string;
  type: string;
  size: number;
};

const allowedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const maxImageBytes = 4 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nie udało się odczytać obrazu."));
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageError, setImageError] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickImage = useCallback(async (file: File | null | undefined) => {
    if (!file) {
      return;
    }

    if (!allowedImageTypes.has(file.type)) {
      setImageError("Obsługiwane formaty: PNG, JPG, JPEG, GIF, WEBP.");
      return;
    }

    if (file.size > maxImageBytes) {
      setImageError("Max 4MB. Zrób screenshot fragmentu.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachedImage({
        dataUrl,
        name: file.name || "screenshot",
        type: file.type,
        size: file.size,
      });
      setImageError("");
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Nie udalo sie odczytac obrazu.",
      );
    }
  }, []);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const imageItem = Array.from(event.clipboardData.items).find((item) =>
        item.type.startsWith("image/"),
      );

      if (!imageItem) {
        return;
      }

      event.preventDefault();
      void pickImage(imageItem.getAsFile());
    },
    [pickImage],
  );

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void pickImage(event.target.files?.[0]);
      event.target.value = "";
    },
    [pickImage],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (
      Array.from(event.dataTransfer.items).some((item) =>
        item.type.startsWith("image/"),
      )
    ) {
      event.preventDefault();
      setIsDraggingImage(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingImage(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith("image/"),
      );

      if (!file) {
        return;
      }

      event.preventDefault();
      setIsDraggingImage(false);
      void pickImage(file);
    },
    [pickImage],
  );

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function clearImage() {
    setAttachedImage(null);
    setImageError("");
  }

  return {
    attachedImage,
    clearImage,
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInput,
    handlePaste,
    imageError,
    isDraggingImage,
    openFilePicker,
    pickImage,
  };
}

export function ImageFileInput({
  fileInputRef,
  onChange,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
      aria-label="Wybierz obraz"
      hidden
      onChange={onChange}
      ref={fileInputRef}
      type="file"
    />
  );
}

export function AttachmentPreview({
  image,
  onRemove,
}: {
  image: AttachedImage;
  onRemove: () => void;
}) {
  return (
    <div className="attachment-preview">
      <img alt={image.name} src={image.dataUrl} />
      <div>
        <strong>📎 Screenshot - zadaj pytanie o ten obraz</strong>
        <span>{image.name}</span>
      </div>
      <button aria-label="Usuń obraz" onClick={onRemove} type="button">
        X
      </button>

      <style jsx>{`
        .attachment-preview {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          border: 1px solid #33394a;
          border-radius: 8px;
          background: #11151f;
          padding: 10px;
        }

        img {
          width: 96px;
          max-height: 120px;
          border-radius: 8px;
          object-fit: contain;
          background: #05070d;
        }

        div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        strong {
          color: #ffffff;
          line-height: 1.35;
        }

        span {
          color: #aeb7d3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        button {
          width: 34px;
          height: 34px;
          border: 1px solid #3c4358;
          border-radius: 8px;
          background: #0f1119;
          color: #ffffff;
          font-size: 1.3rem;
          line-height: 1;
        }

        @media (max-width: 520px) {
          .attachment-preview {
            grid-template-columns: 1fr auto;
          }

          img {
            grid-column: 1 / -1;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
