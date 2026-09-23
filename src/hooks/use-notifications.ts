import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { commercialEntitiesAPI } from "@/services/commercial-entities";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  date: Date;
}

const mapNotification = (item: Awaited<ReturnType<typeof commercialEntitiesAPI.createNotification>>): Notification => ({
  id: item.id,
  type: item.type,
  title: item.title,
  message: item.message,
  read: Boolean(item.read_at),
  date: new Date(item.created_at),
});

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const payload = await commercialEntitiesAPI.getNotifications();
      setNotifications(payload.notifications.map(mapNotification));
    } catch (error) {
      console.error("Não foi possível carregar as notificações.", error);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);

  const addNotification = useCallback(async (
    title: string,
    message: string,
    type: NotificationType = "info",
    showToast = true
  ) => {
    const persisted = mapNotification(await commercialEntitiesAPI.createNotification({ title, message, type }));
    setNotifications((current) => [persisted, ...current]);
    if (showToast) toast[type](title, { description: message });
    return persisted;
  }, []);

  const markAsRead = useCallback(async (id: number) => {
    await commercialEntitiesAPI.markNotificationRead(id);
    setNotifications((current) => current.map((notification) => notification.id === id ? { ...notification, read: true } : notification));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await commercialEntitiesAPI.markAllNotificationsRead();
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    await commercialEntitiesAPI.deleteNotification(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(async () => {
    await commercialEntitiesAPI.clearNotifications();
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refresh: loadNotifications,
  };
};

export default useNotifications;
