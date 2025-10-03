// Configuration constants
const CONFIG = {
  STORAGE_KEY: 'iframeNavigationHistory',
  HIGHLIGHT_COLOR: "hsl(269 100% 70%)", // Primary purple from theme
  HIGHLIGHT_BG: "hsla(269, 100%, 70%, 0.1)",
  ACCENT_COLOR: "hsl(195 83% 68%)", // Accent blue from theme
  ACCENT_BG: "hsla(195, 83%, 68%, 0.05)",
  BACKGROUND_DARK: "hsl(240 10% 3.9%)",
  FOREGROUND_LIGHT: "hsl(0 0% 98%)",
  ALLOWED_ORIGINS: [
    "http://localhost:8081"
  ],
  DEBOUNCE_DELAY: 10,
  Z_INDEX: 10000,
  TOOLTIP_OFFSET: 25,
  MAX_TOOLTIP_WIDTH: 200,
  SCROLL_DEBOUNCE: 420,
  FULL_WIDTH_TOOLTIP_OFFSET: "12px",
  HIGHLIGHT_STYLE: {
    FULL_WIDTH: { OFFSET: "-5px", STYLE: "dotted" },
    NORMAL: { OFFSET: "0", STYLE: "dotted" }
  },
  SELECTED_ATTR: "ideavo-selected",
  HOVERED_ATTR: "ideavo-hovered",
  // Styling constants
  FONT_FAMILY: "'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  TOOLTIP_BORDER_RADIUS: "12px",
  HIGHLIGHT_BORDER_RADIUS: "8px",
  FULL_WIDTH_BORDER_RADIUS: "4px",
  TOOLTIP_PADDING: "6px 12px",
  TOOLTIP_FONT_SIZE: "12px",
  TOOLTIP_FONT_WEIGHT: "600",
  TOOLTIP_LINE_HEIGHT: "1.2",
  TOOLTIP_LETTER_SPACING: "0.025em",
  OUTLINE_WIDTH: "2px",
  SELECTED_OUTLINE_OFFSET: "2px",
  TRANSITION_FAST: "all 0.15s ease-in-out",
  TRANSITION_SMOOTH: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  BOX_SHADOW_TOOLTIP: "0 4px 12px -2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
  BOX_SHADOW_SELECTED: "0 0 0 1px",
  BACKDROP_BLUR: "blur(8px)",
  TOOLTIP_OPACITY_HOVER: "1",
  TOOLTIP_OPACITY_SELECTED: "0.9"
};

// Cross-origin message sender
const sendMessage = (message) => {
  CONFIG.ALLOWED_ORIGINS.forEach(origin => {
    try {
      if (!window.parent) return;
      if (!message || typeof message !== "object") {
        console.error("Invalid message format");
        return;
      }
      window.parent.postMessage(message, origin);
    } catch (error) {
      console.error(`Failed to send message to ${origin}:`, error);
    }
  });
};

// DOM ready promise
const domReady = () => new Promise(resolve => {
  if (document.readyState !== "loading") {
    resolve();
    return;
  }
  requestIdleCallback(() => {
    resolve();
  });
});

// Wait for root element to be populated
const waitForRootElement = () => new Promise(resolve => {
  const root = document.getElementById("root");
  if (root && root.children.length > 0) {
    resolve();
    return;
  }

  new MutationObserver((mutations, observer) => {
    const root = document.getElementById("root");
    if (root && root.children.length > 0) {
      observer.disconnect();
      resolve();
    }
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
});

// Element selector state manager
class SelectorState {
  constructor() {
    this.hoveredElement = null;
    this.isActive = false;
    this.tooltip = null;
    this.selectedTooltips = new Map();
    this.clickedElementMap = new Map();
    this.scrollTimeout = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.styleElement = null;
    // Navigation state
    this.historyPosition = 0;
    this.historyStack = [];
    this.isNavigationInitialized = false;
  }

  reset() {
    this.hoveredElement = null;
    this.scrollTimeout = null;
    this.selectedTooltips.forEach(tooltip => tooltip.remove());
    this.selectedTooltips.clear();
  }
}

// Utility functions
const debounce = (func, delay) => {
  let timeoutId = null;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const serializeValue = (value, options = {}) => {
  // Simplified serialization - in real implementation this would be more complex
  try {
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  } catch {
    return "[Unserializable]";
  }
};

// Element selector implementation
const setupElementSelector = () => {
  const state = new SelectorState();

  // Create tooltip element
  const createTooltip = () => {
    state.tooltip = document.createElement("div");
    state.tooltip.className = "ideavo-selector-tooltip";
    state.tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(state.tooltip);

    // Add CSS styles
    const style = document.createElement("style");
    style.textContent = `
      .ideavo-selector-tooltip {
        position: fixed;
        z-index: ${CONFIG.Z_INDEX};
        pointer-events: none;
        background: ${CONFIG.BACKGROUND_DARK};
        background: linear-gradient(135deg, ${CONFIG.HIGHLIGHT_COLOR}, ${CONFIG.ACCENT_COLOR});
        color: ${CONFIG.FOREGROUND_LIGHT};
        padding: ${CONFIG.TOOLTIP_PADDING};
        border-radius: ${CONFIG.TOOLTIP_BORDER_RADIUS};
        font-family: ${CONFIG.FONT_FAMILY};
        font-size: ${CONFIG.TOOLTIP_FONT_SIZE};
        font-weight: ${CONFIG.TOOLTIP_FONT_WEIGHT};
        line-height: ${CONFIG.TOOLTIP_LINE_HEIGHT};
        white-space: nowrap;
        display: none;
        box-shadow: ${CONFIG.BOX_SHADOW_TOOLTIP};
        backdrop-filter: ${CONFIG.BACKDROP_BLUR};
        transition: ${CONFIG.TRANSITION_SMOOTH};
        margin: 0;
        letter-spacing: ${CONFIG.TOOLTIP_LETTER_SPACING};
        opacity: ${CONFIG.TOOLTIP_OPACITY_HOVER};
      }

      .ideavo-selected-tooltip {
        position: fixed;
        z-index: ${CONFIG.Z_INDEX};
        pointer-events: none;
        background: linear-gradient(135deg, ${CONFIG.HIGHLIGHT_COLOR}, ${CONFIG.ACCENT_COLOR});
        color: ${CONFIG.FOREGROUND_LIGHT};
        padding: ${CONFIG.TOOLTIP_PADDING};
        border-radius: ${CONFIG.TOOLTIP_BORDER_RADIUS};
        font-family: ${CONFIG.FONT_FAMILY};
        font-size: ${CONFIG.TOOLTIP_FONT_SIZE};
        font-weight: ${CONFIG.TOOLTIP_FONT_WEIGHT};
        line-height: ${CONFIG.TOOLTIP_LINE_HEIGHT};
        white-space: nowrap;
        display: block;
        box-shadow: ${CONFIG.BOX_SHADOW_TOOLTIP};
        backdrop-filter: ${CONFIG.BACKDROP_BLUR};
        opacity: ${CONFIG.TOOLTIP_OPACITY_SELECTED};
        margin: 0;
        letter-spacing: ${CONFIG.TOOLTIP_LETTER_SPACING};
        border: 1px solid rgba(255,255,255,0.2);
      }

      [${CONFIG.HOVERED_ATTR}] {
        position: relative;
      }

      [${CONFIG.HOVERED_ATTR}]::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: ${CONFIG.HIGHLIGHT_BORDER_RADIUS};
        outline: ${CONFIG.OUTLINE_WIDTH} ${CONFIG.HIGHLIGHT_STYLE.NORMAL.STYLE} ${CONFIG.HIGHLIGHT_COLOR} !important;
        outline-offset: ${CONFIG.HIGHLIGHT_STYLE.NORMAL.OFFSET} !important;
        background-color: ${CONFIG.HIGHLIGHT_BG} !important;
        z-index: ${CONFIG.Z_INDEX - 1};
        pointer-events: none;
        transition: ${CONFIG.TRANSITION_FAST};
      }

      [${CONFIG.SELECTED_ATTR}] {
        position: relative;
      }

      [${CONFIG.SELECTED_ATTR}]::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: ${CONFIG.HIGHLIGHT_BORDER_RADIUS};
        outline: ${CONFIG.OUTLINE_WIDTH} ${CONFIG.HIGHLIGHT_STYLE.NORMAL.STYLE} ${CONFIG.HIGHLIGHT_COLOR} !important;
        outline-offset: ${CONFIG.SELECTED_OUTLINE_OFFSET} !important;
        background: ${CONFIG.HIGHLIGHT_BG} !important;
        z-index: ${CONFIG.Z_INDEX - 1};
        pointer-events: none;
        transition: ${CONFIG.TRANSITION_SMOOTH};
        box-shadow: ${CONFIG.BOX_SHADOW_SELECTED} ${CONFIG.HIGHLIGHT_COLOR}33;
      }

      [${CONFIG.SELECTED_ATTR}][contenteditable] {
        outline: none !important;
      }

      [${CONFIG.HOVERED_ATTR}][data-full-width]::before {
        outline-offset: ${CONFIG.HIGHLIGHT_STYLE.FULL_WIDTH.OFFSET} !important;
        border-radius: ${CONFIG.FULL_WIDTH_BORDER_RADIUS};
      }

      [${CONFIG.SELECTED_ATTR}][data-full-width]::before {
        outline-offset: ${CONFIG.HIGHLIGHT_STYLE.FULL_WIDTH.OFFSET} !important;
        border-radius: ${CONFIG.FULL_WIDTH_BORDER_RADIUS};
      }
    `;

    document.head.appendChild(style);
  };

  // Position tooltip
  const positionTooltip = (tooltip, element) => {
    if (!tooltip || !element) return;

    try {
      const rect = element.getBoundingClientRect();
      const tagName = element.tagName.toLowerCase();
      const isFullWidth = Math.abs(rect.width - window.innerWidth) < 5;

      tooltip.style.maxWidth = `${CONFIG.MAX_TOOLTIP_WIDTH}px`;

      if (isFullWidth) {
        tooltip.style.left = CONFIG.FULL_WIDTH_TOOLTIP_OFFSET;
        tooltip.style.top = CONFIG.FULL_WIDTH_TOOLTIP_OFFSET;
      } else {
        const top = Math.max(0, rect.top - CONFIG.TOOLTIP_OFFSET);
        tooltip.style.left = `${Math.max(0, rect.left)}px`;
        tooltip.style.top = `${top}px`;
      }

      tooltip.textContent = tagName;
    } catch (error) {
      console.error("Error positioning tooltip:", error);
      tooltip.remove();
    }
  };

  // Element highlighting
  const highlightElement = (element) => {
    const isFullWidth = Math.abs(element.getBoundingClientRect().width - window.innerWidth) < 5;
    element.setAttribute(CONFIG.HOVERED_ATTR, "true");
    if (isFullWidth) {
      element.setAttribute("data-full-width", "true");
    }
  };

  const unhighlightElement = (element) => {
    element.removeAttribute(CONFIG.HOVERED_ATTR);
    element.removeAttribute(CONFIG.SELECTED_ATTR);
    element.removeAttribute("data-full-width");
    element.classList.remove("ideavo-selected-element");
    element.style.cursor = "";
  };

  // Event handlers
  const handleMouseOver = debounce((event) => {
    if (!state.isActive || !isValidElement(event.target) ||
      event.target.tagName.toLowerCase() === "html" ||
      isSvgChild(event.target)) {
      return;
    }

    // Remove previous highlights
    if (state.hoveredElement) {
      const elements = findElements(getElementIdentifier(state.hoveredElement));
      elements.forEach(el => {
        if (!el.classList.contains("ideavo-selected-element")) {
          unhighlightElement(el);
        }
      });
    }

    state.hoveredElement = event.target;

    if (state.hoveredElement) {
      const elements = findElements(getElementIdentifier(state.hoveredElement));
      elements?.forEach(el => {
        if (!el.classList.contains("ideavo-selected-element")) {
          highlightElement(el);
        }
      });

      // Show tooltip
      if (state.tooltip) {
        positionTooltip(state.tooltip, state.hoveredElement);
        state.tooltip.style.display = "block";
      }
    }
  }, CONFIG.DEBOUNCE_DELAY);

  const handleMouseOut = (event) => {
    // Hide tooltip only if element is not selected
    if (state.tooltip && event.target && !event.target.hasAttribute(CONFIG.SELECTED_ATTR)) {
      state.tooltip.style.display = "none";
    }
  };

  const handleClick = (event) => {
    if (!state.isActive || !isValidElement(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    clearAllSelections();
    // Handle element selection logic
    const identifier = getElementIdentifier(event.target);
    const elements = findElements(identifier);
    const elementRect = elements[0]?.getBoundingClientRect();

    elements.forEach(el => {
      el.setAttribute(CONFIG.SELECTED_ATTR, "true");
      el.classList.add("ideavo-selected-element");

      // Create persistent tooltip for selected element
      const selectedTooltip = document.createElement("div");
      selectedTooltip.className = "ideavo-selected-tooltip";
      selectedTooltip.setAttribute("role", "tooltip");
      selectedTooltip.textContent = el.tagName.toLowerCase();
      document.body.appendChild(selectedTooltip);

      // Position the selected tooltip
      positionTooltip(selectedTooltip, el);

      // Store the tooltip reference
      state.selectedTooltips.set(el, selectedTooltip);
    });

    // Hide the main hover tooltip since we now have a selected tooltip
    if (state.tooltip) {
      state.tooltip.style.display = "none";
    }

    // Send selection message to parent
    sendMessage({
      type: "ELEMENT_SELECTED",
      data: {
        identifier: identifier,
        tagName: event.target.tagName.toLowerCase(),
        className: event.target.className,
        id: event.target.id,
        rect: elementRect,
        innerText: elements[0].innerText
      }
    });
  };

  // Utility functions
  const isValidElement = (element) => {
    return element && element.nodeType === Node.ELEMENT_NODE;
  };

  const findElementByIdeavoId = (ideavoId) =>{
    return document.querySelector(`[ideavo-tag-id="${ideavoId}"]`);
  }

  const isSvgChild = (element) => {
    const isSvg = element.tagName.toLowerCase() === "svg";
    const hasClosestSvg = element.closest("svg") !== null;
    return !isSvg && hasClosestSvg;
  };

  const getElementIdentifier = (element) => {
    // Generate unique identifier for element
    const parts = element.getAttribute("ideavo-tag-id").split(':');
    const isStylesEditable = element.getAttribute("ideavo-styles-editable");
    const isContentEditable = element.getAttribute("ideavo-content-editable");
    return {
      filePath: parts[0] || "unknown",
      lineNumber: parseInt(parts[1]) || 0,
      col: parseInt(parts[2]) || 0,
      styleEditable: isStylesEditable,
      contentEditable: isContentEditable,
    };
  };

  const findElements = (identifier) => {
    const selector1 = `[ideavo-tag-id="${identifier.filePath}:${identifier.lineNumber}:${identifier.col || "0"}"]`;
    const elements = document.querySelectorAll(selector1);

    return elements;
  };

  const updateElementContent = (eventData) => {
    if (!eventData || !eventData.payload) return;

    const el = findElementByIdeavoId(eventData.payload.id)
    if (!el) return;
    el.textContent = eventData.payload.content; // or innerHTML if needed
  }

  const updateElementStyles = (eventData) => {
    if (!eventData) return;

     const el = findElementByIdeavoId(eventData.payload.id)
    if (!el) return;
    const newStyles = eventData.payload.styles;
    Object.entries(newStyles).forEach(([prop, value]) => {
      el.style.setProperty(prop, value); // updates or adds the style
    });
  }

  const deleteElement = (eventData) => {
    if (!eventData) return;

     const el = findElementByIdeavoId(eventData.payload.id)
    if (!el) return;
    el.remove();
  }

  // Navigation functions
  const initializeNavigationState = (url = window.location.href) => {
    state.historyStack = [url];
    state.historyPosition = 0;
  };

  const getNavigationState = () => ({
    canGoBack: state.historyPosition > 0,
    canGoForward: state.historyPosition < state.historyStack.length - 1,
    currentUrl: window.location.href
  });

  const sendNavigationState = () => {
    if (window.parent !== window) {
      sendMessage({
        type: 'navigation-state',
        ...getNavigationState()
      });
    }
  };

  const saveNavigationState = () => {
    try {
      sessionStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        historyStack: state.historyStack,
        historyPosition: state.historyPosition
      }));
    } catch (e) {
      console.warn('Failed to save navigation state:', e);
    }
  };

  const restoreNavigationState = () => {
    try {
      const savedState = sessionStorage.getItem(CONFIG.STORAGE_KEY);
      if (!savedState) return false;

      const { historyStack: savedStack, historyPosition: savedPosition } = JSON.parse(savedState);

      if (!Array.isArray(savedStack) || typeof savedPosition !== 'number') {
        return false;
      }

      const currentUrl = window.location.href;
      const urlIndex = savedStack.indexOf(currentUrl);
      if (urlIndex !== -1) {
        state.historyStack = savedStack;
        state.historyPosition = urlIndex;
      } else {
        state.historyStack = [...savedStack, currentUrl];
        state.historyPosition = state.historyStack.length - 1;
      }

      sessionStorage.removeItem(CONFIG.STORAGE_KEY);
      return true;
    } catch (e) {
      console.warn('Failed to restore navigation state:', e);
      return false;
    }
  };

  const updateHistoryState = () => {
    const currentUrl = window.location.href;

    if (state.historyStack[state.historyPosition] === currentUrl) {
      return;
    }

    state.historyStack = state.historyStack.slice(0, state.historyPosition + 1);
    state.historyStack.push(currentUrl);
    state.historyPosition = state.historyStack.length - 1;

    sendNavigationState();
  };

  const handlePopState = () => {
    const currentUrl = window.location.href;
    const urlIndex = state.historyStack.indexOf(currentUrl);

    if (urlIndex !== -1) {
      state.historyPosition = urlIndex;
    } else {
      updateHistoryState();
    }

    sendNavigationState();
  };

  const navigationHandlers = {
    back: () => {
      if (state.historyPosition > 0) {
        state.historyPosition--;
        window.history.back();
      }
    },

    forward: () => {
      if (state.historyPosition < state.historyStack.length - 1) {
        state.historyPosition++;
        window.history.forward();
      }
    },

    refresh: () => {
      saveNavigationState();
      window.location.reload();
    }
  };

  // Message handler for selector commands
  const handleSelectorMessage = (event) => {
    try {
      if (!event?.origin || !event?.data?.type || !CONFIG.ALLOWED_ORIGINS.includes(event.origin)) {
        return;
      }
      switch (event.data.type) {
        case "TOGGLE_SELECTOR":
          const isActive = !!event.data.payload.isActive;
          if (state.isActive !== isActive) {
            state.isActive = isActive;
            if (state.isActive) {
              activateSelector();
            } else {
              deactivateSelector();
            }
          }
          break;

        case "CLEAR_SELECTIONS":
          clearAllSelections();
          break;

        case "UPDATE_CONTENT":
          updateElementContent(event.data);
          break;
        case "UPDATE_STYLES":
         updateElementStyles(event.data);
          break;
        case "DELETE_ELEMENT":
          deleteElement(event.data);
          break;

        case "navigation-command":
          const handler = navigationHandlers[event.data.action];
          if (handler) {
            handler();
          }
          break;
      }
    } catch (error) {
      console.error("Error handling selector message:", error);
    }
  };

  const activateSelector = () => {
    createTooltip();
    waitForRootElement().then(() => {
      // Re-enable disabled buttons during selection
      document.querySelectorAll("button[disabled]").forEach(btn => {
        btn.removeAttribute("disabled");
        btn.setAttribute("ideavo-disabled", "");
      });
    });

    // Add event listeners
    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("click", handleClick, true);

    // Add global styles
    const style = document.createElement("style");
    style.textContent = `
      * {
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
    state.styleElement = style;
  };

  const deactivateSelector = () => {
    // Remove event listeners
    clearAllSelections();
    document.removeEventListener("mouseover", handleMouseOver);
    document.removeEventListener("mouseout", handleMouseOut);
    document.removeEventListener("click", handleClick);

    // Restore disabled buttons
    document.querySelectorAll("[ideavo-disabled]").forEach(btn => {
      btn.removeAttribute("ideavo-disabled");
      btn.setAttribute("disabled", "");
    });

    // Remove styles and cleanup
    if (state.styleElement) {
      state.styleElement.remove();
      state.styleElement = null;
    }

    // Clear all highlights and tooltips
    state.selectedTooltips.forEach(tooltip => tooltip.remove());
    state.selectedTooltips.clear();

    if (state.hoveredElement) {
      if (!state.hoveredElement.hasAttribute(CONFIG.SELECTED_ATTR)) {
        unhighlightElement(state.hoveredElement);
      }
      state.hoveredElement = null;
    }

    if (state.tooltip) {
      state.tooltip.remove();
      state.tooltip = null;
      clearAllSelections();
    }
  };

  const clearAllSelections = () => {
    // Remove all selected tooltips first
    state.selectedTooltips.forEach((tooltip, element) => {
      tooltip.remove();
      // Also clean up the element attributes
      element.removeAttribute(CONFIG.SELECTED_ATTR);
      element.classList.remove("ideavo-selected-element");
      // Remove hover attributes if present
      unhighlightElement(element);
    });
    state.selectedTooltips.clear();
    state.clickedElementMap.clear();

    // Double-check and clean up any remaining selected elements
    const remainingSelectedElements = document.querySelectorAll(`[${CONFIG.SELECTED_ATTR}]`);
    remainingSelectedElements.forEach(el => {
      el.removeAttribute(CONFIG.SELECTED_ATTR);
      el.classList.remove("ideavo-selected-element");
      unhighlightElement(el);
    });

    // Also clean up any remaining hover attributes
    const remainingHoveredElements = document.querySelectorAll(`[${CONFIG.HOVERED_ATTR}]`);
    remainingHoveredElements.forEach(el => {
      unhighlightElement(el);
    });
  };

  // Initialize navigation
  const initializeNavigation = () => {
    if (state.isNavigationInitialized) return;

    if (!restoreNavigationState()) {
      initializeNavigationState();
    }

    window.addEventListener('popstate', handlePopState);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      updateHistoryState();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      updateHistoryState();
    };

    state.isNavigationInitialized = true;
    sendNavigationState();
  };

  // Initialize message listener
  window.addEventListener("message", handleSelectorMessage);

  // Initialize navigation
  initializeNavigation();

  return () => {
    window.removeEventListener("message", handleSelectorMessage);
    window.removeEventListener('popstate', handlePopState);
    deactivateSelector();
  };
};

// Main initialization function
const initIdeavo = () => {
  // Check for script override in development
  // DECIDE: remove this block or not ?
  if (window.location.search.includes("lov-override-script")) {
    const overrideUrl = "http://localhost:8001/lovable.js";
    console.log("Overriding lovable.js script with:", overrideUrl);

    const script = document.createElement("script");
    script.type = "module";
    script.src = overrideUrl;
    document.body.appendChild(script);
    return;
  }

  // Only run in iframe context
  if (window.top === window.self) return;
  domReady();

  // Setup element selector
  const cleanupSelector = setupElementSelector();

  // Cleanup on page unload
  window.addEventListener("unload", () => {
    if (cleanupSelector) {
      cleanupSelector();
    }
  });
};

// Start the application
initIdeavo();

