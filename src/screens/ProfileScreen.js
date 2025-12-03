import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Avatar, Text, Card, List, Button, Divider, Switch } from 'react-native-paper';
import { theme } from '../theme/theme';

export default function ProfileScreen() {
  const [isDark, setIsDark] = React.useState(false);

  const handleLogout = () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive" }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* CABECERA NARANJA */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar.Image size={100} source={{ uri: 'https://i.pravatar.cc/150?img=12' }} />
          <View style={styles.badge}>
             <Text style={styles.badgeText}>ACTIVO</Text>
          </View>
        </View>
        <Text variant="headlineMedium" style={styles.name}>Yohan</Text>
        <Text variant="bodyLarge" style={styles.role}>Supervisor de Bodega • ID: 8821</Text>
      </View>

      {/* INFORMACIÓN */}
      <View style={styles.body}>
        <Card style={styles.card}>
          <Card.Content>
            <List.Section>
              <List.Subheader>Información Personal</List.Subheader>
              <List.Item 
                title="Correo Electrónico" 
                description="yohan.bodega@ataelqui.cl" 
                left={() => <List.Icon icon="email-outline" color={theme.colors.primary} />} 
              />
              <List.Item 
                title="Teléfono" 
                description="+56 9 1234 5678" 
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
          style={{borderColor:'#D32F2F', marginTop:20, marginBottom:40}} 
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
    paddingTop: 60, // Espacio para la barra de estado
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: { position: 'relative', marginBottom: 10 },
  badge: { 
    position: 'absolute', bottom: 0, right: 0, 
    backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  name: { color: 'white', fontWeight: 'bold' },
  role: { color: 'rgba(255,255,255,0.9)', marginTop: 5 },
  body: { padding: 20 },
  card: { marginBottom: 15, backgroundColor: 'white', borderRadius: 15 }
});