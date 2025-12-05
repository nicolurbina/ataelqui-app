import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NotificationsContext = createContext();

export const useNotifications = () => useContext(NotificationsContext);

export const NotificationsProvider = ({ children }) => {
    const [productAlertsCount, setProductAlertsCount] = useState(0);
    const [systemAlertsCount, setSystemAlertsCount] = useState(0);
    const [seenCount, setSeenCount] = useState(0);

    // Load seenCount from storage on mount
    useEffect(() => {
        const loadSeenCount = async () => {
            try {
                const savedCount = await AsyncStorage.getItem('notifications_seen_count');
                if (savedCount !== null) {
                    setSeenCount(parseInt(savedCount, 10));
                }
            } catch (e) {
                console.error("Failed to load seen count", e);
            }
        };
        loadSeenCount();
    }, []);

    useEffect(() => {
        // 1. ALERTAS DE PRODUCTOS
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

        // 2. ALERTAS DE SISTEMA
        const qAlerts = query(collection(db, "general_alerts"));
        const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
            setSystemAlertsCount(snapshot.size);
        });

        return () => {
            unsubscribeProducts();
            unsubscribeAlerts();
        };
    }, []);

    const totalAlerts = productAlertsCount + systemAlertsCount;

    // If total alerts decreased (deleted), update seenCount to avoid negative badge
    useEffect(() => {
        if (totalAlerts < seenCount) {
            setSeenCount(totalAlerts);
            AsyncStorage.setItem('notifications_seen_count', totalAlerts.toString()).catch(console.error);
        }
    }, [totalAlerts, seenCount]);

    const badgeCount = Math.max(0, totalAlerts - seenCount);

    const markAsSeen = async () => {
        setSeenCount(totalAlerts);
        try {
            await AsyncStorage.setItem('notifications_seen_count', totalAlerts.toString());
        } catch (e) {
            console.error("Failed to save seen count", e);
        }
    };

    return (
        <NotificationsContext.Provider value={{ badgeCount, markAsSeen }}>
            {children}
        </NotificationsContext.Provider>
    );
};
