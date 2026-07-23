"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, QrCode, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface WhatsAppStatus {
  connected: boolean;
  hasQr?: boolean;
  user?: string;
  error?: string;
}

interface QRResponse {
  connected: boolean;
  qr?: string;
  rawQr?: string;
  message?: string;
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingQr, setLoadingQr] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/whatsapp/test");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.connected) {
          setQr(null);
        }
      }
    } catch (err) {
      console.error("Error fetching status:", err);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchQR = useCallback(async () => {
    setLoadingQr(true);
    try {
      const res = await fetch("/api/whatsapp/qr");
      if (res.ok) {
        const data: QRResponse = await res.json();
        if (data.connected) {
          setQr(null);
          setStatus((prev) => ({ ...prev, connected: true }));
        } else if (data.qr) {
          setQr(data.qr);
        }
      }
    } catch (err) {
      console.error("Error fetching QR:", err);
    } finally {
      setLoadingQr(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh status every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // If not connected and no QR, try to fetch QR
  useEffect(() => {
    if (status && !status.connected && !qr && !loadingQr) {
      fetchQR();
    }
  }, [status, qr, loadingQr, fetchQR]);

  const handleSendTest = async () => {
    if (!testPhone || testPhone.length < 10) {
      setTestResult({ success: false, message: "Ingresa un teléfono válido (mínimo 10 dígitos)" });
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({ success: true, message: "Mensaje de prueba enviado correctamente" });
      } else {
        setTestResult({ success: false, message: data.error || "Error al enviar mensaje" });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: "Error de conexión al enviar mensaje de prueba",
      });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="text-slate-500 mt-1">
          Configuración de notificaciones automáticas vía WhatsApp (Baileys)
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estado de la conexión</span>
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loadingStatus}>
              {loadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Actualizar</span>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStatus && !status ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verificando...
            </div>
          ) : status?.connected ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Conectado</Badge>
                {status.user && (
                  <span className="ml-3 text-sm text-slate-600">{status.user}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-amber-600" />
              <div>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Desconectado</Badge>
                <span className="ml-3 text-sm text-slate-600">
                  Escanea el código QR para conectar
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Card */}
      {!status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Código QR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              {loadingQr ? (
                <div className="flex items-center gap-2 text-slate-500 py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Generando código QR...
                </div>
              ) : qr ? (
                <>
                  <img
                    src={qr}
                    alt="WhatsApp QR Code"
                    className="border-2 border-slate-200 rounded-lg"
                    style={{ width: 300, height: 300 }}
                  />
                  <p className="text-sm text-slate-600 text-center max-w-md">
                    Abre WhatsApp en tu teléfono &rarr; Configuración &rarr; Dispositivos vinculados
                    &rarr; Vincular un dispositivo y escanea este código QR.
                  </p>
                  <Button variant="outline" size="sm" onClick={fetchQR} disabled={loadingQr}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="ml-2">Generar nuevo QR</span>
                  </Button>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 mb-4">No hay código QR disponible</p>
                  <Button onClick={fetchQR} disabled={loadingQr}>
                    <QrCode className="h-4 w-4" />
                    <span className="ml-2">Generar QR</span>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Message Card */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Mensaje de prueba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Envía un mensaje de prueba para verificar que las notificaciones automáticas funcionan
              correctamente.
            </p>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="Ej. 5512345678"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSendTest} disabled={sendingTest || !testPhone}>
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="ml-2">Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span className="ml-2">Enviar</span>
                  </>
                )}
              </Button>
            </div>
            {testResult && (
              <div
                className={`mt-4 p-3 rounded-md flex items-center gap-2 ${
                  testResult.success
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <div>
            <strong className="text-slate-900">Notificaciones automáticas:</strong> Cuando un
            pedido se marca como <Badge>LISTO</Badge>, el sistema envía automáticamente un mensaje
            de WhatsApp al cliente (solo para pedidos de mostrador con teléfono registrado).
          </div>
          <div>
            <strong className="text-slate-900">Persistencia:</strong> La sesión se guarda en
            PostgreSQL, por lo que la conexión se mantiene incluso después de reinicios o
            redeploys del servidor.
          </div>
          <div>
            <strong className="text-slate-900">Sin costos de API:</strong> Este sistema usa Baileys
            (biblioteca de código abierto) en lugar de servicios de pago como GREEN API.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}