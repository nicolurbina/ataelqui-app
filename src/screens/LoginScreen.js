import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebaseConfig';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Error", "Por favor ingresa correo y contraseña");
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onLogin se llamará automáticamente si App.js escucha el estado de auth,
      // pero por ahora lo llamamos manualmente para asegurar la transición si no hay listener.
      onLogin();
    } catch (error) {
      Alert.alert("Error de inicio de sesión", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }}>
      <View style={{ alignItems: 'center', marginBottom: 40 }}>
        <MaterialCommunityIcons name="package-variant-closed" size={80} color="#F36F21" />
        <Text variant="headlineMedium" style={{ color: '#F36F21', fontWeight: 'bold' }}>Ataelqui</Text>
        <Text variant="bodyLarge">Gestión de Bodega</Text>
      </View>
      <TextInput
        label="Correo Electrónico"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ marginBottom: 15, backgroundColor: 'white' }}
      />
      <TextInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        secureTextEntry
        style={{ marginBottom: 20, backgroundColor: 'white' }}
      />
      <Button mode="contained" onPress={handleLogin} loading={loading} buttonColor="#F36F21">Ingresar</Button>
    </View>
  );
}