import { supabase } from './supabase';

export type NotificationType = 'info' | 'job_update' | 'chat' | 'promo' | 'admin_action' | 'ban';

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  actionLink?: {
    screen?: string;
    id?: string;
    name?: string;
    [key: string]: any;
  };
}

/**
 * Cria uma notificação para um usuário específico
 */
export const createNotification = async (params: CreateNotificationParams): Promise<void> => {
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      action_link: params.actionLink ? JSON.stringify(params.actionLink) : null,
    });
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
};

/**
 * Cria notificações para múltiplos usuários
 */
export const createBulkNotifications = async (notifications: CreateNotificationParams[]): Promise<void> => {
  try {
    const notificationsData = notifications.map(n => ({
      user_id: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      action_link: n.actionLink ? JSON.stringify(n.actionLink) : null,
    }));
    
    await supabase.from('notifications').insert(notificationsData);
  } catch (error) {
    console.error('Erro ao criar notificações em massa:', error);
  }
};

/**
 * Notifica todos os profissionais quando um novo pedido é criado
 */
export const notifyWorkersNewJob = async (jobId: string, jobTitle: string, clientName: string, city?: string): Promise<void> => {
  try {
    // Buscar todos os profissionais (workers) na mesma cidade ou sem filtro de cidade
    let query = supabase
      .from('profiles')
      .select('id, full_name')
      .contains('allowed_roles', ['worker'])
      .eq('active', true);
    
    if (city) {
      query = query.ilike('city', city);
    }
    
    const { data: workers } = await query;
    
    if (workers && workers.length > 0) {
      const notifications = workers.map(worker => ({
        userId: worker.id,
        title: 'Novo Pedido Disponível!',
        message: `${clientName} criou um novo pedido: "${jobTitle}"${city ? ` em ${city}` : ''}`,
        type: 'job_update' as NotificationType,
        actionLink: {
          screen: 'jobs',
          jobId: jobId,
        },
      }));
      
      await createBulkNotifications(notifications);
    }
  } catch (error) {
    console.error('Erro ao notificar profissionais sobre novo pedido:', error);
  }
};

/**
 * Notifica o cliente quando o profissional aceita o pedido
 */
export const notifyClientJobAccepted = async (clientId: string, workerName: string, jobTitle: string, jobId: string): Promise<void> => {
  await createNotification({
    userId: clientId,
    title: 'Pedido Aceito!',
    message: `${workerName} aceitou seu pedido: "${jobTitle}"`,
    type: 'job_update',
    actionLink: {
      screen: 'jobs',
      jobId: jobId,
    },
  });
};

/**
 * Notifica o cliente quando o profissional finaliza o serviço
 */
export const notifyClientJobFinished = async (clientId: string, workerName: string, jobTitle: string, jobId: string): Promise<void> => {
  await createNotification({
    userId: clientId,
    title: 'Serviço Finalizado!',
    message: `${workerName} finalizou o serviço: "${jobTitle}". Confirme e avalie o trabalho.`,
    type: 'job_update',
    actionLink: {
      screen: 'jobs',
      jobId: jobId,
    },
  });
};

/**
 * Notifica o cliente quando o profissional cancela o serviço
 */
export const notifyClientJobCancelled = async (clientId: string, workerName: string, jobTitle: string, reason?: string): Promise<void> => {
  await createNotification({
    userId: clientId,
    title: 'Serviço Cancelado',
    message: `${workerName} cancelou o serviço: "${jobTitle}"${reason ? `. Motivo: ${reason}` : ''}`,
    type: 'job_update',
  });
};

/**
 * Notifica o profissional quando o cliente cancela o pedido
 */
export const notifyWorkerJobCancelled = async (workerId: string, clientName: string, jobTitle: string, reason?: string): Promise<void> => {
  await createNotification({
    userId: workerId,
    title: 'Pedido Cancelado',
    message: `${clientName} cancelou o pedido: "${jobTitle}"${reason ? `. Motivo: ${reason}` : ''}`,
    type: 'job_update',
  });
};

/**
 * Notifica o profissional quando o cliente confirma e avalia o serviço
 */
export const notifyWorkerJobCompleted = async (workerId: string, clientName: string, jobTitle: string, rating: number): Promise<void> => {
  await createNotification({
    userId: workerId,
    title: 'Serviço Confirmado!',
    message: `${clientName} confirmou e avaliou seu serviço "${jobTitle}" com ${rating} estrela${rating > 1 ? 's' : ''}`,
    type: 'job_update',
    actionLink: {
      screen: 'history',
    },
  });
};

/**
 * Notifica usuário quando é banido
 */
export const notifyUserBanned = async (userId: string, banType: '7days' | 'indefinite', untilDate?: string): Promise<void> => {
  const message = banType === '7days' && untilDate
    ? `Sua conta foi suspensa por 7 dias. Você poderá usar o app novamente em ${new Date(untilDate).toLocaleDateString('pt-BR')}.`
    : 'Sua conta foi suspensa indefinidamente. Entre em contato com o suporte para mais informações.';
  
  await createNotification({
    userId,
    title: 'Conta Suspensa',
    message,
    type: 'ban',
  });
};

/**
 * Notifica usuário quando banimento é removido
 */
export const notifyUserUnbanned = async (userId: string): Promise<void> => {
  await createNotification({
    userId,
    title: 'Conta Reativada',
    message: 'Seu banimento foi removido. Você pode usar o app novamente!',
    type: 'admin_action',
  });
};

/**
 * Notifica usuário quando admin modifica seu perfil
 */
export const notifyUserProfileUpdated = async (userId: string, changes: string[]): Promise<void> => {
  await createNotification({
    userId,
    title: 'Perfil Atualizado',
    message: `O administrador atualizou seu perfil: ${changes.join(', ')}`,
    type: 'admin_action',
  });
};

/**
 * Notifica usuário quando admin aprova recurso de punição
 */
export const notifyAppealApproved = async (userId: string): Promise<void> => {
  await createNotification({
    userId,
    title: 'Recurso Aprovado',
    message: 'Seu recurso foi aprovado! Sua conta foi reativada.',
    type: 'admin_action',
  });
};

/**
 * Notifica usuário quando admin rejeita recurso de punição
 */
export const notifyAppealRejected = async (userId: string): Promise<void> => {
  await createNotification({
    userId,
    title: 'Recurso Rejeitado',
    message: 'Seu recurso foi analisado e rejeitado. O banimento permanece.',
    type: 'admin_action',
  });
};

/**
 * Limpa notificações antigas (visualizadas há mais de 3 dias)
 * Esta função deve ser chamada periodicamente (ex: diariamente via cron job)
 * ou pode ser executada manualmente quando necessário
 */
export const cleanupOldNotifications = async (): Promise<void> => {
  try {
    const { error } = await supabase.rpc('cleanup_old_notifications');
    if (error) {
      console.error('Erro ao limpar notificações antigas:', error);
    }
  } catch (error) {
    console.error('Erro ao executar limpeza de notificações:', error);
  }
};
