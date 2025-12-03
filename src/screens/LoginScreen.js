import React from 'react';
import { View } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen({ onLogin }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <MaterialCommunityIcons name="package-variant-closed" size={80} color="#F36F21" />
        <Text variant="headlineMedium" style={{ color: '#F36F21', fontWeight: 'bold' }}>Ataelqui</Text>
        <Text variant="bodyLarge">Gestión de Bodega</Text>
      </View>
      <TextInput label="Usuario" mode="outlined" style={{ marginBottom: 15, backgroundColor:'white' }} />
      <TextInput label="Contraseña" mode="outlined" secureTextEntry style={{ marginBottom: 20, backgroundColor:'white' }} />
      <Button mode="contained" onPress={onLogin} buttonColor="#F36F21">Ingresar</Button>
    </View>
  );
}