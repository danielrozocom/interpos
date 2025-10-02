<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  let menuOpen = false;
  let showUserDropdown = false;
  // start closed by default per request
  let productsOpen = false;
  // UX config: set to true if header should be white (chosen by UX/UI)
  export let topbarLight = false;
  import { page } from '$app/stores';
  // Client-side fallback user when SSR didn't populate page.data.user
  let clientUser: any = null;
  $: displayUser = $page.data.user ?? clientUser;

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

  let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;
  
  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', globalKeyHandler);
      
      // Close user dropdown when clicking outside
      clickOutsideHandler = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (showUserDropdown && !target.closest('.user-menu')) {
          showUserDropdown = false;
        }
      };
      
      document.addEventListener('click', clickOutsideHandler);
      // If SSR didn't supply a user, try fetching it from the server via cookies
      (async () => {
        try {
          if (!$page.data.user) {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
              const json = await res.json();
              if (json?.user) clientUser = json.user;
            }
          }
        } catch (e) {
          // ignore
        }
      })();
    }
    
    // Note: We don't subscribe to onAuthStateChange because auth is fully server-side
    // via HttpOnly cookies. The server will handle redirects on each request.
  });
  
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', globalKeyHandler);
      if (clickOutsideHandler) {
        document.removeEventListener('click', clickOutsideHandler);
      }
    }
  });
</script>

<!-- Use the same soft app background as login for a uniform look -->
<div class="min-h-screen" style="background:#f8fafc;">
  <!-- Persistent top bar (hidden on /login) -->
  {#if String($page.url.pathname) !== '/login'}
    <header class="topbar" class:light={topbarLight} class:sidebar-open={menuOpen}>
      <div class="topbar-inner">
        <!-- Hamburger in header (hidden on check-balance) -->
        {#if String($page.url.pathname) !== '/check-balance'}
          <button class="collapse-btn topbar-hamburger" aria-label="Alternar barra lateral" on:click={() => menuOpen = !menuOpen}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        {/if}
        <!-- Always show brand/title in the topbar (including check-balance) -->
        {#if String($page.url.pathname) === '/check-balance'}
          <span class="topbar-brand">InterPOS</span>
        {:else}
          <a href="/" class="topbar-brand" aria-label="Ir a inicio">InterPOS</a>
        {/if}
        {#if displayUser && String($page.url.pathname) !== '/check-balance'}
          <div class="user-menu">
            <button 
              class="user-menu-btn"
              on:click={() => showUserDropdown = !showUserDropdown}
              aria-expanded={showUserDropdown}
              aria-haspopup="menu"
            >
              {#if displayUser.user_metadata?.avatar_url}
                <img src="{displayUser.user_metadata.avatar_url}" alt="Avatar" class="user-avatar" />
              {:else}
                <div class="user-avatar-placeholder">
                  {(displayUser.user_metadata?.full_name || displayUser.name || displayUser.email)?.charAt(0) || '?'}
                </div>
              {/if}
              <span class="user-name text-sm">{ displayUser.user_metadata?.full_name || displayUser.name || displayUser.email }</span>
              <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </button>
            
            {#if showUserDropdown}
              <!-- Dropdown menu -->
              <div class="user-dropdown" role="menu">
                <button 
                  class="dropdown-item logout-btn"
                  on:click={async () => {
                    showUserDropdown = false;
                    try {
                      const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      });
                      if (response.ok) {
                        window.location.replace('/login');
                      }
                    } catch (error) {
                      console.error('Error logging out:', error);
                      // Fallback: redirect anyway
                      window.location.replace('/login');
                    }
                  }}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            {/if}
          </div>
        {:else}
          {#if String($page.url.pathname) !== '/check-balance'}
            <!-- Not signed in: show login button at the right -->
            <div class="right-login">
              <a href="/login" class="btn-login" aria-label="Iniciar sesión">Iniciar sesión</a>
            </div>
          {/if}
        {/if}
      </div>
    </header>
  {/if}
  <div class="flex">
  <!-- Sidebar (hidden on /login and on /check-balance which uses header-only UI) -->
  {#if String($page.url.pathname) !== '/login' && String($page.url.pathname) !== '/check-balance'}
    <aside class="sidebar" class:collapsed={menuOpen === false} data-open={menuOpen} aria-label="Navegación principal">
      <div class="sidebar-top">
        {#if menuOpen}
          <div class="brand" aria-hidden="true">
            <img src="/favicon.svg" alt="InterPOS" class="brand-icon large" />
          </div>
        {/if}
      </div>
      <nav class="sidebar-nav" aria-label="Menú principal">
        <a href="/" class="nav-link" class:active={$page.url.pathname === '/'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          <span class="link-text">Inicio</span>
        </a>
        
        <a href="/sell" class="nav-link" class:active={$page.url.pathname === '/sell'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="m1 1 4 4h15l-1 8H6"/>
          </svg>
          <span class="link-text">Vender</span>
        </a>
        
        <div class="nav-group">
          <div class="nav-group-header">
            <a href="/products" class="nav-link" class:active={$page.url.pathname === '/products'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span class="link-text">Productos</span>
            </a>
            <button 
              class="chev-toggle" 
              aria-expanded={productsOpen} 
              aria-label="Alternar submenú de productos"
              on:click={() => productsOpen = !productsOpen}
            >
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
          <div class="nav-sub" aria-hidden={!productsOpen}>
            <a href="/taxes" class="nav-sub-link" class:active={$page.url.pathname === '/taxes'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="19" y1="5" x2="5" y2="5"/>
                <line x1="19" y1="9" x2="5" y2="9"/>
                <line x1="19" y1="13" x2="5" y2="13"/>
                <line x1="19" y1="17" x2="5" y2="17"/>
                <line x1="7" y1="5" x2="7" y2="5"/>
                <line x1="7" y1="9" x2="7" y2="9"/>
                <line x1="7" y1="13" x2="7" y2="13"/>
                <line x1="7" y1="17" x2="7" y2="17"/>
                <line x1="17" y1="5" x2="17" y2="5"/>
                <line x1="17" y1="9" x2="17" y2="9"/>
                <line x1="17" y1="13" x2="17" y2="13"/>
                <line x1="17" y1="17" x2="17" y2="17"/>
              </svg>
              <span>Impuestos</span>
            </a>
          </div>
        </div>
        
        <a href="/customers" class="nav-link" class:active={$page.url.pathname === '/customers'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="link-text">Clientes</span>
        </a>
        
        <a href="/recharge" class="nav-link" class:active={$page.url.pathname === '/recharge'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <span class="link-text">Recargar</span>
        </a>
        
        <a href="/history" class="nav-link" class:active={$page.url.pathname === '/history'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <span class="link-text">Historial</span>
        </a>
        
  <a href="/check-balance" class="nav-link" class:active={String($page.url.pathname) === '/check-balance'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          <span class="link-text">Consultar saldo</span>
        </a>
        
        <a href="/reports" class="nav-link" class:active={$page.url.pathname === '/reports'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span class="link-text">Reportes</span>
        </a>
        
        {#if $page.data.user}
          <a href="/admin" class="nav-link" class:active={$page.url.pathname.startsWith('/admin')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>
            </svg>
            <span class="link-text">Admin</span>
          </a>
        {/if}
      </nav>
    </aside>
  {/if}

    <!-- Main content area -->
  <main class="main-content flex-1 px-4 sm:px-6 lg:px-8" class:login-full={$page.url.pathname === '/login'} class:check-center={String($page.url.pathname) === '/check-balance'}>
      <slot />
    </main>
  </div>
  
</div>


<style>
  /* Topbar */
  .topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; background: #35528C; box-shadow: 0 6px 18px rgba(22,50,90,0.18); height:var(--topbar-h); color: #ffffff; }
  .topbar-inner { position:relative; max-width: 1120px; margin: 0 auto; padding: 0 1rem; display:flex; align-items:center; height:var(--topbar-h); gap:0.5rem; }
  /* center the brand absolutely so it's always visually centered regardless of left/right content */
  .topbar-brand { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-weight:800; color:#ffffff; text-decoration:none; font-size:1.25rem; pointer-events:auto; }
  /* legacy topbar favicon removed; kept in markup historically (no styles needed) */
  /* Topbar-specific hamburger positioned to align with sidebar nav icons horizontally */
  /* We'll compute its horizontal center from --sidebar-width so it lines up whether the sidebar is open or collapsed */
  /* Hamburger positioning: align horizontally with sidebar icons when sidebar is open/collapsed */
  /* nudge hamburger further left so it visually lines up with the sidebar icons */
  /* simplified hamburger placement: left aligned inside header and vertically centered */
    /* Align hamburger with the visual center of the sidebar icons
      - when sidebar is open icons sit near 24px from the left (padding + icon center)
      - when collapsed the icon column center is ~36px (half of 72px) */
    header.topbar.sidebar-open .topbar-hamburger { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#ffffff; z-index:10; }
    header.topbar:not(.sidebar-open) .topbar-hamburger { position:absolute; left:6px; top:50%; transform:translateY(-50%); color:#ffffff; z-index:10; }
  /* Light/topbar variant chosen by UX */
  .topbar.light { background: #ffffff; box-shadow: 0 1px 0 rgba(16,24,40,0.06); }
  .topbar.light .topbar-brand { color: #0f1724; }

  /* Sidebar (expose --sidebar-width for header to reference) */
  .sidebar { --sidebar-width: 220px; background: #35528C; color: #fff; width: var(--sidebar-width); display:flex; flex-direction:column; transition: width .22s ease, transform .22s ease; padding-top:0; position:fixed; left:0; top:var(--topbar-h); bottom:0; z-index:70; }
  .sidebar.collapsed { --sidebar-width: 72px; width: var(--sidebar-width); }
  .sidebar-top { display:flex; flex-direction:column; align-items:center; gap:0.25rem; padding-top:6px; padding-bottom:6px; position:relative; }
  /* Default collapse-btn styling (for any remaining uses inside sidebar) */
  .collapse-btn { background: transparent; border: none; color: #fff; padding: .35rem; cursor: pointer; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md); }
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
  /* When collapsed, ensure group header (link + chevron) centers icons too */
  .sidebar.collapsed .nav-group-header { justify-content: center; }
  .sidebar.collapsed .nav-group-header .nav-link { justify-content: center; padding-left: 0.25rem; padding-right: 0.25rem; }
  .sidebar.collapsed .chev-toggle { width:44px; height:44px; display:inline-flex; align-items:center; justify-content:center; padding:0.25rem; }
  .sidebar.collapsed .chev-toggle .chev { margin:0; }
  .link-text { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sidebar.collapsed .link-text { display:none; }
  /* sidebar-footer removed from current markup */
  /* With a fixed header we must reserve its height so content doesn't slide under it.
     Use calc(var(--topbar-h) + var(--topbar-gap)) so the existing gap is preserved. */
  .main-content { background: #f8fafc; min-height: calc(100vh - var(--topbar-h)); margin-top: 0; margin-left:220px; transition: margin-left .22s ease; padding-top: calc(var(--topbar-h) + var(--topbar-gap)); }
  .sidebar.collapsed ~ .main-content { margin-left:72px; }
  /* When showing the dedicated login page we want the main content to be full-bleed */
  .main-content.login-full { margin-left: 0 !important; padding-top: 0 !important; min-height: 100vh !important; display:flex; align-items:center; justify-content:center; }

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
  /* On mobile keep the hamburger within the header center for smaller viewports */
  header.topbar .topbar-hamburger { top:50%; transform:translateY(-50%); }
  /* Keep the brand in normal flow and center it; padding prevents overlap with the hamburger */
  .topbar-brand { flex:1; text-align:center; margin-left:0; }
  }
  /* Center the main content on check-balance (no left sidebar space) */
  .main-content.check-center {
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    display: block;
    width: 100%;
    min-height: calc(100vh - var(--topbar-h));
  }
  
  /* child width adjustments removed (not needed) */
  /* Subnavigation items under main links */
  .nav-sub { display:flex; flex-direction:column; padding-left:1.75rem; margin-top:0.15rem; }
  .nav-sub-link { display:flex; align-items:center; gap:0.5rem; padding:0.35rem 0.75rem; color: rgba(255,255,255,0.9); text-decoration:none; border-radius: var(--radius-sm); }
  .nav-sub-link svg { width:16px; height:16px; flex:0 0 16px; }
  /* when sidebar is collapsed hide subitems and prevent layout shifts */
  .sidebar.collapsed .nav-sub { display:none; }
  /* Slight visual offset to emphasize hierarchy */
  .nav-sub { transform: translateX(6px); }
  /* Nav group styles */
  .nav-group { display:flex; flex-direction:column; }
  .nav-group-header { display:flex; align-items:center; justify-content:space-between; width:100%; }
  .nav-group-header .nav-link { flex:1; justify-content:flex-start; }
  /* Chevron toggle for nav groups (use .chev-toggle on the button) */
  .chev-toggle { background:transparent; border:none; color:inherit; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0.25rem; width:40px; height:40px; border-radius: var(--radius-md); }
  /* Keep the chevron visually consistent with other icons and centered by default */
  .chev { transition: transform .18s ease, opacity .12s ease; opacity:1; transform: rotate(0deg); display:block; width:18px; height:18px; }
  /* Rotate 90deg when expanded so -> becomes v (right to down) */
  .chev-toggle[aria-expanded="true"] .chev { transform: rotate(90deg); }
  /* Animated collapse/expand for subitems: use max-height transition and opacity */
  .nav-sub { overflow:hidden; transition: max-height .22s ease, opacity .18s ease, transform .18s ease; max-height: 0; opacity: 0; }
  .nav-sub[aria-hidden="false"] { max-height: 400px; opacity: 1; }
  .nav-sub .nav-sub-link { padding-left: 0.5rem; }

  /* Ensure chevron alignment when sidebar is collapsed: center header and keep chevron inline with icons */
  /* When sidebar is collapsed, hide the chevron toggle so only the main icon is visible and centered */
  .sidebar.collapsed .nav-group-header { justify-content: center; }
  .sidebar.collapsed .chev-toggle { display: none; }
  .sidebar.collapsed .chev { margin:0; }
  /* User menu dropdown */
  .user-menu { position: relative; }
  .user-menu-btn { 
    display: flex; 
    align-items: center; 
    gap: 0.5rem; 
    background: transparent; 
    border: none; 
    color: #fff; 
    cursor: pointer; 
    padding: 0.5rem; 
    border-radius: 6px;
    transition: background-color 0.2s;
  }
  .user-menu-btn:hover { background: rgba(255,255,255,0.1); }
  .user-avatar { width: 32px; height: 32px; border-radius: 9999px; object-fit: cover; }
  .user-avatar-placeholder { 
    width: 32px; 
    height: 32px; 
    border-radius: 9999px; 
    background: rgba(255,255,255,0.2); 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-weight: 600; 
    font-size: 14px; 
    color: #fff; 
  }
  .user-name { color: #fff; font-weight: 500; }
  .dropdown-arrow { transition: transform 0.2s; }
  .user-menu-btn[aria-expanded="true"] .dropdown-arrow { transform: rotate(180deg); }
  
  .user-dropdown { 
    position: absolute; 
    top: 100%; 
    right: 0; 
    background: #fff; 
    border: 1px solid #e5e7eb; 
    border-radius: 8px; 
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); 
    min-width: 160px; 
    z-index: 1000; 
    margin-top: 0.5rem; 
  }
  /* place user menu at the far right of the topbar */
  .topbar .user-menu { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); }
  /* login button uses same right alignment */
  .topbar .right-login { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); }
  .topbar .right-login .btn-login { color:#fff; text-decoration:none; font-weight:600; padding:0.5rem 0.75rem; border-radius:6px; background:rgba(255,255,255,0.05); }
  .dropdown-item { 
    display: flex; 
    align-items: center; 
    gap: 0.5rem; 
    width: 100%; 
    padding: 0.75rem 1rem; 
    background: none; 
    border: none; 
    text-align: left; 
    cursor: pointer; 
    color: #374151; 
    font-size: 14px; 
    transition: background-color 0.2s; 
  }
  .dropdown-item:hover { background: #f9fafb; }
  .dropdown-item svg { width: 16px; height: 16px; }
  /* Removed debug pre styles (no longer used) */
</style>
