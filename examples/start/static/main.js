const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const sidebar = document.getElementById('sidebar');

function toggleMobileMenu() {
  sidebar.classList.toggle('-translate-x-full');
  sidebar.classList.toggle('translate-x-0');
  mobileOverlay.classList.toggle('hidden');
  document.body.classList.toggle('overflow-hidden');
}

mobileMenuBtn?.addEventListener('click', toggleMobileMenu);
mobileOverlay?.addEventListener('click', toggleMobileMenu);

sidebar?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth < 768) {
      toggleMobileMenu();
    }
  });
});

const themeToggle = document.getElementById('theme-toggle');
const themeIconLight = document.getElementById('theme-icon-light');
const themeIconDark = document.getElementById('theme-icon-dark');
const html = document.documentElement;

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateIcon(actualTheme) {
  themeIconLight.classList.add('hidden');
  themeIconDark.classList.add('hidden');
  
  if (actualTheme === 'dark') {
    themeIconDark.classList.remove('hidden');
  } else {
    themeIconLight.classList.remove('hidden');
  }
}

function applyTheme(themeMode) {
  const actualTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
  if (actualTheme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.add('light');
    html.classList.remove('dark');
  }
  updateIcon(actualTheme);
}

function getStoredThemeMode() {
  return localStorage.getItem('themeMode') || 'system';
}

function setThemeMode(themeMode) {
  if (themeMode === 'system') {
    localStorage.removeItem('themeMode');
  } else {
    localStorage.setItem('themeMode', themeMode);
  }
  applyTheme(themeMode);
}

applyTheme(getStoredThemeMode());

themeToggle?.addEventListener('click', () => {
  const currentMode = getStoredThemeMode();
  let nextMode;
  
  if (currentMode === 'system') {
    const systemTheme = getSystemTheme();
    nextMode = systemTheme === 'dark' ? 'light' : 'dark';
  } else {
    nextMode = 'system';
  }
  
  setThemeMode(nextMode);
});

const tocLinks = document.querySelectorAll('.toc-link');
let activeId = null;

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      activeId = entry.target.id;
      updateTocLinks();
    }
  });
}, {
  rootMargin: '-100px 0px -66% 0px',
  threshold: 0
});

function updateTocLinks() {
  tocLinks.forEach(link => {
    const isActive = link.dataset.id === activeId;
    if (isActive) {
      link.classList.add('!text-primary-600', 'dark:!text-primary-400', '!border-primary-600', 'dark:!border-primary-400', 'font-medium');
    } else {
      link.classList.remove('!text-primary-600', 'dark:!text-primary-400', '!border-primary-600', 'dark:!border-primary-400', 'font-medium');
    }
  });
}

document.querySelectorAll('.content h2[id], .content h3[id]').forEach(heading => {
  observer.observe(heading);
});

tocLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    activeId = link.dataset.id;
    updateTocLinks();
  });
});

document.querySelectorAll('pre').forEach(pre => {
  const button = document.createElement('button');
  button.className = 'absolute top-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-gray-100 cursor-pointer';
  button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
  
  button.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent;
    await navigator.clipboard.writeText(code);
    
    button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
    setTimeout(() => {
      button.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
    }, 2000);
  });
  
  pre.classList.add('relative', 'group');
  pre.appendChild(button);
});

// Copy for LLM — POST to get clipboard text from server, copy it
const copyLlmBtn = document.getElementById('copy-llm-link');
copyLlmBtn?.addEventListener('click', async () => {
  try {
    const res = await fetch(`/api/llm-copy?path=${encodeURIComponent(copyLlmBtn.dataset.path)}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to copy');
    const { text } = await res.json();
    await navigator.clipboard.writeText(text);
    showToast('Copied for LLM');
  } catch (err) {
    showToast(err.message || 'Failed to copy');
  }
});

function showToast(message) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'fixed bottom-6 right-6 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-lg z-50 transition-opacity duration-300';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

