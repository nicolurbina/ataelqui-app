import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Avatar, Text, Card, List, Button, Switch, ActivityIndicator, IconButton } from 'react-native-paper';
import { theme } from '../theme/theme';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function ProfileScreen() {
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({
    name: 'Usuario',
    email: '',
    role: 'Sin Rol',
    phone: '',
    photoURL: null
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        setUserData(prev => ({ ...prev, email: user.email }));

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(prev => ({
            ...prev,
            name: data.name || user.displayName || 'Usuario',
            role: data.role || 'Usuario',
            phone: data.phone || 'Sin teléfono',
            photoURL: data.photoURL || null
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setUserData(prev => ({ ...prev, photoURL: base64Img }));

        // Save to Firestore
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            photoURL: base64Img
          });
          Alert.alert("Éxito", "Foto de perfil actualizada");
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "No se pudo cargar la imagen");
    }
  };

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => auth.signOut() }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* CABECERA NARANJA */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
            {userData.photoURL ? (
              <Avatar.Image size={100} source={{ uri: userData.photoURL }} />
            ) : (
              <Avatar.Icon size={100} icon="account" style={{ backgroundColor: '#e0e0e0' }} />
            )}
            <View style={styles.editBadge}>
              <IconButton icon="camera" iconColor="white" size={14} style={{ margin: 0 }} />
            </View>
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ACTIVO</Text>
          </View>
        </View>
        <Text variant="headlineMedium" style={styles.name}>{userData.name}</Text>
        <Text variant="bodyLarge" style={styles.role}>{userData.role}</Text>
      </View>

      {/* INFORMACIÓN */}
      <View style={styles.body}>
        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>Información Personal</List.Subheader>
              <List.Item
                title="Correo Electrónico"
                description={userData.email}
                left={() => <List.Icon icon="email-outline" color={theme.colors.primary} />}
              />
              <List.Item
                title="Teléfono"
                description={userData.phone}
                left={() => <List.Icon icon="phone-outline" color={theme.colors.primary} />}
              />
              <List.Item
                title="Sucursal"
                description="Bodega Central - Copiapó"
                left={() => <List.Icon icon="map-marker-outline" color={theme.colors.primary} />}
              />
            </List.Section>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>Configuración</List.Subheader>
              <List.Item
                title="Notificaciones Push"
                right={() => <Switch value={true} color={theme.colors.primary} />}
                left={() => <List.Icon icon="bell-outline" />}
              />
              <List.Item
                title="Modo Oscuro"
                right={() => <Switch value={isDark} onValueChange={setIsDark} color={theme.colors.primary} />}
                left={() => <List.Icon icon="theme-light-dark" />}
              />
            </List.Section>
          </Card.Content>
        </Card>

        <Button
          mode="outlined"
          textColor="#D32F2F"
          style={{ borderColor: '#D32F2F', marginTop: 20, marginBottom: 40 }}
          icon="logout"
          onPress={handleLogout}
        >
          Cerrar Sesión
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  badge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10
  },
  editBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 28, height: 28,
    justifyContent: 'center', alignItems: 'center'
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  name: { color: 'white', fontWeight: 'bold', marginTop: 10 },
  role: { color: 'rgba(255,255,255,0.9)', marginTop: 5 },
  body: { padding: 20 },
  card: { marginBottom: 15, backgroundColor: 'white', borderRadius: 15 }
});