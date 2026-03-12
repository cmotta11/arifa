import { useRef, useCallback } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const { t } = useTranslation();
  const sigRef = useRef<SignatureCanvas | null>(null);

  const handleEnd = useCallback(() => {
    if (sigRef.current && !sigRef.current.isEmpty()) {
      onChange(sigRef.current.toDataURL("image/png"));
    }
  }, [onChange]);

  const handleClear = () => {
    sigRef.current?.clear();
    onChange("");
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {t("registrosContables.guest.signature")}
      </label>
      <div className="rounded-md border-2 border-gray-300 bg-white">
        {value ? (
          <div className="flex items-center justify-center p-2">
            <img src={value} alt="Signature" className="max-h-32" />
          </div>
        ) : (
          <SignatureCanvas
            ref={sigRef}
            penColor="#0a1628"
            canvasProps={{
              className: "w-full",
              style: { height: 150, width: "100%", touchAction: "none" },
            }}
            onEnd={handleEnd}
          />
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleClear} type="button">
          {t("registrosContables.guest.clearSignature")}
        </Button>
      </div>
    </div>
  );
}
