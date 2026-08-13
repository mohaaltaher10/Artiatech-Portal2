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
  return pref !== 'false';
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) return false;

  try {
    let permission: NotificationPermission;
    const req = Notification.requestPermission();
    if (req && typeof req.then === 'function') {
      permission = await req;
    } else {
      permission = await new Promise((resolve) => {
        Notification.requestPermission(resolve);
      });
    }

    if (permission === 'granted') {
      localStorage.setItem('artiatech_notifications_enabled', 'true');
      
      // Send a test confirmation notification immediately
      setTimeout(() => {
        sendAppNotification('تم تفعيل الإشعارات بنجاح 🔔', {
          body: 'ستصلك التنبيهات الفورية للإعلانات والتوزيعات والطلبات على هذا الجهاز.',
          icon: '/icon.png',
          tag: 'welcome-notification'
        });
      }, 300);

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
    localStorage.setItem('artiatech_notifications_enabled', 'true');
    requestNotificationPermission();
  } else {
    localStorage.setItem('artiatech_notifications_enabled', 'false');
  }
};

export const sendAppNotification = (title: string, options?: NotificationOptions): void => {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem('artiatech_notifications_enabled') === 'false') return;

  const defaultOptions: NotificationOptions = {
    icon: '/icon.png',
    badge: '/icon.png',
    dir: 'rtl',
    lang: 'ar',
    tag: 'artiatech-notification',
    ...options
  };

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg && reg.showNotification) {
          reg.showNotification(title, defaultOptions).catch(() => {
            try { new Notification(title, defaultOptions); } catch (e) {}
          });
        } else {
          try { new Notification(title, defaultOptions); } catch (e) {}
        }
      }).catch(() => {
        try { new Notification(title, defaultOptions); } catch (e) {}
      });
    } else {
      try { new Notification(title, defaultOptions); } catch (e) {}
    }
  } catch (err) {
    console.warn('Notification send notice:', err);
  }
};

