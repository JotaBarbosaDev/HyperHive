import React from "react";
import { listCertificates } from "@/services/certificates";
import { Certificate } from "@/types/certificate";

export type CertificateOption = {
  value: string;
  label: string;
};

export function useCertificatesOptions(onError?: (error: unknown) => void) {
  const [certificates, setCertificates] = React.useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = React.useState(false);

  const refreshCertificates = React.useCallback(async () => {
    setLoadingCertificates(true);
    try {
      const data = await listCertificates();
      setCertificates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load certificates", error);
      onError?.(error);
    } finally {
      setLoadingCertificates(false);
    }
  }, [onError]);

  React.useEffect(() => {
    void refreshCertificates();
  }, [refreshCertificates]);

  const certificateOptions = React.useMemo<CertificateOption[]>(() => {
    return [
      { value: "0", label: "Sem certificado" },
      ...certificates.map((cert) => ({
        value: String(cert.id),
        label: cert.nice_name || cert.domain_names?.[0] || `Certificado #${cert.id}`,
      })),
    ];
  }, [certificates]);

  const resolveCertificateLabel = React.useCallback(
    (id?: number | null) => {
      if (!id) return "Sem certificado";
      const match = certificateOptions.find((option) => option.value === String(id));
      return match?.label ?? "Sem certificado";
    },
    [certificateOptions]
  );

  return {
    certificates,
    certificateOptions,
    loadingCertificates,
    refreshCertificates,
    resolveCertificateLabel,
  };
}
