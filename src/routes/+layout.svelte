<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  let menuOpen = false;
  let showUserDropdown = false;
  // start closed by default per request
  let productsOpen = false;
  let sellOpen = false;
  // UX config: set to true if header should be white (chosen by UX/UI)
  export let topbarLight = false;
  import { page } from '$app/stores';
  // Client-side fallback user when SSR didn't populate page.data.user
  // `clientUser === undefined` means "still checking"; `null` means checked and no user
  let clientUser: any = undefined;
  let authChecked = false; // true when we've attempted to resolve client-side auth
  let loggingOut = false;

  $: displayUser = $page.data.user ?? clientUser;
  $: showLoginButton = authChecked && clientUser === null && $page.data.user === null;

  // Re-check auth when page changes (useful after login redirect)
  $: if ($page.url.pathname && typeof window !== 'undefined' && authChecked) {
    checkAuthState();
  }

  // Function to check authentication state
  async function checkAuthState() {
    try {
      console.log('[CLIENT] Re-checking auth state for page:', $page.url.pathname);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        const newUser = json?.user || null;
        if (newUser !== clientUser) {
          console.log('[CLIENT] Auth state changed:', !!newUser, newUser?.email);
          clientUser = newUser;
        }
      } else if (clientUser !== null) {
        console.log('[CLIENT] Auth check failed, clearing user');
        clientUser = null;
      }
    } catch (e) {
      console.log('[CLIENT] Auth check error:', String(e));
      if (clientUser !== null) {
        clientUser = null;
      }
    }
  }

  // Close the slide menu on mobile when a nav link is clicked
  function handleNavClick() {
    try {
      // Only close sidebar if click is on a link (not chevron button)
      if (typeof window !== 'undefined') {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        // Use event from Svelte's on:click handler
        // Svelte passes the event as the first argument
        // We need to get the event from arguments
        const event = arguments[0];
        if (isMobile && event) {
          // Check if the click target is an <a> inside .sidebar-nav
          let el = event.target;
          // Traverse up to find an <a>
          while (el && el !== event.currentTarget) {
            if (el.tagName === 'A') {
              menuOpen = false;
              break;
            }
            el = el.parentElement;
          }
        }
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
      // Check auth state - try SSR first, then client fetch
      (async () => {
        try {
          if ($page.data.user) {
            // SSR already provided the user
            clientUser = $page.data.user;
            authChecked = true;
            console.log('[CLIENT] Using SSR user:', $page.data.user.email);
            return;
          }

          console.log('[CLIENT] No SSR user, fetching from /api/auth/me');
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const json = await res.json();
            clientUser = json?.user || null;
            console.log('[CLIENT] Client fetch result:', !!clientUser, clientUser?.email);
          } else {
            clientUser = null;
            console.log('[CLIENT] Fetch failed:', res.status);
          }
        } catch (e) {
          console.log('[CLIENT] Fetch error:', String(e));
          clientUser = null;
        } finally {
          authChecked = true;
          // Redirect to login if no user and not on login/auth pages
          if (clientUser === null && $page.data.user === null &&
              String($page.url.pathname) !== '/login' &&
              String($page.url.pathname) !== '/auth/callback' &&
              String($page.url.pathname) !== '/auth/implicit-callback' &&
              String($page.url.pathname) !== '/check-balance') {
            console.log('[CLIENT] No authenticated user, redirecting to login');
            window.location.href = '/login';
          }
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
      <!-- Hamburger in header (hidden on check-balance) placed as direct child so header padding doesn't offset it -->
      {#if String($page.url.pathname) !== '/check-balance'}
        <button class="collapse-btn topbar-hamburger" aria-label="Alternar barra lateral" on:click={() => menuOpen = !menuOpen}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      {/if}
      <div class="topbar-inner">
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
            </button>
            
            {#if showUserDropdown}
                <!-- Dropdown menu -->
                <div class="user-dropdown" role="menu">
                  <div class="dropdown-header">
                    <div class="dropdown-identity">
                      {#if displayUser.user_metadata?.avatar_url}
                        <img src="{displayUser.user_metadata.avatar_url}" alt="Avatar" class="user-avatar dropdown-avatar" />
                      {:else}
                        <div class="user-avatar-placeholder dropdown-avatar">{(displayUser.user_metadata?.full_name || displayUser.name || displayUser.email)?.charAt(0) || '?'}</div>
                      {/if}
                      <div class="dropdown-identity-text">
                        <span class="dropdown-user-name">{ displayUser.user_metadata?.full_name || displayUser.name || displayUser.email }</span>
                        <span class="dropdown-user-email">{ displayUser.email }</span>
                      </div>
                    </div>
                  </div>
                  <hr class="dropdown-divider">
                  <div class="dropdown-actions">
                    <button 
                      class="dropdown-item logout-btn"
                      disabled={loggingOut}
                      on:click={async () => {
                        loggingOut = true;
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
                      {loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
                    </button>
                  </div>
                </div>
            {/if}
          </div>
        {:else}
          {#if !authChecked || (authChecked && displayUser)}
            <!-- Auth is initializing or we have a user: reserve space to avoid flash/shift -->
            <div style="width:120px; height:40px;" aria-hidden="true"></div>
          {/if}
          <!-- Login button removed - automatic redirect to /login when not authenticated -->
        {/if}
        <!-- Always show brand/title in the topbar -->
        {#if String($page.url.pathname) === '/check-balance'}
          <span class="topbar-brand">InterPOS</span>
        {:else}
          <a href="/" class="topbar-brand" aria-label="Ir a inicio">InterPOS</a>
        {/if}
      </div>
    </header>
  {/if}
  <div class="flex">
  <!-- Sidebar (hidden on /login and /check-balance) -->
  {#if String($page.url.pathname) !== '/login' && String($page.url.pathname) !== '/check-balance'}
    <aside class="sidebar" class:collapsed={menuOpen === false} data-open={menuOpen} aria-label="Navegación principal">
      <div class="sidebar-top">
        {#if menuOpen}
          <div class="brand" aria-hidden="true">
            <img src="/favicon.svg" alt="InterPOS" class="brand-icon large" />
          </div>
        {/if}
      </div>
  <nav class="sidebar-nav" aria-label="Menú principal" on:click={handleNavClick}>
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
                <polyline points="9,6 15,12 9,18"/>
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
  <main class="main-content flex-1 px-4 sm:px-6 lg:px-8" class:login-full={$page.url.pathname === '/login'} class:centered={$page.url.pathname === '/check-balance'}>
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

  /* Title stays centered horizontally so it visually matches the design. */
  .topbar-brand { left:50%; transform:translate(-50%,-50%); }
  /* legacy topbar favicon removed; kept in markup historically (no styles needed) */
  /* Topbar-specific hamburger positioned to align with sidebar nav icons horizontally */
  /* We'll compute its horizontal center from --sidebar-width so it lines up whether the sidebar is open or collapsed */
  /* Hamburger positioning: align horizontally with sidebar icons when sidebar is open/collapsed */
  /* nudge hamburger further left so it visually lines up with the sidebar icons */
  /* simplified hamburger placement: left aligned inside header and vertically centered */
    /* Align hamburger with the visual center of the sidebar icons
      - when sidebar is open icons sit near 24px from the left (padding + icon center)
      - when collapsed the icon column center is ~36px (half of 72px) */
  /* Align hamburger with actual icon center: 0.5rem (sidebar padding) + 0.75rem (link padding) + 12px(icon half) ≈ 32px */
  /* Align hamburger horizontally with the sidebar icon column. Use calculation instead of magic numbers. */
  /* When sidebar is open: left = sidebar padding (0.5rem ~ 8px) + link left padding (0.75rem ~ 12px) + icon half (12px) => approx 32px */
  /* Nudge slightly left for tighter visual alignment */
  /* Extra small left nudge for pixel-perfect alignment */
  header.topbar.sidebar-open .topbar-hamburger { position:fixed; left: calc(var(--sidebar-padding) + var(--link-padding) + var(--icon-half) - 6px); top: calc(var(--topbar-h) / 2); transform: translateY(-50%); color:#ffffff; z-index:1100; }
  /* When collapsed: center inside the collapsed width (72px / 2) minus icon half (12px) */
  /* Small left nudge when collapsed as well */
  /* Small left nudge when collapsed as well (extra -2px) */
  header.topbar:not(.sidebar-open) .topbar-hamburger { position:fixed; left: calc(var(--sidebar-collapsed-width) / 2 - var(--icon-half) - 4px); top: calc(var(--topbar-h) / 2); transform: translateY(-50%); color:#ffffff; z-index:1100; }
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
  .sidebar.collapsed .nav-group-header .nav-link { justify-content: center; padding-left: 0.25rem; padding-right: 0.25rem; margin-right: 0; }
  /* When collapsed hide the chevron toggle so grouped links look identical to single links */
  .sidebar.collapsed .chev-toggle { display:none; }
  /* Ensure group header links use the same centering and padding as regular links when collapsed */
  .sidebar.collapsed .nav-group-header .nav-link { justify-content: center; padding-left: 0.5rem; padding-right: 0.5rem; margin-right: 0; }
  .link-text { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sidebar.collapsed .link-text { display:none; }
  /* sidebar-footer removed from current markup */
  /* With a fixed header we must reserve its height so content doesn't slide under it.
     Use calc(var(--topbar-h) + var(--topbar-gap)) so the existing gap is preserved. */
  .main-content { background: #f8fafc; min-height: calc(100vh - var(--topbar-h)); margin-top: 0; margin-left:220px; transition: margin-left .22s ease; padding-top: calc(var(--topbar-h) + var(--topbar-gap)); }
  .sidebar.collapsed ~ .main-content { margin-left:72px; }
  /* When showing the dedicated login page we want the main content to be full-bleed */
  .main-content.login-full { margin-left: 0 !important; padding-top: 0 !important; min-height: 100vh !important; display:flex; align-items:center; justify-content:center; }
  .main-content.centered { margin-left: 0 !important; display:flex; align-items:center; justify-content:center; min-height: calc(100vh - var(--topbar-h)); }

  /* Add bottom padding so content/footer area isn't flush to the viewport bottom */
  :root { --site-footer-gap: 3rem; --sidebar-padding: 8px; --link-padding: 12px; --icon-half: 12px; --sidebar-width: 220px; --sidebar-collapsed-width: 72px; }
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
  /* On mobile make hamburger static in flow but keep predictable left padding (nudge left) */
  .topbar-hamburger { position: static; margin-left:6px; }
  /* Keep the brand in normal flow and center it; padding prevents overlap with the hamburger */
  .topbar-brand { flex:1; text-align:center; margin-left:0; }
  }

  /* Place the user menu fixed at the top-right so it remains aligned even if header padding changes */
  .topbar .user-menu { position: fixed; right: 12px; top: calc(var(--topbar-h) / 2); transform: translateY(-50%); z-index:1200; }
  
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
  .nav-group-header { display:flex; align-items:center; justify-content:flex-start; width:100%; position:relative; }
  /* Let the product link stretch so its active background matches other items. Reserve space
     on the right so the chev-toggle (absolutely positioned) doesn't overlap the text. */
  .nav-group-header .nav-link { flex: 1 1 auto; justify-content:flex-start; margin-right: 2.25rem; }
  /* Chevron toggle for nav groups (use .chev-toggle on the button) */
  /* Make the chevron toggle use the same visual box as the nav icons so it lines up
    across different screens. Use 24x24 to match .nav-link svg and keep minimal padding. */
  .chev-toggle { background:transparent; border:none; color:inherit; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; width:24px; height:24px; flex:0 0 24px; margin-left:0; position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); z-index:5; }
  /* Keep the chevron visually consistent with other icons and centered by default */
  .chev { transition: transform .18s ease, opacity .12s ease; opacity:1; transform: rotate(0deg); display:block; width:24px; height:24px; }
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
    font-weight: 700; 
    font-size: 16px; 
    color: #fff; 
  }
  .user-name { color: #fff; font-weight: 500; }
  .dropdown-arrow { transition: transform 0.2s; }
  .user-menu-btn[aria-expanded="true"] .dropdown-arrow { transform: rotate(180deg); }
  
  .user-dropdown { 
    position: absolute; 
    top: calc(100% + 2px);
    right: 0; 
    background: #fff; 
    border: 1px solid #e5e7eb; 
    border-radius: 8px; 
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); 
    min-width: 320px; 
    max-width: 520px; 
    box-sizing: border-box;
    z-index: 1200; 
    margin-top: 0.5rem; 
    padding-bottom: 0.5rem;
  }
  .dropdown-header {
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid #f3f4f6;
    background: #f9fafb;
  }
  /* Reduce gap so name/email sit closer to avatar */
  .dropdown-identity { display:flex; gap:0.5rem; align-items:center; }
  /* Avatar container: circular, blue background for placeholders and masked images */
  .dropdown-avatar { width:48px; height:48px; border-radius:50%; flex:0 0 48px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#35528C; border:1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 10px rgba(2,6,23,0.03); }
  .dropdown-avatar img { width:100%; height:100%; object-fit:cover; display:block; border-radius:50%; background:transparent; }
  .dropdown-avatar .user-avatar-placeholder { font-weight:800; color:#ffffff; font-size:22px; line-height:1; }
  .dropdown-identity-text { display:flex; flex-direction:column; min-width:0; margin-right: 0.25rem; }
  .dropdown-user-name { font-weight:700; font-size:0.98rem; color:#0f1724; display:block; }
  .dropdown-user-email { font-weight:500; font-size:0.85rem; color:#6b7280; display:block; margin-top:2px; }
  .dropdown-user-name { white-space:normal; word-break:break-word; }
  .dropdown-user-email { white-space:normal; word-break:break-word; }
  .dropdown-user-name {
    display: block;
    font-weight: 600;
    font-size: 0.875rem;
    color: #111827;
    margin-bottom: 0.25rem;
  }
  .dropdown-user-email {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
  }
  .dropdown-divider {
    margin: 0;
    border: 0;
    border-top: 1px solid #f3f4f6;
  }
  /* place user menu at the far right of the topbar (handled by .topbar .user-menu fixed rule above) */
  /* (duplicate absolute rule removed to avoid overriding the fixed positioning) */
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
  .dropdown-actions { display:flex; flex-direction:column; gap:0.5rem; padding:0.5rem 0.75rem; }
  .dropdown-actions .dropdown-item { padding:0.65rem 0.75rem; border-radius:8px; }
  .dropdown-item.logout-btn { background: #fff; }
  /* Removed debug pre styles (no longer used) */
  @keyframes spin { to { transform: rotate(360deg); } }
  /* Keep dropdown visually consistent on mobile: avoid forcing full-width; reduce sizes only on very small screens */
  @media (max-width: 480px) {
    .user-dropdown { left: auto; right: 12px; min-width: 300px; max-width: 540px; width: auto; }
    .dropdown-avatar { width:40px; height:40px; flex:0 0 40px; border-radius:50%; }
    .dropdown-user-name { font-size:0.95rem; }
    .dropdown-user-email { font-size:0.8rem; }
  }
  @media (max-width: 320px) {
    /* For very small screens allow the dropdown to shrink but keep padding */
    .user-dropdown { min-width: 200px; max-width: calc(100vw - 12px); right:6px; }
  }

  /* Desktop adjustments: move dropdown left and increase its width for better readability */
  @media (min-width: 769px) {
    .user-dropdown { left: auto; right: 16px; min-width: 380px; max-width: 620px; }
    .dropdown-avatar { width:56px; height:56px; flex:0 0 56px; border-radius:50%; }
    .dropdown-user-name { font-size:1.05rem; }
    .dropdown-avatar .user-avatar-placeholder { font-size:30px; }
    .dropdown-user-email { font-size:0.9rem; }
  }
</style>
