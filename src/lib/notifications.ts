// Browser PWA Notifications Helper

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

export const isNotificationsEnabled = (): boolean => {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const pref = localStorage.getItem('artiatech_notifications_enabled');
  return pref === 'true';
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('artiatech_notifications_enabled', 'true');
      
      // Send a test confirmation notification
      sendAppNotification('تم تفعيل الإشعارات بنجاح 🔔', {
        body: 'ستصلك التنبيهات الفورية للإعلانات والتوزيعات والطلبات على هذا الجهاز.',
        icon: '/icon.png',
        tag: 'welcome-notification'
      });
      return true;
    } else {
      localStorage.setItem('artiatech_notifications_enabled', 'false');
      return false;
    }
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
};

export const setNotificationsEnabled = (enabled: boolean): void => {
  if (enabled) {
    requestNotificationPermission();
  } else {
    localStorage.setItem('artiatech_notifications_enabled', 'false');
  }
};

export const sendAppNotification = (title: string, options?: NotificationOptions): void => {
  if (!isNotificationsEnabled()) return;

  const defaultOptions: NotificationOptions = {
    icon: '/icon.png',
    badge: '/icon.png',
    dir: 'rtl',
    lang: 'ar',
    ...options
  };

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, defaultOptions);
      }).catch(() => {
        new Notification(title, defaultOptions);
      });
    } else {
      new Notification(title, defaultOptions);
    }
  } catch (err) {
    console.warn('Notification send notice:', err);
  }
};
