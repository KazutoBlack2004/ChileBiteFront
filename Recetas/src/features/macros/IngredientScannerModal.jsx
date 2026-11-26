import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ScanLine,
  Image as ImageIcon,
  ArrowRight,
  VideoOff
} from "lucide-react";
import { translateFoodLabel, INGREDIENT_SYNONYMS } from "./foodTranslations";

// Singleton en memoria para evitar recargar MobileNet si el usuario cierra y vuelve a abrir el modal
let cachedMobileNetModel = null;
let modelLoadPromise = null;

async function loadMobileNetLazy() {
  if (cachedMobileNetModel) return cachedMobileNetModel;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const mobilenet = await import("@tensorflow-models/mobilenet");
    try {
      // Intentar cargar MobileNet v2 (mayor precisión en alimentos de ImageNet)
      const model = await mobilenet.load({ version: 2, alpha: 1.0 });
      cachedMobileNetModel = model;
      return model;
    } catch {
      // Fallback seguro a configuración por defecto (v1)
      const model = await mobilenet.load();
      cachedMobileNetModel = model;
      return model;
    }
  })();

  try {
    return await modelLoadPromise;
  } catch (err) {
    modelLoadPromise = null;
    throw err;
  }
}

const normalize = (s = "") =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function IngredientScannerModal({
  isOpen,
  onClose,
  onSelectIngredientName,
  allIngredients = []
}) {
  const [activeTab, setActiveTab] = useState("camera"); // 'camera' | 'upload'
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(Boolean(cachedMobileNetModel));
  const [modelError, setModelError] = useState(null);

  // Camera states
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [isRealtime, setIsRealtime] = useState(false);

  // Upload states
  const [uploadedImageSrc, setUploadedImageSrc] = useState(null);
  const [imageReady, setImageReady] = useState(false);

  // Detection states
  const [isDetecting, setIsDetecting] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [detectionError, setDetectionError] = useState(null);

  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const realtimeTimerRef = useRef(null);

  // Verifica cuántos ingredientes en nuestra BD coinciden con un término traducido
  const countDatabaseMatches = useCallback(
    (term) => {
      if (!term || !allIngredients.length) return 0;
      const q = normalize(term.trim());
      const synonyms = INGREDIENT_SYNONYMS[q] || [q];
      return allIngredients.filter((ing) => {
        const normName = normalize(ing.nombre);
        return synonyms.some((syn) => normName.includes(syn));
      }).length;
    },
    [allIngredients]
  );

  // Detiene de forma segura todos los tracks de la cámara
  const stopCameraStream = useCallback(() => {
    if (realtimeTimerRef.current) {
      clearInterval(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }
    setIsRealtime(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.error("Error deteniendo track de cámara:", e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  // Carga diferida del modelo MobileNet solo cuando se abre el modal por primera vez
  const ensureModelLoaded = useCallback(async () => {
    if (cachedMobileNetModel) {
      setModelReady(true);
      setModelError(null);
      return cachedMobileNetModel;
    }
    setModelLoading(true);
    setModelError(null);
    try {
      const model = await loadMobileNetLazy();
      setModelReady(true);
      return model;
    } catch (err) {
      console.error("Error cargando MobileNet:", err);
      setModelError(
        "No se pudo cargar el modelo de Inteligencia Artificial. Verifica tu conexión a internet e inténtalo nuevamente."
      );
      return null;
    } finally {
      setModelLoading(false);
    }
  }, []);

  // Inicia la cámara priorizando cámara trasera (environment) con fallback a cámara frontal/webcam
  const startCamera = useCallback(
    async (preferredFacing = facingMode) => {
      stopCameraStream();
      setCameraError(null);
      setPredictions([]);
      setDetectionError(null);

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError({
          type: "no-support",
          title: "Cámara no disponible en este navegador",
          message:
            "Tu navegador o dispositivo no soporta acceso directo a la cámara web. Puedes usar la pestaña 'Subir imagen' para analizar una foto."
        });
        return;
      }

      setCameraStarting(true);

      let stream = null;
      try {
        // 1. Intentar con cámara solicitada (por defecto trasera: 'environment')
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (firstErr) {
        // Si es denegación de permisos, no reintentar porque el usuario ya bloqueó el permiso
        if (
          firstErr.name === "NotAllowedError" ||
          firstErr.name === "PermissionDeniedError"
        ) {
          setCameraStarting(false);
          setCameraError({
            type: "permission-denied",
            title: "Permiso de cámara denegado",
            message:
              "Has bloqueado el acceso a la cámara. Habilita los permisos de cámara en la barra de direcciones del navegador o utiliza la opción 'Subir imagen'."
          });
          return;
        }

        // 2. Fallback a cualquier cámara disponible (frontal / webcam estándar)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (fallbackErr) {
          setCameraStarting(false);
          if (
            fallbackErr.name === "NotAllowedError" ||
            fallbackErr.name === "PermissionDeniedError"
          ) {
            setCameraError({
              type: "permission-denied",
              title: "Permiso de cámara denegado",
              message:
                "Has bloqueado el acceso a la cámara. Habilita los permisos en tu navegador o sube una imagen desde tu dispositivo."
            });
          } else if (
            fallbackErr.name === "NotFoundError" ||
            fallbackErr.name === "DevicesNotFoundError"
          ) {
            setCameraError({
              type: "no-device",
              title: "No se detectó ninguna cámara",
              message:
                "No encontramos una cámara conectada a tu dispositivo. Cambia a la pestaña 'Subir imagen' para elegir una foto."
            });
          } else if (
            fallbackErr.name === "NotReadableError" ||
            fallbackErr.name === "TrackStartError"
          ) {
            setCameraError({
              type: "in-use",
              title: "Cámara en uso por otra aplicación",
              message:
                "Cierra otras aplicaciones que estén usando la cámara e inténtalo de nuevo, o sube una imagen."
            });
          } else {
            setCameraError({
              type: "unknown",
              title: "No se pudo iniciar la cámara",
              message:
                fallbackErr.message ||
                "Ocurrió un error inesperado al acceder a la cámara. Usa la opción 'Subir imagen'."
            });
          }
          return;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Auto-play warning en video:", playErr);
        }
      }
      setCameraActive(true);
      setCameraStarting(false);
    },
    [facingMode, stopCameraStream]
  );

  // Efecto al abrir o cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      return;
    }

    let isMounted = true;
    setPredictions([]);
    setDetectionError(null);

    (async () => {
      await ensureModelLoaded();
      if (!isMounted) return;
      if (activeTab === "camera") {
        await startCamera(facingMode);
      }
    })();

    return () => {
      isMounted = false;
      stopCameraStream();
    };
  }, [isOpen]);

  // Efecto al cambiar entre pestañas "Usar cámara" y "Subir imagen"
  const handleTabChange = async (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPredictions([]);
    setDetectionError(null);

    if (tab === "camera") {
      await startCamera(facingMode);
    } else {
      stopCameraStream();
    }
  };

  // Alternar cámara frontal / trasera en móviles
  const handleToggleFacingMode = async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    if (activeTab === "camera") {
      await startCamera(nextFacing);
    }
  };

  // Ejecuta la clasificación con MobileNet sobre el elemento de video o imagen
  const handleDetectIngredient = useCallback(
    async (silent = false) => {
      const targetEl =
        activeTab === "camera" ? videoRef.current : imageRef.current;

      if (!targetEl) return;

      if (activeTab === "camera") {
        if (
          !cameraActive ||
          targetEl.readyState < 2 ||
          targetEl.videoWidth === 0
        ) {
          if (!silent) {
            setDetectionError(
              "La cámara aún se está preparando. Espera un segundo e intenta de nuevo."
            );
          }
          return;
        }
      } else {
        if (!uploadedImageSrc || !imageReady) {
          if (!silent) {
            setDetectionError("Primero selecciona una imagen para analizar.");
          }
          return;
        }
      }

      if (!silent) {
        setIsDetecting(true);
        setDetectionError(null);
      }

      try {
        const model = cachedMobileNetModel || (await ensureModelLoaded());
        if (!model) return;

        // Obtener top 5 de MobileNet y enriquecer con el diccionario español
        const rawResults = await model.classify(targetEl, 5);

        const enriched = rawResults.map((item) => {
          const { translated, matchedKey, originalLabel } = translateFoodLabel(
            item.className
          );
          const dbCount = translated ? countDatabaseMatches(translated) : 0;
          return {
            className: originalLabel,
            probability: item.probability,
            confidencePct: Math.min(100, Math.max(0.1, item.probability * 100)).toFixed(1),
            translated,
            matchedKey,
            dbCount,
            isFoodMatch: Boolean(translated)
          };
        });

        // Tomar las 3 predicciones principales (priorizando si hay alimentos reconocidos)
        const topThree = enriched.slice(0, 3);
        setPredictions(topThree);
      } catch (err) {
        console.error("Error durante la clasificación:", err);
        if (!silent) {
          setDetectionError(
            "No se pudo analizar la imagen. Intenta con otro ángulo o imagen."
          );
        }
      } finally {
        if (!silent) {
          setIsDetecting(false);
        }
      }
    },
    [
      activeTab,
      cameraActive,
      uploadedImageSrc,
      imageReady,
      ensureModelLoaded,
      countDatabaseMatches
    ]
  );

  // Detección en tiempo real opcional sobre el stream de video
  useEffect(() => {
    if (isOpen && activeTab === "camera" && cameraActive && isRealtime && modelReady) {
      realtimeTimerRef.current = setInterval(() => {
        handleDetectIngredient(true);
      }, 1100);
    } else if (realtimeTimerRef.current) {
      clearInterval(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    }

    return () => {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    };
  }, [isOpen, activeTab, cameraActive, isRealtime, modelReady, handleDetectIngredient]);

  // Manejo de subida de archivo de imagen
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setDetectionError("Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).");
      return;
    }

    setPredictions([]);
    setDetectionError(null);
    setImageReady(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImageSrc(ev.target?.result || null);
    };
    reader.readAsDataURL(file);
  };

  // Selección final de un ingrediente detectado → cierra modal, detiene cámara y autocompleta buscador
  const handleApplyPrediction = (pred) => {
    const chosenTerm =
      pred.translated ||
      pred.className.split(",")[0].trim();

    stopCameraStream();
    onSelectIngredientName(chosenTerm);
    onClose();
  };

  const handleCloseModal = () => {
    stopCameraStream();
    onClose();
  };

  // Cerrar con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (typeof document === "undefined") return null;

  const bestFoodMatch = predictions.find((p) => p.isFoodMatch);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="scanner-modal-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
          />

          {/* Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative z-10 w-full max-w-xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-[#A0522D] to-[#7a3d20] text-white flex items-center justify-center shadow-md shadow-[#A0522D]/25 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      id="scanner-modal-title"
                      className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight"
                    >
                      Reconocimiento de Ingredientes IA
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#A0522D]/15 text-[#A0522D] dark:text-[#d4906a]">
                      <Sparkles className="w-2.5 h-2.5" /> TensorFlow.js
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Detecta frutas, verduras y alimentos directo en tu navegador
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Cerrar escáner de ingredientes"
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              {/* Tabs: Usar cámara vs Subir imagen */}
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTabChange("camera")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === "camera"
                      ? "bg-white dark:bg-slate-800 text-[#A0522D] dark:text-[#d4906a] shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Usar cámara</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("upload")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    activeTab === "upload"
                      ? "bg-white dark:bg-slate-800 text-[#A0522D] dark:text-[#d4906a] shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir imagen</span>
                </button>
              </div>

              {/* Estado de Carga Diferida del Modelo MobileNet */}
              {modelLoading && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#A0522D]/10 dark:bg-[#A0522D]/15 border border-[#A0522D]/25 text-[#A0522D] dark:text-[#d4906a]">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-extrabold">
                        Cargando modelo de IA...
                      </p>
                      <p className="text-[11px] opacity-80">
                        Descargando red neuronal MobileNet en tu navegador (solo la primera vez)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error de Carga del Modelo */}
              {modelError && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold leading-relaxed">{modelError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={ensureModelLoaded}
                    className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Área Visual: Video de Cámara o Imagen Subida */}
              {activeTab === "camera" ? (
                <div className="relative w-full aspect-4/3 sm:aspect-16/10 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      cameraActive ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  {/* Guía visual de encuadre cuando la cámara está activa */}
                  {cameraActive && (
                    <>
                      <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-white/35 rounded-2xl flex items-end justify-center pb-3">
                        <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white/90">
                          Centra el ingrediente frente a la cámara
                        </span>
                      </div>

                      {/* Controles flotantes de cámara */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsRealtime((prev) => !prev)}
                          title="Alternar detección automática en tiempo real"
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold backdrop-blur-md border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isRealtime
                              ? "bg-emerald-500/90 text-white border-emerald-400 shadow-lg"
                              : "bg-black/60 text-white/90 border-white/15 hover:bg-black/75"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isRealtime ? "bg-white animate-ping" : "bg-white/60"
                            }`}
                          />
                          {isRealtime ? "Tiempo real: ON" : "Tiempo real: OFF"}
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleFacingMode}
                          title="Cambiar cámara (frontal / trasera)"
                          aria-label="Cambiar cámara"
                          className="p-2 rounded-xl bg-black/60 hover:bg-black/75 text-white border border-white/15 backdrop-blur-md transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Loader mientras abre la cámara */}
                  {cameraStarting && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-slate-950/90 p-6 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#d4906a]" />
                      <p className="text-sm font-bold">Iniciando cámara...</p>
                      <p className="text-xs text-slate-400">
                        Acepta el permiso del navegador si se solicita
                      </p>
                    </div>
                  )}

                  {/* Mensaje de error de cámara (Permisos denegados o dispositivo sin cámara) */}
                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-white gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
                        <VideoOff className="w-6 h-6" />
                      </div>
                      <div className="max-w-sm">
                        <h4 className="text-sm font-extrabold text-white mb-1">
                          {cameraError.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {cameraError.message}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                        <button
                          type="button"
                          onClick={() => startCamera(facingMode)}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reintentar cámara
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTabChange("upload")}
                          className="px-4 py-2 rounded-xl bg-[#A0522D] hover:bg-[#944925] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Subir una imagen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Pestaña Subir Imagen */
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!uploadedImageSrc ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-16/10 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#A0522D] dark:hover:border-[#d4906a] bg-slate-50/70 dark:bg-slate-900/40 flex flex-col items-center justify-center gap-3 p-6 transition-all cursor-pointer group"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-[#A0522D]/10 dark:bg-[#A0522D]/20 text-[#A0522D] dark:text-[#d4906a] flex items-center justify-center group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-7 h-7" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                          Haz clic para seleccionar una foto del ingrediente
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Formatos soportados: JPG, PNG, WEBP (procesado 100% en tu dispositivo)
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div className="relative w-full aspect-16/10 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                      <img
                        ref={imageRef}
                        src={uploadedImageSrc}
                        alt="Ingrediente subido para análisis"
                        crossOrigin="anonymous"
                        onLoad={() => {
                          setImageReady(true);
                          handleDetectIngredient(false);
                        }}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute top-3 right-3 px-3.5 py-2 rounded-xl bg-black/70 hover:bg-black/85 text-white text-xs font-bold backdrop-blur-md border border-white/15 flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Cambiar imagen
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Botón Principal: Detectar ingrediente */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDetectIngredient(false)}
                  disabled={
                    modelLoading ||
                    isDetecting ||
                    (activeTab === "camera" && !cameraActive) ||
                    (activeTab === "upload" && (!uploadedImageSrc || !imageReady))
                  }
                  className="w-full py-3.5 px-6 rounded-2xl bg-linear-to-r from-[#A0522D] to-[#7a3d20] hover:from-[#944925] hover:to-[#69331a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm shadow-lg shadow-[#A0522D]/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Analizando ingrediente con MobileNet...</span>
                    </>
                  ) : (
                    <>
                      <ScanLine className="w-5 h-5" />
                      <span>Detectar ingrediente</span>
                    </>
                  )}
                </button>
              </div>

              {detectionError && (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{detectionError}</span>
                </div>
              )}

              {/* Resultados: Top 3 Predicciones con Porcentaje de Confianza */}
              {predictions.length > 0 && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Top 3 Predicciones MobileNet
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Haz clic en una predicción para buscarla
                    </span>
                  </div>

                  {/* Acceso rápido si hay una coincidencia de alimento clara */}
                  {bestFoodMatch && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                            Ingrediente reconocido:{" "}
                            <strong className="font-black text-sm">
                              {bestFoodMatch.translated}
                            </strong>{" "}
                            ({bestFoodMatch.confidencePct}%)
                          </p>
                          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            {bestFoodMatch.dbCount > 0
                              ? `${bestFoodMatch.dbCount} coincidencia(s) en la base de datos de ChileBite`
                              : "Listo para filtrar en el buscador"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyPrediction(bestFoodMatch)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-colors shrink-0 cursor-pointer"
                      >
                        <span>Usar "{bestFoodMatch.translated}"</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {predictions.map((pred, idx) => {
                      const displayTitle = pred.translated || pred.className;
                      return (
                        <button
                          key={`${pred.className}-${idx}`}
                          type="button"
                          onClick={() => handleApplyPrediction(pred)}
                          className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-2 cursor-pointer group ${
                            pred.isFoodMatch
                              ? "bg-white dark:bg-slate-900 border-[#A0522D]/35 hover:border-[#A0522D] shadow-xs"
                              : "bg-slate-50/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                  pred.isFoodMatch
                                    ? "bg-[#A0522D] text-white"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                    {displayTitle}
                                  </span>
                                  {pred.isFoodMatch && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#A0522D]/15 text-[#A0522D] dark:text-[#d4906a]">
                                      Traducido
                                    </span>
                                  )}
                                  {pred.dbCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                      {pred.dbCount} en BD
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  Etiqueta MobileNet: "{pred.className}"
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-black tabular-nums text-[#A0522D] dark:text-[#d4906a]">
                                {pred.confidencePct}%
                              </span>
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#A0522D] group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>

                          {/* Barra de progreso de confianza */}
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pred.isFoodMatch
                                  ? "bg-linear-to-r from-[#A0522D] to-emerald-500"
                                  : "bg-slate-400 dark:bg-slate-600"
                              }`}
                              style={{
                                width: `${Math.min(100, Math.max(4, Number(pred.confidencePct)))}%`
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
