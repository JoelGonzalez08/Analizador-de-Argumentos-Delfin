// Configuración de la aplicación
const CONFIG = {
  API_BASE: "http://127.0.0.1:8000",
  API_ENDPOINTS: {
    PREDICT: "/predict",
    RECOMMEND: "/recommend"
  },
  ANIMATION_DURATION: 200,
  MAX_TEXT_LENGTH: 10000
};

// Clase principal de la aplicación
class ArgumentAnalyzer {
  constructor() {
    this.editor = null;
    this.isAnalyzing = false;
    this.lastAnalysis = null;
    this.apiStatus = 'disconnected';
    
    // Estado persistente de los botones de formato
    this.formatState = {
      bold: false,
      italic: false,
      insertUnorderedList: false,
      insertOrderedList: false
    };
    
    // Detectar borrado manual del usuario
    this.hasUserDeletedContent = false;
    
    this.init();
  }

  init() {
    this.setupElements();
    this.initializeEditor();
    this.setupEventListeners();
    this.setupToolbar();
    this.checkApiStatus();
    this.updateWordCount();
    this.handlePlaceholder();
  }

  initializeEditor() {
    // Asegurar que el editor esté completamente vacío al inicio
    this.editor.innerHTML = '';
    // Resetear el estado del formato al inicializar
    this.resetFormatState();
  }

  resetFormatState() {
    this.formatState = {
      bold: false,
      italic: false,
      insertUnorderedList: false,
      insertOrderedList: false
    };
  }

  resetFormatStateAndUpdate() {
    this.resetFormatState();
    this.updateToolbarState();
  }

  setupElements() {
    this.editor = document.getElementById("editor");
    this.modal = document.getElementById("modal-backdrop");
    this.modalContent = document.getElementById("modal-content");
    this.recommendationsPanel = document.getElementById("recommendations-panel");
    this.analysisFooter = document.getElementById("analysis-footer");
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.analyzeBtn = document.getElementById("btn-analyze");
    this.apiStatusElement = document.getElementById("api-status");
  }

  setupEventListeners() {
    // Botón de análisis
    this.analyzeBtn.addEventListener("click", () => this.analyzeArgument());
    
    // Modal
    document.getElementById("modal-close").addEventListener("click", () => this.hideModal());
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) this.hideModal();
    });
    
    // Editor
    this.editor.addEventListener("input", () => {
      this.updateWordCount();
      this.handlePlaceholder();
      
      // Solo resetear el estado si el editor está completamente vacío Y el usuario lo borró manualmente
      if (this.isEditorEmpty() && this.hasUserDeletedContent) {
        this.resetFormatStateAndUpdate();
        this.hasUserDeletedContent = false;
      }
    });
    
    // Detectar cuando el usuario borra contenido
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        this.hasUserDeletedContent = true;
      }
    });
    
    this.editor.addEventListener("paste", (e) => this.handlePaste(e));
    this.editor.addEventListener("focus", () => this.handlePlaceholder());
    this.editor.addEventListener("blur", () => this.handlePlaceholder());
    
    // Teclas de acceso rápido
    document.addEventListener("keydown", (e) => this.handleKeyboardShortcuts(e));
  }

  setupToolbar() {
    this.toolbarButtons = {
      "btn-bold": "bold",
      "btn-italic": "italic",
      "btn-bullet": "insertUnorderedList",
      "btn-numbered": "insertOrderedList",
      "btn-undo": "undo",
      "btn-redo": "redo"
    };

    Object.entries(this.toolbarButtons).forEach(([id, command]) => {
      const button = document.getElementById(id);
      if (button) {
        button.addEventListener("click", () => this.execCommand(command, button));
      }
    });

    // Solo actualizar el estado de los botones en eventos específicos
    this.editor.addEventListener("mouseup", (e) => {
      // Solo actualizar si se cambió la selección
      setTimeout(() => this.updateToolbarState(), 10);
    });
    
    // Actualizar estado inicial
    setTimeout(() => this.updateToolbarState(), 100);
  }

  execCommand(command, button) {
    // Manejar el estado persistente de formato
    if (command === "bold" || command === "italic") {
      document.execCommand(command, false, null);
      this.formatState[command] = !this.formatState[command];
    } else if (command === "insertUnorderedList" || command === "insertOrderedList") {
      this.handleListCommand(command);
    } else {
      document.execCommand(command, false, null);
    }
    
    this.editor.focus();
    
    // Actualizar el estado visual del botón después de ejecutar el comando
    setTimeout(() => this.updateToolbarState(), 10);
  }

  handleListCommand(command) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const currentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer;
      
      // Verificar si ya estamos en una lista del mismo tipo
      const isInList = currentElement.closest(command === "insertUnorderedList" ? "ul" : "ol");
      
      if (isInList && this.formatState[command]) {
        // Si ya estamos en una lista del mismo tipo y el estado está activo, salir de la lista
        document.execCommand("outdent", false, null);
        this.formatState[command] = false;
        // Desactivar el otro tipo de lista también
        const otherListType = command === "insertUnorderedList" ? "insertOrderedList" : "insertUnorderedList";
        this.formatState[otherListType] = false;
      } else {
        // Si no estamos en una lista o estamos en una lista diferente, crear/cambiar la lista
        document.execCommand(command, false, null);
        this.formatState[command] = true;
        // Desactivar el otro tipo de lista
        const otherListType = command === "insertUnorderedList" ? "insertOrderedList" : "insertUnorderedList";
        this.formatState[otherListType] = false;
      }
    } else {
      // Si no hay selección, simplemente ejecutar el comando
      document.execCommand(command, false, null);
      this.formatState[command] = !this.formatState[command];
    }
  }

  updateToolbarState() {
    Object.entries(this.toolbarButtons).forEach(([id, command]) => {
      const button = document.getElementById(id);
      if (button) {
        // Usar el estado persistente para botones de formato
        if (this.formatState.hasOwnProperty(command)) {
          button.classList.toggle("active", this.formatState[command]);
        } else {
          // Para comandos que no tienen estado persistente (undo/redo)
          const isActive = this.isCommandActive(command);
          button.classList.toggle("active", isActive);
        }
      }
    });
  }

  isCommandActive(command) {
    try {
      // Para comandos de lista, verificar de manera especial
      if (command === "insertUnorderedList") {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const element = selection.getRangeAt(0).commonAncestorContainer;
          const currentElement = element.nodeType === Node.TEXT_NODE ? element.parentElement : element;
          return !!currentElement.closest("ul");
        }
        return false;
      }
      
      if (command === "insertOrderedList") {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const element = selection.getRangeAt(0).commonAncestorContainer;
          const currentElement = element.nodeType === Node.TEXT_NODE ? element.parentElement : element;
          return !!currentElement.closest("ol");
        }
        return false;
      }
      
      // Para otros comandos, usar queryCommandState
      return document.queryCommandState(command);
    } catch (e) {
      return false;
    }
  }

  handlePaste(event) {
    // Limpiar formato del texto pegado
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + Enter para analizar
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      this.analyzeArgument();
    }
    
    // Ctrl/Cmd + B para negrita
    if ((event.ctrlKey || event.metaKey) && event.key === "b") {
      event.preventDefault();
      this.execCommand("bold");
    }
    
    // Ctrl/Cmd + I para cursiva
    if ((event.ctrlKey || event.metaKey) && event.key === "i") {
      event.preventDefault();
      this.execCommand("italic");
    }
  }

  async checkApiStatus() {
    try {
      // Intentar conectar usando el endpoint de predict con un texto de prueba
      const response = await fetch(`${CONFIG.API_BASE}${CONFIG.API_ENDPOINTS.PREDICT}`, { 
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "test" })
      });
      this.updateApiStatus(response.ok ? 'connected' : 'disconnected');
    } catch (error) {
      this.updateApiStatus('disconnected');
    }
  }

  updateApiStatus(status) {
    this.apiStatus = status;
    const statusElement = this.apiStatusElement;
    
    statusElement.className = `api-status ${status}`;
    statusElement.innerHTML = `
      <span class="status-dot"></span>
      ${status === 'connected' ? 'API conectada' : 'API desconectada'}
    `;
    
    // Habilitar/deshabilitar botón de análisis
    this.analyzeBtn.disabled = status === 'disconnected';
  }

  updateWordCount() {
    const text = this.editor.innerText || this.editor.textContent || "";
    // Solo contar palabras si hay contenido real (no placeholder)
    const isRealContent = text.trim() && !this.isEditorEmpty();
    const wordCount = isRealContent ? text.trim().split(/\s+/).length : 0;
    
    const wordCountElement = document.getElementById("word-count");
    if (wordCountElement) {
      wordCountElement.textContent = `${wordCount} palabras`;
    }
  }

  // Verificar si el editor está realmente vacío (sin contenido del usuario)
  isEditorEmpty() {
    const text = this.editor.innerText || this.editor.textContent || "";
    const trimmedText = text.trim();
    
    // Verificar si está vacío o solo contiene caracteres de espacios/saltos de línea
    if (trimmedText === "" || trimmedText === "\n" || trimmedText === "\r\n") {
      return true;
    }
    
    // También verificar el HTML para ver si solo contiene elementos vacíos
    const innerHTML = this.editor.innerHTML.trim();
    const onlyEmptyElements = /^(<br\s*\/?>|<div><br\s*\/?\><\/div>|<p><br\s*\/?\><\/p>|\s)*$/i.test(innerHTML);
    
    return onlyEmptyElements;
  }

  // Manejar la visibilidad del placeholder
  handlePlaceholder() {
    if (this.isEditorEmpty()) {
      this.editor.classList.add('show-placeholder');
    } else {
      this.editor.classList.remove('show-placeholder');
    }
  }

  showLoading() {
    this.loadingOverlay.style.display = "flex";
    this.analyzeBtn.disabled = true;
    // Spinner SVG animado para el botón
    this.analyzeBtn.innerHTML = `
      <svg class="animate-spin mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      Analizando...`;
  }

  hideLoading() {
    this.loadingOverlay.style.display = "none";
    this.analyzeBtn.disabled = false;
    this.analyzeBtn.innerHTML = '<span class="mr-2">🔍</span>Analizar Argumento';
  }

  showModal(content) {
    this.modalContent.innerHTML = content;
    this.modal.style.display = "flex";
  }

  hideModal() {
    this.modal.style.display = "none";
  }

  async analyzeArgument() {
    const text = this.editor.innerText.trim();
    
    if (!text) {
      this.showNotification("Por favor, escribe algo para analizar", "warning");
      return;
    }

    if (text.length > CONFIG.MAX_TEXT_LENGTH) {
      this.showNotification("El texto es demasiado largo. Máximo 10,000 caracteres.", "error");
      return;
    }

    if (this.apiStatus !== 'connected') {
      this.showNotification("La API no está disponible. Verifica la conexión.", "error");
      return;
    }

    try {
      this.showLoading();
      this.isAnalyzing = true;

      // Paso 1: Obtener predicción
      const prediction = await this.getPrediction(text);
      
      // Paso 2: Resaltar texto
      this.highlightText(prediction);
      
      // Paso 3: Extraer premisas y conclusiones
      const { premises, conclusions } = this.extractSpans(prediction);
      
      // Paso 4: Actualizar contadores
      this.updateCounters(premises.length, conclusions.length);
      
      // Paso 5: Obtener recomendaciones
      const recommendations = await this.getRecommendations(premises, conclusions);
      
      // Paso 6: Renderizar sugerencias
      this.renderRecommendations(recommendations, premises, conclusions);
      
      // Paso 7: Actualizar timestamp
      this.updateTimestamp();
      
      this.lastAnalysis = { text, premises, conclusions, recommendations };
      this.showNotification("Análisis completado exitosamente", "success");
      
    } catch (error) {
      console.error("Error durante el análisis:", error);
      this.showNotification(
        `Error durante el análisis: ${error.message}`, 
        "error"
      );
    } finally {
      this.hideLoading();
      this.isAnalyzing = false;
    }
  }

  async getPrediction(text) {
    const response = await fetch(`${CONFIG.API_BASE}${CONFIG.API_ENDPOINTS.PREDICT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`Error en la predicción: ${response.status}`);
    }

    const data = await response.json();
    return data.prediction;
  }

  async getRecommendations(premises, conclusions) {
    const response = await fetch(`${CONFIG.API_BASE}${CONFIG.API_ENDPOINTS.RECOMMEND}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ premises, conclusions })
    });

    if (!response.ok) {
      throw new Error(`Error en las recomendaciones: ${response.status}`);
    }

    const data = await response.json();
    return data.recommendations;
  }

  highlightText(prediction) {
    let html = "";
    prediction.forEach(({ token, label }) => {
      const className = this.getHighlightClass(label);
      html += className 
        ? `<span class="${className}">${token}</span> `
        : `${token} `;
    });
    
    this.editor.innerHTML = html.trim();
  }

  getHighlightClass(label) {
    if (label.startsWith("B-P") || label.startsWith("I-P")) {
      return "highlight-premise";
    } else if (label.startsWith("B-C") || label.startsWith("I-C")) {
      return "highlight-conclusion";
    }
    return "";
  }

  extractSpans(prediction) {
    const extractSpansForType = (pred, beginPrefix, insidePrefix) => {
      const spans = [];
      let buffer = [];
      
      pred.forEach(({ token, label }) => {
        const inSpan = label.startsWith(beginPrefix) || label.startsWith(insidePrefix);
        
        if (inSpan) {
          buffer.push(token);
        } else if (buffer.length) {
          spans.push(buffer.join(" "));
          buffer = [];
        }
        
        // Finalizar span al encontrar puntuación
        if (/[.!?]$/.test(token) && buffer.length) {
          spans.push(buffer.join(" "));
          buffer = [];
        }
      });
      
      if (buffer.length) {
        spans.push(buffer.join(" "));
      }
      
      return spans;
    };

    const premises = extractSpansForType(prediction, "B-P", "I-P");
    const conclusions = extractSpansForType(prediction, "B-C", "I-C");
    
    return { premises, conclusions };
  }

  updateCounters(premiseCount, conclusionCount) {
    // Protege en caso de que el footer no exista
    if (!this.analysisFooter) return;

    // Sobrescribimos el HTML del footer con los contadores actualizados.
    // Evitamos usar getElementById sobre elementos que pueden haber sido
    // eliminados/recreados durante análisis previos.
    this.analysisFooter.innerHTML = `
      <div class="flex items-center space-x-4">
        <span class="premise-indicator">
          <span class="indicator-dot"></span>
          <span class="text-blue-600 font-semibold">${premiseCount} premisas</span>
        </span>
        <span class="conclusion-indicator">
          <span class="indicator-dot"></span>
          <span class="text-yellow-600 font-semibold">${conclusionCount} conclusiones</span>
        </span>
      </div>
      <span class="word-count">${this.getWordCount()} palabras</span>
    `;
  }

  getWordCount() {
    const text = this.editor.innerText || this.editor.textContent || "";
    // Solo contar palabras si hay contenido real (no placeholder)
    const isRealContent = text.trim() && !this.isEditorEmpty();
    return isRealContent ? text.trim().split(/\s+/).length : 0;
  }

  renderRecommendations(recommendations, premises, conclusions) {
    this.recommendationsPanel.innerHTML = "";
    
    if (recommendations.length === 0) {
      this.recommendationsPanel.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <div class="text-4xl mb-2">🤔</div>
          <p>No se encontraron sugerencias para este argumento</p>
        </div>
      `;
      return;
    }

    recommendations.forEach((recommendation, index) => {
      const isPremise = index < premises.length;
      const referencePhrase = isPremise ? premises[index] : conclusions[index - premises.length];
      const type = isPremise ? "PREMISA" : "CONCLUSIÓN";
      
      const card = this.createRecommendationCard(
        recommendation, 
        referencePhrase, 
        type, 
        isPremise ? "premise" : "conclusion"
      );
      
      this.recommendationsPanel.appendChild(card);
    });
  }

  createRecommendationCard(recommendation, referencePhrase, type, cardType) {
    const preview = recommendation.length > 80 
      ? recommendation.slice(0, 80) + "…" 
      : recommendation;
    
    const card = document.createElement("div");
    card.className = `recommendation-card ${cardType}`;
    
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <span class="type-badge">${type}</span>
        <span class="text-xs text-gray-500">${recommendation.length} caracteres</span>
      </div>
      <p class="italic text-sm mb-3 text-gray-600">"${referencePhrase}"</p>
      <p class="text-gray-800 mb-3">${preview}</p>
      <button class="leer-mas">Leer más</button>
    `;
    
    // Eventos del hover
    card.addEventListener("mouseenter", () => this.highlightReference(referencePhrase));
    card.addEventListener("mouseleave", () => this.removeHighlight());
    
    // Botón "Leer más"
    const leerMasBtn = card.querySelector(".leer-mas");
    leerMasBtn.addEventListener("click", () => {
      this.showModal(`
        <div class="space-y-4">
          <div class="p-3 bg-gray-100 rounded-lg">
            <p class="text-sm text-gray-600 mb-2"><strong>Referencia:</strong></p>
            <p class="italic">"${referencePhrase}"</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2"><strong>Sugerencia:</strong></p>
            <p class="text-gray-800 leading-relaxed">${recommendation}</p>
          </div>
        </div>
      `);
    });
    
    return card;
  }

  highlightReference(phrase) {
    const spans = this.editor.querySelectorAll("span");
    spans.forEach(span => {
      if (span.textContent.trim() === phrase) {
        span.classList.add("highlight-active");
      }
    });
  }

  removeHighlight() {
    const activeHighlights = this.editor.querySelectorAll(".highlight-active");
    activeHighlights.forEach(span => {
      span.classList.remove("highlight-active");
    });
  }

  updateTimestamp() {
    const now = new Date();
    const timeElement = document.getElementById("last-analyzed");
    if (timeElement) {
      timeElement.textContent = now.toLocaleTimeString("es-ES");
      timeElement.setAttribute("datetime", now.toISOString());
    } else {
      console.warn("updateTimestamp: elemento #last-analyzed no encontrado en el DOM");
    }
  }

  showNotification(message, type = "info") {
    // Crear notificación temporal
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
    
    const colors = {
      success: "bg-green-500 text-white",
      error: "bg-red-500 text-white",
      warning: "bg-yellow-500 text-white",
      info: "bg-blue-500 text-white"
    };
    
    notification.className += ` ${colors[type]}`;
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <span>${this.getNotificationIcon(type)}</span>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
      notification.classList.remove("translate-x-full");
    }, 100);
    
    // Remover después de 3 segundos
    setTimeout(() => {
      notification.classList.add("translate-x-full");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  getNotificationIcon(type) {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️"
    };
    return icons[type] || icons.info;
  }
}

// Utilidades adicionales
class Utils {
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static formatDate(date) {
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  try {
    window.argumentAnalyzer = new ArgumentAnalyzer();
    console.log("✅ Analizador de Argumentos inicializado correctamente");
  } catch (error) {
    console.error("❌ Error al inicializar la aplicación:", error);
  }
});

// Manejo de errores globales
window.addEventListener("error", (event) => {
  console.error("Error global:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Promesa rechazada no manejada:", event.reason);
});
