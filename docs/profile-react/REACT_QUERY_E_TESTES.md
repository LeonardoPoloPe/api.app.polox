# 🚀 Guia de Implementação Frontend - Melhorias Recomendadas

**Data:** 9 de novembro de 2025  
**Prioridade:** ⚠️ **ALTA** - Implementar antes de escalar

---

## 📋 Índice

1. [React Query - Cache e Estado do Servidor](#react-query)
2. [Estratégia de Testes](#testes)
3. [Checklist de Implementação](#checklist)
4. [Exemplos de Código](#exemplos)

---

## 🔄 React Query - Cache e Estado do Servidor {#react-query}

### Por Que React Query?

O endpoint `/users/profile-menu` retorna dados críticos que:
- ✅ Devem ser cacheados (evitar chamadas desnecessárias)
- ✅ Precisam de sincronização em tempo real
- ✅ Devem ter estados de loading/error tratados
- ✅ Necessitam invalidação após mudanças de perfil

### 📦 Instalação

```bash
npm install @tanstack/react-query
# ou
yarn add @tanstack/react-query
```

### ⚙️ Setup Inicial

```typescript
// src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
```

```typescript
// src/main.tsx ou src/App.tsx
import { QueryProvider } from './providers/QueryProvider';

function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryProvider>
  );
}
```

---

## 🎯 Implementação do Hook useUserProfileMenu

### 1. Service Layer

```typescript
// src/services/api/userService.ts
import { api } from './apiClient';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  companyId: number;
  profileId: number | null;
  profileName: string | null;
}

export interface Profile {
  id: number;
  name: string;
  translations: {
    'pt-BR': string;
    'en-US': string;
    'es-ES': string;
  };
  screenIds: string[];
}

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  orderPosition: number;
  parentId: string | null;
  isActive: boolean;
  visibleToAll: boolean;
  rootOnlyAccess: boolean;
  svgColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  children: MenuItem[];
}

export interface UserProfileMenuResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    profile: Profile | null;
    menus: MenuItem[];
  };
}

export const userService = {
  /**
   * Busca perfil e menus do usuário autenticado
   * Usa automaticamente o token JWT (req.user.id)
   */
  async getProfileMenu(language: string = 'pt-BR'): Promise<UserProfileMenuResponse> {
    const { data } = await api.get<UserProfileMenuResponse>(
      '/users/profile-menu',
      {
        headers: {
          'Accept-Language': language,
        },
      }
    );
    return data;
  },
};
```

### 2. React Query Hook

```typescript
// src/hooks/useUserProfileMenu.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userService, UserProfileMenuResponse } from '@/services/api/userService';
import { useLanguage } from '@/hooks/useLanguage';

export const USER_PROFILE_MENU_KEY = ['user', 'profile-menu'] as const;

export function useUserProfileMenu() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...USER_PROFILE_MENU_KEY, language],
    queryFn: () => userService.getProfileMenu(language),
    staleTime: 5 * 60 * 1000, // 5 minutos
    cacheTime: 10 * 60 * 1000, // 10 minutos
    retry: 2,
    // Só executa se houver token
    enabled: !!localStorage.getItem('authToken'),
  });

  /**
   * Invalida o cache e força recarregamento
   * Útil após: mudança de perfil, atualização de permissões
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: USER_PROFILE_MENU_KEY });
  };

  /**
   * Atualiza o cache manualmente (otimistic update)
   */
  const updateCache = (updater: (old: UserProfileMenuResponse) => UserProfileMenuResponse) => {
    queryClient.setQueryData(
      [...USER_PROFILE_MENU_KEY, language],
      updater
    );
  };

  return {
    // Dados
    user: query.data?.data.user,
    profile: query.data?.data.profile,
    menus: query.data?.data.menus ?? [],

    // Estados
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isSuccess: query.isSuccess,

    // Ações
    refetch: query.refetch,
    invalidate,
    updateCache,
  };
}
```

### 3. Uso no Componente

```typescript
// src/pages/Dashboard.tsx
import { useUserProfileMenu } from '@/hooks/useUserProfileMenu';

export function Dashboard() {
  const { user, profile, menus, isLoading, isError, error } = useUserProfileMenu();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div>
      <Header user={user} profile={profile} />
      <Sidebar menus={menus} />
      <MainContent />
    </div>
  );
}
```

### 4. Invalidação Após Mudanças

```typescript
// src/hooks/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { USER_PROFILE_MENU_KEY } from './useUserProfileMenu';

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: number) => {
      return api.put('/users/profile', { profile_id: profileId });
    },
    onSuccess: () => {
      // Invalida cache do menu para recarregar com novas permissões
      queryClient.invalidateQueries({ queryKey: USER_PROFILE_MENU_KEY });
      
      toast.success('Perfil atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar perfil');
    },
  });
}
```

---

## 🧪 Estratégia de Testes {#testes}

### 📦 Ferramentas Recomendadas

```bash
# Testing Library
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# Vitest (alternativa moderna ao Jest)
npm install -D vitest @vitest/ui

# MSW (Mock Service Worker) - para mock de APIs
npm install -D msw

# React Query Testing
npm install -D @tanstack/react-query
```

### ⚙️ Setup do Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/tests/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Limpa após cada teste
afterEach(() => {
  cleanup();
});
```

### 🎭 Mock Service Worker (MSW)

```typescript
// src/tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock do endpoint profile-menu
  http.get('/api/v1/users/profile-menu', ({ request }) => {
    const language = request.headers.get('Accept-Language') || 'pt-BR';
    
    return HttpResponse.json({
      success: true,
      message: 'Perfil e menus carregados com sucesso',
      data: {
        user: {
          id: 1,
          fullName: 'João Silva',
          email: 'joao@teste.com',
          role: 'user',
          companyId: 1,
          profileId: 2,
          profileName: 'Atendente',
        },
        profile: {
          id: 2,
          name: 'Atendente',
          translations: {
            'pt-BR': 'Atendente',
            'en-US': 'Support Agent',
            'es-ES': 'Agente de Soporte',
          },
          screenIds: ['2', '3', '6'],
        },
        menus: [
          {
            id: '2',
            label: language === 'pt-BR' ? 'Dashboard' : 'Dashboard',
            icon: 'dashboard',
            route: '/dashboard',
            orderPosition: 1,
            parentId: null,
            isActive: true,
            visibleToAll: false,
            rootOnlyAccess: false,
            svgColor: '#1976d2',
            backgroundColor: null,
            textColor: null,
            children: [],
          },
        ],
      },
    });
  }),

  // Mock de erro 401
  http.get('/api/v1/users/profile-menu', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || authHeader === 'Bearer invalid_token') {
      return new HttpResponse(null, {
        status: 401,
        statusText: 'Unauthorized',
      });
    }
  }),
];
```

```typescript
// src/tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// Atualizar src/tests/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// Iniciar MSW antes de todos os testes
beforeAll(() => server.listen());

// Reset handlers após cada teste
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Fechar servidor após todos os testes
afterAll(() => server.close());
```

### 🧪 Testes do Hook

```typescript
// src/hooks/__tests__/useUserProfileMenu.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserProfileMenu } from '../useUserProfileMenu';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useUserProfileMenu', () => {
  it('deve carregar perfil e menus com sucesso', async () => {
    const { result } = renderHook(() => useUserProfileMenu(), {
      wrapper: createWrapper(),
    });

    // Estado inicial
    expect(result.current.isLoading).toBe(true);
    expect(result.current.menus).toEqual([]);

    // Aguardar carregamento
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verificar dados
    expect(result.current.user?.fullName).toBe('João Silva');
    expect(result.current.profile?.name).toBe('Atendente');
    expect(result.current.menus).toHaveLength(1);
    expect(result.current.menus[0].label).toBe('Dashboard');
  });

  it('deve retornar erro para token inválido', async () => {
    // Simular token inválido
    localStorage.setItem('authToken', 'invalid_token');

    const { result } = renderHook(() => useUserProfileMenu(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.menus).toEqual([]);
  });

  it('deve invalidar cache corretamente', async () => {
    const { result } = renderHook(() => useUserProfileMenu(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Invalidar
    result.current.invalidate();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
  });
});
```

### 🎯 Testes de Componente

```typescript
// src/components/__tests__/Sidebar.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Sidebar', () => {
  it('deve renderizar menus corretamente', async () => {
    renderWithProviders(<Sidebar />);

    // Aguardar carregamento
    await screen.findByText('Dashboard');

    // Verificar se menu foi renderizado
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('deve mostrar loading durante carregamento', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByTestId('sidebar-loading')).toBeInTheDocument();
  });

  it('deve renderizar hierarquia de menus', async () => {
    renderWithProviders(<Sidebar />);

    await screen.findByText('Dashboard');

    // Verificar estrutura hierárquica
    const menuItem = screen.getByText('Dashboard').closest('li');
    expect(menuItem).toBeInTheDocument();
  });
});
```

### 📊 Testes de Integração

```typescript
// src/features/auth/__tests__/Login.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Login } from '../Login';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';

describe('Login Flow', () => {
  it('deve fazer login e carregar menu automaticamente', async () => {
    const user = userEvent.setup();
    
    // Mock do endpoint de login
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({
          success: true,
          data: {
            token: 'valid_jwt_token',
            user: { id: 1, email: 'joao@teste.com' },
          },
        });
      })
    );

    render(<Login />);

    // Preencher formulário
    await user.type(screen.getByLabelText(/email/i), 'joao@teste.com');
    await user.type(screen.getByLabelText(/senha/i), 'senha123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    // Aguardar redirect e carregamento do menu
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Verificar se menu foi carregado
    expect(screen.getByText('João Silva')).toBeInTheDocument();
  });
});
```

---

## ✅ Checklist de Implementação {#checklist}

### 🔄 React Query (Prioridade ALTA)

- [ ] **Setup Inicial**
  - [ ] Instalar `@tanstack/react-query`
  - [ ] Criar `QueryProvider`
  - [ ] Adicionar `ReactQueryDevtools`
  - [ ] Configurar `defaultOptions`

- [ ] **Service Layer**
  - [ ] Criar `userService.ts` com tipos TypeScript
  - [ ] Implementar `getProfileMenu()`
  - [ ] Adicionar interceptors de erro
  - [ ] Configurar retry logic

- [ ] **Custom Hooks**
  - [ ] Criar `useUserProfileMenu`
  - [ ] Implementar `invalidate()`
  - [ ] Implementar `updateCache()`
  - [ ] Adicionar estados de loading/error

- [ ] **Integração**
  - [ ] Usar hook no `Dashboard`
  - [ ] Usar hook no `Sidebar`
  - [ ] Implementar invalidação após updates
  - [ ] Testar cache funcionando

### 🧪 Testes (Prioridade ALTA)

- [ ] **Setup de Testes**
  - [ ] Instalar Vitest e Testing Library
  - [ ] Configurar `vitest.config.ts`
  - [ ] Criar `tests/setup.ts`
  - [ ] Instalar e configurar MSW

- [ ] **Mocks**
  - [ ] Criar handlers para `/users/profile-menu`
  - [ ] Mock de sucesso (200)
  - [ ] Mock de erro (401, 404, 500)
  - [ ] Mock com diferentes idiomas

- [ ] **Testes Unitários**
  - [ ] Testar `useUserProfileMenu` hook
  - [ ] Testar estados (loading, error, success)
  - [ ] Testar invalidação de cache
  - [ ] Testar mudança de idioma

- [ ] **Testes de Componente**
  - [ ] Testar renderização do Sidebar
  - [ ] Testar hierarquia de menus
  - [ ] Testar estados de loading/error
  - [ ] Testar interações do usuário

- [ ] **Testes de Integração**
  - [ ] Testar fluxo de login completo
  - [ ] Testar carregamento de menu após login
  - [ ] Testar atualização de perfil
  - [ ] Testar proteção de rotas

- [ ] **Coverage**
  - [ ] Configurar coverage mínimo (80%)
  - [ ] Gerar relatórios de coverage
  - [ ] Integrar com CI/CD

### 📊 Qualidade de Código

- [ ] **TypeScript**
  - [ ] Tipos para todas as interfaces
  - [ ] Strict mode habilitado
  - [ ] Sem `any` nos tipos principais

- [ ] **Lint e Format**
  - [ ] ESLint configurado
  - [ ] Prettier configurado
  - [ ] Pre-commit hooks (Husky)

- [ ] **Performance**
  - [ ] Lazy loading de rotas
  - [ ] Memoização de componentes pesados
  - [ ] Otimização de re-renders

---

## 📝 Scripts NPM Recomendados

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    
    "format": "prettier --write \"src/**/*.{ts,tsx,json,css,scss}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,css,scss}\"",
    
    "type-check": "tsc --noEmit",
    
    "prepare": "husky install"
  }
}
```

---

## 🎯 Ordem de Implementação Recomendada

### Semana 1: Setup e Infraestrutura
1. ✅ Instalar e configurar React Query
2. ✅ Criar service layer com tipos
3. ✅ Implementar `useUserProfileMenu` hook
4. ✅ Configurar ambiente de testes

### Semana 2: Testes Básicos
1. ✅ Configurar MSW
2. ✅ Escrever testes do hook
3. ✅ Escrever testes de componentes
4. ✅ Atingir 70% de coverage

### Semana 3: Integração
1. ✅ Integrar React Query nos componentes
2. ✅ Implementar invalidação de cache
3. ✅ Escrever testes de integração
4. ✅ Atingir 80% de coverage

### Semana 4: Polimento
1. ✅ Otimizações de performance
2. ✅ Documentação final
3. ✅ Code review
4. ✅ Deploy em staging

---

## 🚨 Alertas Importantes

### ⚠️ NÃO Fazer

❌ **Não usar Redux/Context para dados do servidor**
```typescript
// ❌ EVITAR
const [menus, setMenus] = useState([]);

useEffect(() => {
  fetch('/users/profile-menu').then(r => setMenus(r.menus));
}, []);
```

✅ **Usar React Query**
```typescript
// ✅ RECOMENDADO
const { menus } = useUserProfileMenu();
```

❌ **Não ignorar testes**
```typescript
// ❌ EVITAR
describe.skip('useUserProfileMenu', () => { ... });
```

❌ **Não fazer fetch manual**
```typescript
// ❌ EVITAR
await fetch('/users/profile-menu');
```

✅ **Usar service layer**
```typescript
// ✅ RECOMENDADO
await userService.getProfileMenu();
```

### ✅ Boas Práticas

✅ **Cache automático**
- Evita chamadas desnecessárias
- Melhora performance
- Reduz consumo de banda

✅ **Estados consistentes**
- Loading states unificados
- Error handling padronizado
- Success states claros

✅ **Testes completos**
- Cobertura mínima 80%
- Testes de integração
- Mocks realistas

---

## 📚 Recursos Adicionais

### Documentação
- [React Query Docs](https://tanstack.com/query/latest)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Vitest Guide](https://vitest.dev/guide/)

### Tutoriais
- [React Query in 100 Seconds](https://www.youtube.com/watch?v=novnyCaa7To)
- [Testing React with Vitest](https://vitest.dev/guide/testing-react.html)
- [MSW Tutorial](https://kentcdodds.com/blog/stop-mocking-fetch)

---

## ✅ Conclusão

**Antes de escalar, implementar:**

1. 🔄 **React Query** (1-2 semanas)
   - Cache automático
   - Estados unificados
   - Invalidação inteligente

2. 🧪 **Testes** (2-3 semanas)
   - Coverage mínimo 80%
   - Testes de integração
   - CI/CD integrado

3. 📊 **Qualidade** (1 semana)
   - TypeScript strict
   - ESLint + Prettier
   - Pre-commit hooks

**Benefícios:**
- ✅ Código mais confiável
- ✅ Menos bugs em produção
- ✅ Desenvolvimento mais rápido
- ✅ Manutenção simplificada
- ✅ Onboarding mais fácil

---

**Status:** 📋 Pronto para implementação  
**Prioridade:** ⚠️ ALTA - Implementar antes de adicionar features  
**Tempo Estimado:** 4-6 semanas  
**ROI:** 🚀 Alto - Reduz dívida técnica e aumenta velocidade
