import { prisma } from '../../config/database.js';
import { emitToUser } from '../../sockets/socket.server.js';

export class NotificationService {
  async getNotifications(userId: string) {
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((n) => ({
      id: n.id,
      userId: n.recipientId,
      type: n.notificationType,
      title: n.title || 'System Notification',
      message: n.message,
      read: n.isRead,
      timestamp: n.createdAt.toISOString(),
    }));
  }

  async markAsRead(notificationId: string, userId: string) {
    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
    emitToUser(userId, 'notification:read', { notificationId });
  }

  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
    emitToUser(userId, 'notification:read', { all: true });
  }

  async createNotification(userId: string, type: string, title: string, message: string, relatedEntity?: string) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: userId,
        notificationType: type,
        title,
        message,
        relatedEntity,
      },
    });

    emitToUser(userId, 'notification:new', {
      id: notification.id,
      userId: notification.recipientId,
      type: notification.notificationType,
      title: notification.title,
      message: notification.message,
      read: notification.isRead,
      timestamp: notification.createdAt.toISOString(),
    });

    return notification;
  }
}

export const notificationService = new NotificationService();
