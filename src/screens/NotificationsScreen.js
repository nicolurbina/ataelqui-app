import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Chip, Searchbar, ActivityIndicator, FAB, Divider, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot, query, addDoc, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useNotifications } from '../context/NotificationsContext';
import { useFocusEffect } from '@react-navigation/native';

export default function NotificationsScreen() {
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const { markAsSeen } = useNotifications();

  useFocusEffect(
    React.useCallback(() => {
      markAsSeen();
    }, [])
  );

  useEffect(() => {
    // ONLY SYSTEM ALERTS (Persistent)
    const qAlerts = query(collection(db, "general_alerts"));
    const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isSystem: true }));
      // Sort client-side: Newest first
      alerts.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
        return dateB - dateA;
      });
      setSystemAlerts(alerts);
      setLoading(false);
    });

    return () => unsubscribeAlerts();
  }, []);

  const deleteAlert = async (alert) => {
    try { await deleteDoc(doc(db, "general_alerts", alert.id)); } catch (e) { console.log(e); }
  };

  const deleteAllSystemAlerts = async () => {
    Alert.alert(
      "Borrar Alertas",
      "¿Estás seguro de eliminar todas las notificaciones?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            systemAlerts.forEach(a => {
              deleteDoc(doc(db, "general_alerts", a.id));
            });
          }
        }
      ]
    );
  };

  const filteredAlerts = systemAlerts.filter(alert => {
    const matchesType = filter === 'Todas' || alert.type === filter;
    const matchesSearch = alert.desc.toLowerCase().includes(searchQuery.toLowerCase()) || alert.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getIconForType = (type) => {
    switch (type) {
      case 'Discrepancia': return 'file-document-outline';
      case 'Sistema': return 'cloud-check';
      case 'Stock': return 'package-variant';
      case 'FEFO': return 'calendar-clock';
      case 'Devolución': return 'keyboard-return';
      case 'Merma': return 'trash-can-outline';
      default: return 'bell-outline';
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F36F21" /></View>;

  return (
    <View style={styles.container}>
      <View style={{ padding: 15, backgroundColor: 'white' }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <Searchbar placeholder="Buscar..." onChangeText={setSearchQuery} value={searchQuery} style={{ flex: 1, backgroundColor: '#f0f0f0' }} />
          <IconButton icon="trash-can-outline" mode="contained" containerColor="#FFEBEE" iconColor="#D32F2F" onPress={deleteAllSystemAlerts} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['Todas', 'FEFO', 'Stock', 'Discrepancia', 'Sistema', 'Devolución', 'Merma'].map((f) => (
            <Chip key={f} mode="outlined" style={[styles.chip, filter === f && { backgroundColor: '#FFF3E0', borderColor: '#F36F21' }]} onPress={() => setFilter(f)}>{f}</Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ padding: 10 }}>
        {filteredAlerts.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#999', marginBottom: 10 }}>No hay notificaciones.</Text>
          </View>
        )}
        {filteredAlerts.map((alert) => {
          const dateObj = alert.date?.toDate ? alert.date.toDate() : new Date(alert.date || Date.now());
          const dateStr = dateObj.toLocaleDateString();
          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const icon = getIconForType(alert.type);

          return (
            <Card key={alert.id} style={styles.card}>
              <View style={{ flexDirection: 'row', padding: 15 }}>
                {/* Icon Column */}
                <View style={{ marginRight: 15, justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={icon} size={32} color="#5E35B1" />
                </View>

                {/* Content Column */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#4527A0', marginBottom: 2 }}>{alert.title}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>{alert.type} • {dateStr} {timeStr}</Text>
                    </View>
                    <IconButton icon="close" size={20} style={{ margin: 0, marginTop: -5, marginRight: -10 }} onPress={() => deleteAlert(alert)} />
                  </View>

                  <Text style={{ marginTop: 8, color: '#444', fontSize: 13 }}>{alert.desc}</Text>

                  {/* Discrepancy Details Box */}
                  {alert.type === 'Discrepancia' && alert.expected !== undefined && (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#F3E5F5', borderRadius: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={{ fontSize: 12 }}>Esperado:</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{alert.expected}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={{ fontSize: 12 }}>Contado:</Text>
                        <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{alert.counted}</Text>
                      </View>
                      <Divider style={{ marginVertical: 5, backgroundColor: '#E1BEE7' }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#D32F2F', fontWeight: 'bold' }}>Diferencia:</Text>
                        <Text style={{ fontSize: 12, color: '#D32F2F', fontWeight: 'bold' }}>{alert.counted - alert.expected}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chip: { marginRight: 8 },
  card: { marginBottom: 10, backgroundColor: 'white' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#607D8B' },
});