# Sistema de Notificações Temporárias

## Visão Geral

Este sistema implementa notificações temporárias que são automaticamente removidas **3 dias após serem visualizadas**. Notificações não visualizadas permanecem indefinidamente até serem lidas.

## Como Funciona

1. **Quando uma notificação é criada**: Ela é salva no banco de dados com `read = false` e `read_at = NULL`.

2. **Quando uma notificação é visualizada**: 
   - O campo `read` é atualizado para `true`
   - O campo `read_at` é automaticamente preenchido com a data/hora atual (via trigger do PostgreSQL)
   - A notificação permanece visível por mais 3 dias

3. **Após 3 dias da visualização**: A notificação é automaticamente removida do banco de dados.

## Instalação

### 1. Execute a Migration SQL

Execute o arquivo `supabase-migration-notifications-temporary.sql` no Supabase SQL Editor:

```sql
-- Este arquivo adiciona:
-- - Coluna read_at na tabela notifications
-- - Função cleanup_old_notifications() para remover notificações antigas
-- - Trigger para atualizar read_at automaticamente
```

### 2. Configurar Limpeza Automática (Recomendado)

Para limpar notificações antigas automaticamente, você tem duas opções:

#### Opção A: Via pg_cron (Recomendado - Backend)

Se o Supabase tiver a extensão `pg_cron` habilitada, agende a limpeza diária:

```sql
-- Executar limpeza diariamente às 2h da manhã
SELECT cron.schedule(
  'cleanup-old-notifications',
  '0 2 * * *',
  'SELECT public.cleanup_old_notifications();'
);
```

#### Opção B: Via Frontend (Já implementado)

O código já inclui uma limpeza automática que executa uma vez por dia quando o usuário faz login. Isso funciona, mas não é ideal para produção em larga escala.

#### Opção C: Via Edge Function ou Cron Job Externo

Você pode criar uma Edge Function no Supabase ou usar um serviço externo (como Vercel Cron, GitHub Actions, etc.) para chamar a função periodicamente:

```typescript
// Exemplo de Edge Function
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const { error } = await supabase.rpc('cleanup_old_notifications');
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

## Estrutura do Banco de Dados

### Tabela `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,  -- NOVO: Data de visualização
  action_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Funções Criadas

1. **`cleanup_old_notifications()`**: Remove notificações lidas há mais de 3 dias
2. **`update_notification_read_at()`**: Trigger function que atualiza `read_at` automaticamente

## Comportamento no Frontend

### Filtragem de Notificações

O componente `NotificationBell` agora filtra automaticamente:
- ✅ Notificações não lidas (sempre visíveis)
- ✅ Notificações lidas há menos de 3 dias
- ❌ Notificações lidas há mais de 3 dias (ocultadas)

### Atualização Automática

Quando uma notificação é clicada ou marcada como lida:
- O campo `read` é atualizado para `true`
- O campo `read_at` é atualizado automaticamente (via trigger)
- A notificação permanece visível por mais 3 dias

## Testando

1. **Criar uma notificação**:
   ```typescript
   await createNotification({
     userId: 'user-id',
     title: 'Teste',
     message: 'Esta é uma notificação de teste',
     type: 'info'
   });
   ```

2. **Visualizar a notificação**: Abra o sino de notificações e clique na notificação

3. **Verificar `read_at`**: A data deve ser preenchida automaticamente

4. **Aguardar 3 dias** ou **simular** alterando manualmente `read_at` no banco:
   ```sql
   UPDATE notifications 
   SET read_at = NOW() - INTERVAL '4 days'
   WHERE id = 'notification-id';
   ```

5. **Executar limpeza**:
   ```sql
   SELECT public.cleanup_old_notifications();
   ```

6. **Verificar remoção**: A notificação deve ter sido deletada

## Manutenção

### Limpeza Manual

Se necessário, você pode executar a limpeza manualmente:

```sql
SELECT public.cleanup_old_notifications();
```

### Verificar Notificações Antigas

```sql
-- Ver notificações que serão removidas na próxima limpeza
SELECT id, title, read_at, 
       NOW() - read_at AS age,
       (NOW() - read_at) > INTERVAL '3 days' AS should_delete
FROM notifications
WHERE read = true 
  AND read_at IS NOT NULL
ORDER BY read_at ASC;
```

## Notas Importantes

1. **Notificações não lidas**: Nunca são removidas automaticamente, apenas as lidas há mais de 3 dias.

2. **Performance**: A limpeza é eficiente, mas em sistemas com muitos usuários, recomenda-se executar via cron job no backend.

3. **Timezone**: O sistema usa `TIMESTAMP WITH TIME ZONE` para garantir consistência independente do fuso horário.

4. **Backup**: Se você precisar manter histórico de notificações, considere criar uma tabela de arquivo antes de implementar este sistema.

## Troubleshooting

### Notificações não estão sendo removidas

1. Verifique se o trigger está ativo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_notification_read_at';
   ```

2. Verifique se `read_at` está sendo preenchido:
   ```sql
   SELECT id, read, read_at FROM notifications WHERE user_id = 'user-id' LIMIT 5;
   ```

3. Execute a limpeza manualmente para testar:
   ```sql
   SELECT public.cleanup_old_notifications();
   ```

### `read_at` não está sendo atualizado

O trigger deve atualizar automaticamente. Se não estiver funcionando:
- Verifique se a migration foi executada corretamente
- Verifique os logs do Supabase para erros no trigger
