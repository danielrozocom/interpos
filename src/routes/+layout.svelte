<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  let menuOpen = false;
  // UX config: set to true if header should be white (chosen by UX/UI)
  export let topbarLight = false;
  import { page } from '$app/stores';

  // Close the slide menu on mobile when a nav link is clicked
  function handleNavClick() {
    try {
      // If viewport is small, close the menu
      if (typeof window !== 'undefined') {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (isMobile) menuOpen = false;
      }
    } catch (e) {
      // ignore
    }
  }

  // Global Ctrl-based shortcuts dispatcher
  function globalKeyHandler(e: KeyboardEvent) {
    if (typeof window === 'undefined') return;
    if (!(e.ctrlKey || (navigator.platform && /Mac/.test(navigator.platform) && e.metaKey))) return;

    const active = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
    const tag = active?.tagName?.toLowerCase();
    const isInputLike = tag === 'input' || tag === 'textarea' || active?.isContentEditable;

    // Don't interfere with common edit shortcuts inside inputs (Ctrl+A/C/V/X/Z/Y)
    // But allow some global actions to work while typing: Enter (submit), K (open scanner), L (focus id), Backspace (clear id)
    const keyLower = e.key.toLowerCase();
    const editShortcuts = ['a', 'c', 'v', 'x', 'z', 'y'];
    const allowedWhileInput = ['enter', 'k', 'l', 'backspace'];
    if (isInputLike && !editShortcuts.includes(keyLower) && !allowedWhileInput.includes(keyLower === 'enter' ? 'enter' : keyLower)) {
      return;
    }

    // Map keys to high-level actions and broadcast them so pages can react
    if (e.key === 'Enter') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'submit' } }));
      return;
    }
    if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'openScanner' } }));
      return;
    }
    if (e.key.toLowerCase() === 'l') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'focusId' } }));
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'clearId' } }));
      return;
    }

    // Ctrl+A behavior for InterPOS: if focus is not in an input-like element,
    // focus and select the user id input (#userId). This allows quick selection
    // of the id field without interfering with normal text-edit shortcuts.
    if (keyLower === 'a') {
      // If the active element is an input-like (text/textarea/contenteditable), allow normal Ctrl+A
      if (isInputLike) return;

      // Try to find the primary user id input by id, then by a few sensible fallbacks
      const target = document.getElementById('userId') as HTMLInputElement | null
                   || document.querySelector('input[name="userId"]') as HTMLInputElement | null
                   || document.querySelector('input[type="text"]') as HTMLInputElement | null;
      if (target) {
        e.preventDefault();
        try {
          try { target.focus({ preventScroll: true }); } catch(e) { target.focus(); }
          target.select();
        } catch (err) {
          // as a fallback, attempt document.execCommand (older browsers)
          try { document.execCommand && document.execCommand('selectAll'); } catch (e) { /* ignore */ }
        }
      }
      return;
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') window.addEventListener('keydown', globalKeyHandler);
  });
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', globalKeyHandler);
  });
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Persistent top bar -->
  <header class="topbar" class:light={topbarLight}>
    <div class="topbar-inner">
      <!-- Hamburger in header -->
      <button class="collapse-btn topbar-hamburger" aria-label="Alternar barra lateral" on:click={() => menuOpen = !menuOpen}>
        <!-- Always show the native hamburger (three lines) icon; remove the separate '-' icon -->
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    <a href="/" class="topbar-brand" aria-label="Ir a inicio">InterPOS</a>
    <!-- Auth temporarily disabled - will use different solution later -->
    <!-- {#if $page.data.session?.user}
      <div style="margin-left:auto; display:flex; align-items:center; gap:0.5rem;">
        <div class="text-sm">{ $page.data.session.user.name || $page.data.session.user.email }</div>
        <button on:click={async () => {
          await fetch('/auth/signout', { method: 'POST', credentials: 'same-origin' });
          location.reload();
        }} class="px-2 py-1 bg-white text-sm text-gray-800 rounded">Salir</button>
      </div>
    {/if} -->
    </div>
  </header>
  <div class="flex">
  <!-- Sidebar -->
  <aside class="sidebar" class:collapsed={menuOpen === false} data-open={menuOpen} aria-label="Navegación principal">
      <div class="sidebar-top">
        <!-- Show large logo above menu only when sidebar is open -->
        {#if menuOpen}
          <div class="brand" aria-hidden="true">
            <img src="/favicon.svg" alt="InterPOS" class="brand-icon large" />
          </div>
        {/if}
      </div>
      <nav class="sidebar-nav" aria-label="Menú principal">
  <a href="/" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> <span class="link-text">Inicio</span></a>
  <a href="/sell" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/sell' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> <span class="link-text">Vender</span></a>
  <a href="/products" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/products' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> <span class="link-text">Productos</span></a>
  <a href="/customers" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/customers' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> <span class="link-text">Clientes</span></a>
  <a href="/recharge" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/recharge' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h6v2h4v-4.5c2-1.5 2-2.7 2-4.5 0-5.3-7.5-6.5-11-5 0.3-1.7 1.3-3 3-3 1.6 0 2.8 1.2 3 3 .2 1.8-1 3-2.5 3-1.5 0-2.7-1.2-2.5-3 .2-1.8 1-3 2.5-3z"/><circle cx="7" cy="12" r="1"/><circle cx="17" cy="12" r="1"/><circle cx="12" cy="9" r="1"/></svg> <span class="link-text">Recargar</span></a>
  <a href="/history" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/history' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg> <span class="link-text">Historial</span></a>
  <a href="/check-balance" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/check-balance' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> <span class="link-text">Consultar saldo</span></a>
  <a href="/reports" on:click={handleNavClick} class="nav-link { $page.url.pathname === '/reports' ? 'active' : '' }"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><rect x="2" y="2" width="20" height="20" rx="2"/></svg> <span class="link-text">Reportes</span></a>
      </nav>
    </aside>

    <!-- Main content area -->
    <main class="main-content flex-1 px-4 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</div>
<style>
  /* Topbar */
  .topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #35528C; box-shadow: 0 6px 18px rgba(22,50,90,0.18); height:var(--topbar-h); color: #ffffff; }
  .topbar-inner { max-width: 1120px; margin: 0 auto; padding: 0 1rem; display:flex; align-items:center; height:var(--topbar-h); gap:0.5rem; }
  .topbar-brand { font-weight:800; color:#ffffff; text-decoration:none; font-size:1.25rem; flex:1; text-align:center; }
  /* legacy topbar favicon removed; kept in markup historically (no styles needed) */
  /* Topbar-specific hamburger positioned relative to header so it aligns with sidebar emojis */
  header.topbar .topbar-hamburger { position:absolute; left: calc(0.5rem + 0.75rem); top:50%; transform:translateY(-50%); color:#ffffff; z-index:10; }
  /* Light/topbar variant chosen by UX */
  .topbar.light { background: #ffffff; box-shadow: 0 1px 0 rgba(16,24,40,0.06); }
  .topbar.light .topbar-brand { color: #0f1724; }

  /* Sidebar */
  .sidebar { background: #35528C; color: #fff; width: 220px; display:flex; flex-direction:column; transition: width .22s ease, transform .22s ease; padding-top:0; position:fixed; left:0; top:var(--topbar-h); bottom:0; z-index:70; }
  .sidebar.collapsed { width: 72px; }
  .sidebar-top { display:flex; flex-direction:column; align-items:center; gap:0.25rem; padding-top:6px; padding-bottom:6px; position:relative; }
  /* Default collapse-btn styling (for any remaining uses inside sidebar) */
  .collapse-btn { background:transparent; border:none; color:#fff; padding:0.35rem; cursor:pointer; width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center; border-radius: var(--radius-md); }
  /* brand-title removed from current markup */
  /* Large brand icon shown only when sidebar is open — in normal flow above menu */
  .brand-icon { display:none; }
  .brand-icon.large { width:80px; height:80px; object-fit:contain; border-radius: var(--radius-sm); display:block; margin:12px auto; box-shadow:none; border:none; }
  .sidebar.collapsed .brand-icon.large { display:none; }
  .sidebar-nav { display:flex; flex-direction:column; gap:0.1rem; padding:0.5rem 0.5rem; padding-top:4px; }
  .nav-link { display:flex; align-items:center; gap:0.75rem; padding:0.65rem 0.75rem; color:rgba(255,255,255,0.95); text-decoration:none; border-radius: var(--radius-md); }
  .nav-link.active, .nav-link:hover { background: rgba(255,255,255,0.06); }
  /* Make SVG icons block-level and normalize their box so centering is consistent */
  .nav-link svg { display:block; width:24px; height:24px; flex:0 0 24px; margin:0; }
  /* Also normalize any anchor inside the sidebar in case some links don't use .nav-link */
  .sidebar a { display:flex; align-items:center; gap:0.75rem; color:inherit; text-decoration:none; }
  .sidebar a svg { display:block; width:24px; height:24px; flex:0 0 24px; margin:0; }
  /* When the sidebar is collapsed hide the text and center the icon horizontally */
  .sidebar.collapsed .nav-link { justify-content: center; padding-left: 0.5rem; padding-right: 0.5rem; }
  /* Ensure the SVG sits centered inside its flex cell when collapsed */
  .sidebar.collapsed .nav-link svg { margin-left:auto; margin-right:auto; }
  .link-text { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sidebar.collapsed .link-text { display:none; }
  /* sidebar-footer removed from current markup */
  /* With a fixed header we must reserve its height so content doesn't slide under it.
     Use calc(var(--topbar-h) + var(--topbar-gap)) so the existing gap is preserved. */
  .main-content { background: #f8fafc; min-height: calc(100vh - var(--topbar-h)); margin-top: 0; margin-left:220px; transition: margin-left .22s ease; padding-top: calc(var(--topbar-h) + var(--topbar-gap)); }
  .sidebar.collapsed ~ .main-content { margin-left:72px; }

  /* Add bottom padding so content/footer area isn't flush to the viewport bottom */
  :root { --site-footer-gap: 3rem; }
  .main-content { padding-bottom: var(--site-footer-gap); }

  /* Responsive: transform sidebar to top drawer on small screens */
  @media (max-width: 767px) {
    .sidebar { position:fixed; left:0; top:var(--topbar-h); bottom:0; width:220px; z-index:90; }
    /* When closed, move sidebar fully off-screen with transform (no layout shift) */
    .sidebar.collapsed { transform: translateX(-100%); }
    .sidebar[data-open="true"] { transform: translateX(0); }
    /* Ensure main content never shifts on mobile (override earlier sibling selector) */
    .main-content { margin-left:0; }
  /* keep a slightly smaller footer gap on mobile to preserve space without wasting view height */
  .main-content { padding-bottom: 2rem; }
    .sidebar.collapsed ~ .main-content { margin-left:0 !important; }
  /* Mobile: center brand text and keep hamburger on the left without overlap */
  .topbar-inner { padding-left: 0; padding-right: 0; }
  /* Keep the brand in normal flow and center it; padding prevents overlap with the hamburger */
  .topbar-brand { flex:1; text-align:center; margin-left:0; }
  }
</style>
