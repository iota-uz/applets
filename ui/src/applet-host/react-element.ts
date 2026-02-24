import { createRoot, type Root } from 'react-dom/client';

export type RouterMode = 'url' | 'memory'
export type ShellMode = 'embedded' | 'standalone'

type RegistryEntry = {
  options: DefineReactAppletElementOptions
  observed: Set<string>
}

export interface AppletHostConfig {
  basePath: string
  shellMode?: ShellMode
  routerMode: RouterMode
  attrs: Record<string, string>
}

export interface DefineReactAppletElementOptions {
  tagName: string
  styles?: string | (() => string)
  render: (host: AppletHostConfig) => React.ReactElement
  observedAttributes?: string[]
  observeDarkMode?: boolean
  /**
   * Use Shadow DOM for CSS isolation (default: true).
   *
   * Set to `false` for full-page applets that use libraries requiring
   * document-level DOM access (e.g. Headless UI Dialog portals).
   * When false, styles are injected into document.head instead.
   */
  shadow?: boolean
}

export function defineReactAppletElement(options: DefineReactAppletElementOptions): void {
  const tagName = options.tagName.toLowerCase();

  const registry = getRegistry();
  const existing = registry.get(tagName);
  if (existing) {
    existing.options = options;
    for (const a of options.observedAttributes ?? []) {existing.observed.add(a);}
  } else {
    const observed = new Set<string>(['base-path', 'shell-mode', 'router-mode']);
    for (const a of options.observedAttributes ?? []) {observed.add(a);}
    registry.set(tagName, { options, observed });
  }

  if (customElements.get(tagName)) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iota:applet-host-update', { detail: { tagName } }));
    }
    return;
  }

  function getEntry(): RegistryEntry {
    const entry = getRegistry().get(tagName);
    if (!entry) {throw new Error(`[${tagName}] applet host registry entry missing`);}
    return entry;
  }

  class ReactAppletElement extends HTMLElement {
    private reactRoot: Root | null = null;
    private container: HTMLDivElement | null = null;
    private darkModeObserver: MutationObserver | null = null;
    private styleEl: HTMLStyleElement | null = null;
    private updateListener: ((e: Event) => void) | null = null;

    static get observedAttributes(): string[] {
      return Array.from(getEntry().observed);
    }

    private get useShadow(): boolean {
      return getEntry().options.shadow !== false;
    }

    /** The root node that holds the container and styles (shadow root or the element itself). */
    private get styleRoot(): ShadowRoot | this {
      return this.useShadow
        ? (this.shadowRoot ?? this.attachShadow({ mode: 'open' }))
        : this;
    }

    connectedCallback(): void {
      const root = this.styleRoot;

      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'react-root';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.flex = '1';
        this.container.style.minHeight = '0';
        this.container.style.height = '100%';
        this.container.style.width = '100%';
      }

      const existingContainer = root.querySelector('#react-root');
      if (!existingContainer) {
        if (this.useShadow && this.styleEl) {root.appendChild(this.styleEl);}
        root.appendChild(this.container);
      } else if (existingContainer !== this.container) {
        this.container = existingContainer as HTMLDivElement;
      }

      this.syncFromRegistry();

      this.updateListener ??= (e: Event) => {
        if (!(e instanceof CustomEvent)) {return;}
        const detail = (e as CustomEvent<{ tagName?: string }>).detail;
        if (!detail || detail.tagName !== tagName) {return;}
        this.syncFromRegistry();
        this.renderReact();
      };
      window.addEventListener('iota:applet-host-update', this.updateListener as EventListener);

      this.renderReact();
    }

    disconnectedCallback(): void {
      if (this.updateListener) {
        window.removeEventListener('iota:applet-host-update', this.updateListener as EventListener);
      }

      this.darkModeObserver?.disconnect();
      this.darkModeObserver = null;

      this.reactRoot?.unmount();
      this.reactRoot = null;

      // Clean up document.head style when not using shadow DOM
      if (!this.useShadow && this.styleEl) {
        this.styleEl.remove();
        this.styleEl = null;
      }
    }

    attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
      if (oldValue === newValue) {return;}
      if (this.container) {this.renderReact();}
    }

    private getHostConfig(): AppletHostConfig {
      const attrs: Record<string, string> = {};
      for (const { name, value } of Array.from(this.attributes)) {
        attrs[name] = value;
      }

      const basePath = this.getAttribute('base-path') ?? '';
      const shellMode = (this.getAttribute('shell-mode') as ShellMode | null) ?? undefined;
      const routerMode = (this.getAttribute('router-mode') as RouterMode | null) ?? 'url';

      return { basePath, shellMode, routerMode, attrs };
    }

    private renderReact(): void {
      if (!this.container) {return;}

      if (!this.reactRoot) {
        this.reactRoot = createRoot(this.container);
      }

      try {
        this.reactRoot.render(getEntry().options.render(this.getHostConfig()));
      } catch (err) {
        console.error(`[${tagName}] failed to mount React app:`, err);
      }
    }

    private syncFromRegistry(): void {
      const entry = getEntry();

      const styles = typeof entry.options.styles === 'function' ? entry.options.styles() : entry.options.styles;
      if (styles) {
        this.styleEl ??= document.createElement('style');
        this.styleEl.textContent = styles;

        if (this.useShadow) {
          // Shadow mode: inject <style> into shadow root
          if (this.shadowRoot && !this.shadowRoot.contains(this.styleEl)) {
            this.shadowRoot.insertBefore(this.styleEl, this.shadowRoot.firstChild);
          }
        } else {
          // Light mode: inject <style> into document.head
          this.styleEl.id = `${tagName}-styles`;
          if (!document.head.contains(this.styleEl)) {
            document.head.appendChild(this.styleEl);
          }
        }
      } else if (this.styleEl) {
        this.styleEl.remove();
        this.styleEl = null;
      }

      if (entry.options.observeDarkMode !== false) {
        this.darkModeObserver ??= this.syncDarkMode();
      } else if (this.darkModeObserver) {
        this.darkModeObserver.disconnect();
        this.darkModeObserver = null;
      }
    }

    private syncDarkMode(): MutationObserver {
      const root = this.container;
      if (!root) {throw new Error('react root container not found');}

      const apply = () => {
        if (document.documentElement.classList.contains('dark')) {root.classList.add('dark');}
        else {root.classList.remove('dark');}
      };

      apply();

      const observer = new MutationObserver(apply);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return observer;
    }
  }

  customElements.define(tagName, ReactAppletElement);
}

function getRegistry(): Map<string, RegistryEntry> {
  const g = globalThis as Record<string, unknown>;
  g.__IOTA_REACT_APPLET_HOST_REGISTRY__ ??= new Map<string, RegistryEntry>();
  return g.__IOTA_REACT_APPLET_HOST_REGISTRY__ as Map<string, RegistryEntry>;
}
