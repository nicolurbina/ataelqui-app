import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../../firebaseConfig';

const NotificationsContext = createContext();

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider = ({ children }) => {
    const [productAlertsCount, setProductAlertsCount] = useState(0);
    const [unreadSystemCount, setUnreadSystemCount] = useState(0);
    const [systemAlerts, setSystemAlerts] = useState([]);

    // 1. ALERTAS DE PRODUCTOS (Calculated locally)
    useEffect(() => {
        const qProducts = query(collection(db, "products"));
        const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
            let count = 0;
            const today = new Date();
            snapshot.docs.forEach((doc) => {
                const p = doc.data();
                if (p.expiryDate) {
                    const expDate = new Date(p.expiryDate);
                    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 7) count++;
                }
                if (p.stock !== undefined && p.stock <= 10) count++;
            });
            setProductAlertsCount(count);
        });
        return () => unsubscribeProducts();
    }, []);

    // 2. ALERTAS DE SISTEMA (From Firestore)
    useEffect(() => {
        const qAlerts = query(collection(db, "notifications"));
        const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
            const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSystemAlerts(alerts);
            // Count only unread
            const unread = alerts.filter(a => !a.read).length;
            setUnreadSystemCount(unread);
        });
        return () => unsubscribeAlerts();
    }, []);

    // Badge = Unread System Alerts + Product Alerts (Product alerts are always "active" until resolved)
    // To avoid persistent badge for product alerts, we could track "seen" for them too, but typically
    // product alerts should persist until fixed. However, user wants "dynamic".
    // Let's assume Product Alerts contribute to badge until fixed.
    // OR: If user wants to clear badge, we can just use unreadSystemCount if product alerts are considered "dashboard info".
    // Let's stick to: Badge = Unread System Alerts. Product alerts are shown in dashboard/list.
    // If user wants product alerts to trigger badge, they should probably generate a Notification document.
    // Current implementation: Badge = Unread System Notifications.

    const badgeCount = unreadSystemCount;

    const markAsSeen = async () => {
        // Batch update unread system alerts to read: true
        const unread = systemAlerts.filter(a => !a.read);
        if (unread.length === 0) return;

        unread.forEach(async (alert) => {
            try {
                const alertRef = doc(db, "notifications", alert.id);
                await updateDoc(alertRef, { read: true });
            } catch (e) {
                console.error("Error marking as read", e);
            }
        });
    };

    return (
        <NotificationsContext.Provider value={{ badgeCount, markAsSeen }}>
            {children}
        </NotificationsContext.Provider>
    );
};
