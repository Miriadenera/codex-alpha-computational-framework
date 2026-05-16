import React from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import App from "./App.jsx";
import "./styles.css";

/*
  Codex Alpha dashboard runtime safety layer.

  Purpose:
  - prevent react-force-graph-3d / Three.js disposal crashes during page navigation;
  - keep the local dashboard alive when leaving WebGL-heavy pages;
  - avoid app-wide blank screens caused by WebGLRenderer.dispose().
*/

function installAnimationFrameFallbacks() {
  if (typeof window === "undefined") {
    return;
  }

  const requestFallback =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 16);

  const cancelFallback =
    typeof window.cancelAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : (id) => window.clearTimeout(id);

  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = requestFallback;
  }

  if (typeof window.cancelAnimationFrame !== "function") {
    window.cancelAnimationFrame = cancelFallback;
  }

  const patchPrototype = (ContextClass) => {
    if (!ContextClass?.prototype) {
      return;
    }

    if (typeof ContextClass.prototype.requestAnimationFrame !== "function") {
      ContextClass.prototype.requestAnimationFrame = requestFallback;
    }

    if (typeof ContextClass.prototype.cancelAnimationFrame !== "function") {
      ContextClass.prototype.cancelAnimationFrame = cancelFallback;
    }
  };

  patchPrototype(window.WebGLRenderingContext);
  patchPrototype(window.WebGL2RenderingContext);
}

function installThreeDisposeGuard() {
  if (!THREE?.WebGLRenderer?.prototype) {
    return;
  }

  const proto = THREE.WebGLRenderer.prototype;

  if (proto.__codexAlphaDisposeGuardInstalled) {
    return;
  }

  const originalDispose = proto.dispose;

  if (typeof originalDispose !== "function") {
    return;
  }

  proto.dispose = function guardedDispose(...args) {
    try {
      return originalDispose.apply(this, args);
    } catch (error) {
      const message = String(error?.message ?? error ?? "");

      if (
        message.includes("cancelAnimationFrame") ||
        message.includes("requestAnimationFrame")
      ) {
        console.warn(
          "[Codex Alpha] WebGLRenderer.dispose() animation-frame cleanup was intercepted safely.",
          error,
        );

        return undefined;
      }

      throw error;
    }
  };

  proto.__codexAlphaDisposeGuardInstalled = true;
}

installAnimationFrameFallbacks();
installThreeDisposeGuard();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found. Check index.html.");
}

createRoot(rootElement).render(<App />);